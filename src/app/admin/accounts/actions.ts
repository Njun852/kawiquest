"use server";

import { z } from "zod";
import { asAdmin, num, str, type ActionResult } from "@/lib/server-actions";
import { createAccount, DuplicateAccountError } from "@/lib/auth/accounts";
import { emailSchema, fieldErrorsOf, nameSchema, usernameSchema } from "@/lib/auth/schemas";
import { revokeSessions } from "@/lib/auth/session";
import { issueToken, sendInviteEmail, sendResetEmail } from "@/lib/auth/tokens";
import { ROLE_IDS, ROLES, roleName, type Role } from "@/lib/constants";
import { emailConfigured } from "@/lib/mail";
import {
  Account,
  AuthToken,
  CharacterValidation,
  GameSession,
  HandwritingSample,
  LoginThrottle,
  PlayerProfile,
  PlayerQuestProgress,
  Session,
} from "@/lib/models";

const ROLE_WORD: Record<Role, string> = { admin: "admin", validator: "validator", contributor: "contributor", player: "player" };

/** "Sent to x" or, without an email provider, where to find the link. */
function delivered(email: string) {
  return emailConfigured() ? `sent to ${email}` : `printed to the server console (email isn't set up yet)`;
}

async function adminCount() {
  return Account.countDocuments({ role_id: ROLE_IDS.admin });
}

const staffSchema = z.object({
  first_name: nameSchema("first name"),
  last_name: nameSchema("last name"),
  email: emailSchema,
  username: usernameSchema,
  role: z.enum(["validator", "admin"], { error: "Choose validator or admin." }),
});

/** New staff account (AdminAccounts): the only way to create validators and admins. They set their own password. */
export async function createStaff(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const values = Object.fromEntries(["first_name", "last_name", "email", "username", "role"].map((k) => [k, str(fd, k)]));
    const parsed = staffSchema.safeParse(values);
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
    const { role, ...rest } = parsed.data;

    const [emailTaken, usernameTaken] = await Promise.all([Account.exists({ email: rest.email }), Account.exists({ username: rest.username })]);
    if (emailTaken || usernameTaken) {
      return {
        fieldErrors: { ...(emailTaken && { email: "That email already has an account." }), ...(usernameTaken && { username: "That username is taken." }) },
        values,
      };
    }
    let account;
    try {
      account = await createAccount({ role, ...rest, password_hash: null, birthday: null });
    } catch (err) {
      if (err instanceof DuplicateAccountError) return { fieldErrors: { [err.field]: `That ${err.field} is already used.` }, values };
      throw err;
    }
    const token = await issueToken(account.account_id, "invite");
    await sendInviteEmail(account.email, account.username, role, token);
    return { success: `Created ${role} ${account.username}. The set-password link was ${delivered(account.email)}.`, id: account.account_id, done: "saved" };
  });
}

export async function changeRole(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async (me) => {
    const id = num(fd, "account_id");
    const role = str(fd, "role") as Role;
    if (!(ROLES as readonly string[]).includes(role)) return { error: "Choose a role." };
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    const current = roleName(account.role_id);
    if (current === role) return { success: `${account.username} is already a ${ROLE_WORD[role]}.` };
    if (id === me.id) return { error: "You can't change your own role. Ask another admin." };
    if (current === "admin" && (await adminCount()) <= 1) return { error: "This is the last admin account; make someone else an admin first." };

    const accountId = account.account_id;
    await Account.updateOne({ account_id: accountId }, { role_id: ROLE_IDS[role] });
    if (role === "player" && !(await PlayerProfile.exists({ account_id: accountId }))) {
      await PlayerProfile.create({ account_id: accountId, current_level: 1, tutorial_completed: false });
    }
    // Their signed-in sessions carry the old role; end them so the next sign-in lands in the right place.
    await revokeSessions(accountId);
    return { success: `${account.username} is now a ${ROLE_WORD[role]} and has been signed out everywhere.`, id: accountId, done: "saved" };
  });
}

/** Password reset link, or a fresh invite link for staff who never set a password. */
export async function sendPasswordLink(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "account_id");
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    if (account.password_hash == null) {
      const token = await issueToken(account.account_id, "invite");
      await sendInviteEmail(account.email, account.username, roleName(account.role_id) ?? "staff", token);
      return { success: `New invite link ${delivered(account.email)}.` };
    }
    const token = await issueToken(account.account_id, "reset");
    await sendResetEmail(account.email, account.username, token);
    return { success: `Password reset link ${delivered(account.email)}. It expires in 30 minutes.` };
  });
}

export async function signOutEverywhere(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async (me) => {
    const id = num(fd, "account_id");
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    const res = await Session.deleteMany({ account_id: id, ...(id === me.id && { _id: { $ne: me.sessionId } }) });
    return { success: `Ended ${res.deletedCount} session(s) for ${account.username}${id === me.id ? " (this browser stays signed in)" : ""}.` };
  });
}

/**
 * The ERD has no "deactivated" status, so removing someone means deleting the account. That is refused while
 * research or game data refers to it (handwriting samples, game sessions, quest progress).
 */
export async function deleteAccount(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async (me) => {
    const id = num(fd, "account_id");
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    if (id === me.id) return { error: "You can't delete your own account." };
    if (roleName(account.role_id) === "admin" && (await adminCount()) <= 1) return { error: "You can't delete the last admin account." };

    const [samples, sessions, progress, reviews] = await Promise.all([
      HandwritingSample.countDocuments({ account_id: id }),
      GameSession.countDocuments({ account_id: id }),
      PlayerQuestProgress.countDocuments({ account_id: id }),
      CharacterValidation.countDocuments({ account_id: id }),
    ]);
    if (samples || sessions || progress || reviews) {
      return {
        error: `Can't delete ${account.username}: ${samples} handwriting sample(s), ${sessions} game session(s), ${progress} quest progress row(s) and ${reviews} validation decision(s) belong to it. Change their role or send a reset instead.`,
      };
    }
    await Promise.all([
      Session.deleteMany({ account_id: id }),
      AuthToken.deleteMany({ account_id: id }),
      LoginThrottle.deleteMany({ account_id: id }),
      PlayerProfile.deleteMany({ account_id: id }),
    ]);
    await Account.deleteOne({ account_id: id });
    return { success: `Deleted ${account.username}.`, done: "deleted" };
  });
}

"use server";

import { z } from "zod";
import { asAdmin, num, str, type ActionResult } from "@/lib/server-actions";
import { createAccount, DuplicateAccountError } from "@/lib/auth/accounts";
import { birthdaySchema, emailSchema, fieldErrorsOf, nameSchema, usernameSchema } from "@/lib/auth/schemas";
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
  PlayerAchievement,
  PlayerItem,
  PlayerProfile,
  PlayerQuestProgress,
  Session,
} from "@/lib/models";

const ROLE_WORD: Record<Role, string> = { admin: "admin", validator: "validator", contributor: "contributor", player: "player" };

/** "Sent to x" or, without an email provider, where to find the link. */
function delivered(email: string) {
  return emailConfigured() ? `sent to ${email}` : `printed to the server console (email isn't set up yet)`;
}

/** Admins who can still sign in: the last one can't be demoted, deactivated or deleted. */
async function activeAdminCount() {
  return Account.countDocuments({ role_id: ROLE_IDS.admin, is_active: { $ne: false } });
}

/** An optional yyyy-mm-dd field: empty means no birthday on file. */
const optionalBirthday = z.union([z.literal("").transform(() => null), birthdaySchema]);

const detailsSchema = z.object({
  first_name: nameSchema("first name"),
  last_name: nameSchema("last name"),
  email: emailSchema,
  username: usernameSchema,
  birthday: optionalBirthday,
});

const newAccountSchema = detailsSchema.extend({
  role: z.enum(ROLES, { error: "Choose a role." }),
});

/** Which of email and username another account already uses. */
async function takenBy(email: string, username: string, exceptId?: number) {
  const not = exceptId ? { account_id: { $ne: exceptId } } : {};
  const [emailTaken, usernameTaken] = await Promise.all([
    Account.exists({ email, ...not }),
    Account.exists({ username, ...not }),
  ]);
  if (!emailTaken && !usernameTaken) return null;
  return {
    ...(emailTaken && { email: "That email already has an account." }),
    ...(usernameTaken && { username: "That username is taken." }),
  };
}

/** FR2: create an account of any role. The person gets a link to set their own password; admins never see it. */
export async function createAccountAsAdmin(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const values = Object.fromEntries(["first_name", "last_name", "email", "username", "birthday", "role"].map((k) => [k, str(fd, k)]));
    const parsed = newAccountSchema.safeParse(values);
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
    const { role, ...rest } = parsed.data;

    const taken = await takenBy(rest.email, rest.username);
    if (taken) return { fieldErrors: taken, values };
    let account;
    try {
      account = await createAccount({ role, ...rest, password_hash: null });
    } catch (err) {
      if (err instanceof DuplicateAccountError) return { fieldErrors: { [err.field]: `That ${err.field} is already used.` }, values };
      throw err;
    }
    const token = await issueToken(account.account_id, "invite");
    await sendInviteEmail(account.email, account.username, role, token);
    return { success: `Created ${role} ${account.username}. The set-password link was ${delivered(account.email)}.`, id: account.account_id, done: "saved" };
  });
}

/** FR2: edit an account's name, email, username and birthday. */
export async function updateDetails(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "account_id");
    const values = Object.fromEntries(["first_name", "last_name", "email", "username", "birthday"].map((k) => [k, str(fd, k)]));
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    const parsed = detailsSchema.safeParse(values);
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
    const taken = await takenBy(parsed.data.email, parsed.data.username, account.account_id);
    if (taken) return { fieldErrors: taken, values };
    try {
      await Account.updateOne({ account_id: account.account_id }, parsed.data);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return { error: "That email or username was just taken. Try another.", values };
      throw err;
    }
    return { success: `Saved ${parsed.data.username}'s details.`, id: account.account_id, done: "saved" };
  });
}

/** FR2: deactivate (can't sign in, data kept, signed out everywhere) or reactivate an account. */
export async function setActive(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async (me) => {
    const id = num(fd, "account_id");
    const active = str(fd, "active") === "true";
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    if (id === me.id) return { error: "You can't deactivate your own account." };
    if ((account.is_active !== false) === active) {
      return { success: `${account.username} is already ${active ? "active" : "deactivated"}.` };
    }
    if (!active && roleName(account.role_id) === "admin" && (await activeAdminCount()) <= 1) {
      return { error: "This is the last active admin; make someone else an admin first." };
    }
    await Account.updateOne({ account_id: account.account_id }, { is_active: active });
    if (!active) {
      await Promise.all([Session.deleteMany({ account_id: account.account_id }), AuthToken.deleteMany({ account_id: account.account_id })]);
      return { success: `Deactivated ${account.username}. They've been signed out and can't sign in until reactivated.`, id: account.account_id, done: "saved" };
    }
    return { success: `Reactivated ${account.username}. They can sign in again.`, id: account.account_id, done: "saved" };
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
    if (current === "admin" && (await activeAdminCount()) <= 1) return { error: "This is the last admin account; make someone else an admin first." };

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
    if (account.is_active === false) return { error: "Reactivate this account before sending it a link." };
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
 * Deleting is only for accounts with no data. Research and game data (handwriting samples, game sessions, quest
 * progress, achievements, items, validation decisions) keep an account; deactivate it instead.
 */
export async function deleteAccount(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async (me) => {
    const id = num(fd, "account_id");
    const account = id ? await Account.findOne({ account_id: id }).lean() : null;
    if (!account) return { error: "That account no longer exists." };
    if (id === me.id) return { error: "You can't delete your own account." };
    if (roleName(account.role_id) === "admin" && account.is_active !== false && (await activeAdminCount()) <= 1) {
      return { error: "You can't delete the last admin account." };
    }

    const [samples, sessions, progress, achievements, items, reviews] = await Promise.all([
      HandwritingSample.countDocuments({ account_id: id }),
      GameSession.countDocuments({ account_id: id }),
      PlayerQuestProgress.countDocuments({ account_id: id }),
      PlayerAchievement.countDocuments({ account_id: id }),
      PlayerItem.countDocuments({ account_id: id }),
      CharacterValidation.countDocuments({ account_id: id }),
    ]);
    if (samples || sessions || progress || achievements || items || reviews) {
      return {
        error: `Can't delete ${account.username}: research or game data belongs to it (${samples} sample(s), ${sessions} game session(s), ${progress + achievements + items} progress record(s), ${reviews} validation decision(s)). Deactivate the account instead.`,
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

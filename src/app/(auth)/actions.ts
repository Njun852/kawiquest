"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAccount, DuplicateAccountError } from "@/lib/auth/accounts";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  birthdaySchema,
  emailSchema,
  fieldErrorsOf,
  nameSchema,
  passwordSchema,
  safeNext,
  usernameSchema,
  type FormState,
} from "@/lib/auth/schemas";
import { endSession, revokeSessions, startSession } from "@/lib/auth/session";
import { findValidToken, issueToken, sendResetEmail } from "@/lib/auth/tokens";
import { roleName } from "@/lib/constants";
import { connectDb } from "@/lib/db";
import { Account, LoginThrottle } from "@/lib/models";

const NO_MATCH = "That email/username and password don't match.";
const LOCKED = "Too many tries. Wait a minute, then try again.";
const MAX_TRIES = 5;
const LOCK_MS = 60 * 1000;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const byIdentifier = (identifier: string) => (identifier.includes("@") ? { email: identifier } : { username: identifier });

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const identifier = text(fd, "identifier").trim().toLowerCase();
  const password = text(fd, "password");
  const values = { identifier };
  if (!identifier || !password) return { error: NO_MATCH, values };

  await connectDb();
  const account = await Account.findOne(byIdentifier(identifier)).lean();
  const throttle = account ? await LoginThrottle.findOne({ account_id: account.account_id }).lean() : null;
  if (throttle?.locked_until && throttle.locked_until.getTime() > Date.now()) return { error: LOCKED, values };

  const ok = await verifyPassword(password, account?.password_hash ?? null);
  if (!account || !ok) {
    if (account) {
      const t = await LoginThrottle.findOneAndUpdate(
        { account_id: account.account_id },
        { $inc: { failed_logins: 1 } },
        { upsert: true, returnDocument: "after" },
      );
      if (t.failed_logins >= MAX_TRIES) {
        await LoginThrottle.updateOne({ account_id: account.account_id }, { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MS) });
        return { error: LOCKED, values };
      }
    }
    return { error: NO_MATCH, values };
  }

  await LoginThrottle.deleteOne({ account_id: account.account_id });
  await startSession(account, fd.get("keep") === "on");
  redirect(safeNext(text(fd, "next"), roleName(account.role_id)!));
}

const signUpSchema = z
  .object({
    role: z.enum(["player", "contributor"], { error: "Choose what you want to do." }),
    first_name: nameSchema("first name"),
    last_name: nameSchema("last name"),
    birthday: birthdaySchema,
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirm: z.string(),
    agree: z.literal("on", { error: "Agree to the terms to create an account." }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

const SIGN_UP_FIELDS = ["role", "first_name", "last_name", "birthday", "email", "username", "password", "confirm", "agree"];
const TAKEN = {
  email: "That email already has an account. Sign in instead.",
  username: "That username is taken.",
};

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = Object.fromEntries(SIGN_UP_FIELDS.map((k) => [k, fd.get(k) ?? undefined]));
  const values = Object.fromEntries(["role", "first_name", "last_name", "birthday", "email", "username"].map((k) => [k, text(fd, k)]));
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const { role, email, username, password, first_name, last_name, birthday } = parsed.data;

  await connectDb();
  const [emailTaken, usernameTaken] = await Promise.all([Account.exists({ email }), Account.exists({ username })]);
  if (emailTaken || usernameTaken) {
    return { fieldErrors: { ...(emailTaken && { email: TAKEN.email }), ...(usernameTaken && { username: TAKEN.username }) }, values };
  }

  let account;
  try {
    account = await createAccount({ role, username, email, password_hash: await hashPassword(password), first_name, last_name, birthday });
  } catch (err) {
    // Someone took the email or username between the check and the insert.
    if (err instanceof DuplicateAccountError) return { fieldErrors: { [err.field]: TAKEN[err.field] }, values };
    throw err;
  }

  await startSession(account, false);
  redirect(safeNext(null, role));
}

export async function signOut() {
  await endSession();
  redirect("/sign-in");
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const identifier = text(fd, "identifier").trim().toLowerCase();
  if (!identifier) return { fieldErrors: { identifier: "Enter your email or username." } };

  await connectDb();
  const account = await Account.findOne(byIdentifier(identifier)).lean();
  if (account) {
    const token = await issueToken(account.account_id, "reset");
    await sendResetEmail(account.email, account.username, token);
  }
  // Same answer either way, so this form can't be used to find out who has an account.
  return { success: "If an account matches, we've sent a link to its email. It expires in 30 minutes.", values: { identifier } };
}

const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

const LINK_DEAD = "This link has expired or was already used. Ask for a new one.";

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ token: text(fd, "token"), password: text(fd, "password"), confirm: text(fd, "confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  await connectDb();
  const token = await findValidToken(parsed.data.token);
  if (!token) return { error: LINK_DEAD };
  const updated = await Account.updateOne({ account_id: token.account_id }, { password_hash: await hashPassword(parsed.data.password) });
  if (updated.matchedCount === 0) return { error: LINK_DEAD };

  token.used_at = new Date();
  await token.save();
  await LoginThrottle.deleteOne({ account_id: token.account_id });
  await revokeSessions(token.account_id);

  redirect("/sign-in?reset=1");
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  birthdaySchema,
  emailSchema,
  fieldErrorsOf,
  nameSchema,
  passwordSchema,
  usernameSchema,
  type FormState,
} from "@/lib/auth/schemas";
import { requireAccount, revokeSessions } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { Account } from "@/lib/models";

const profileSchema = z.object({
  first_name: nameSchema("first name"),
  last_name: nameSchema("last name"),
  // Staff accounts may have no birthday on file; leaving it empty keeps it empty.
  birthday: z.union([z.literal("").transform(() => null), birthdaySchema]),
  username: usernameSchema,
  email: emailSchema,
  current: z.string(),
});
const PROFILE_FIELDS = ["first_name", "last_name", "birthday", "username", "email"];

async function saveProfile(fd: FormData): Promise<FormState> {
  const me = await requireAccount();
  const values = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = profileSchema.safeParse({ ...values, current: fd.get("current") ?? "" });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const { username, email, current, first_name, last_name, birthday } = parsed.data;

  await connectDb();
  const account = await Account.findOne({ account_id: me.id });
  if (!account) return { error: "Your account could not be found. Sign in again." };

  // Changing the email changes where password resets go, so it needs the current password.
  if (email !== account.email && !(await verifyPassword(current, account.password_hash))) {
    return { fieldErrors: { current: "Enter your current password to change your email." }, values };
  }

  const others = { account_id: { $ne: account.account_id } };
  const [emailTaken, usernameTaken] = await Promise.all([
    email !== account.email && Account.exists({ email, ...others }),
    username !== account.username && Account.exists({ username, ...others }),
  ]);
  if (emailTaken || usernameTaken) {
    return {
      fieldErrors: {
        ...(emailTaken && { email: "That email already has an account." }),
        ...(usernameTaken && { username: "That username is taken." }),
      },
      values,
    };
  }

  Object.assign(account, { username, email, first_name, last_name, birthday });
  await account.save();
  return { success: "Saved.", values: { ...values, username, email } };
}

const passwordChangeSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

async function savePassword(fd: FormData): Promise<FormState> {
  const me = await requireAccount();
  const parsed = passwordChangeSchema.safeParse({
    current: fd.get("current") ?? "",
    password: fd.get("password") ?? "",
    confirm: fd.get("confirm") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  await connectDb();
  const account = await Account.findOne({ account_id: me.id });
  if (!account || !(await verifyPassword(parsed.data.current, account.password_hash))) {
    return { fieldErrors: { current: "That isn't your current password." } };
  }
  account.password_hash = await hashPassword(parsed.data.password);
  await account.save();
  // Sign out every other browser; this one stays signed in.
  await revokeSessions(account.account_id, me.sessionId);
  return { success: "Password changed. You've been signed out everywhere else." };
}

// Both actions refresh the page on every outcome: the header shows the username, and the page re-render
// after a non-revalidating action otherwise trips a Next.js 16 dev-mode cookies invariant.
export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    return await saveProfile(fd);
  } finally {
    refresh();
  }
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    return await savePassword(fd);
  } finally {
    refresh();
  }
}

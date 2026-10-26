import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { roleName, type Role } from "../constants";
import { connectDb } from "../db";
import { Account, Session, type IAccount } from "../models";
import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE } from "./cookie";
import { LANDING } from "./routes";

// The data access layer for "who is signed in". Every page and action asks here; nothing trusts the cookie alone.

const SHORT_MS = 12 * 60 * 60 * 1000; // browser session: 12 hours
const LONG_MS = 30 * 24 * 60 * 60 * 1000; // "Keep me signed in": 30 days

/** The narrow view of an account that pages and client components may see. No hash, no lock state. */
export type CurrentAccount = {
  /** accounts.account_id — also the anonymous ID shown to validators. */
  id: number;
  sessionId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday: string | null; // yyyy-mm-dd
  role: Role;
};

export async function startSession(account: Pick<IAccount, "account_id" | "role_id">, persistent: boolean) {
  const role = roleName(account.role_id);
  if (!role) throw new Error(`Unknown role_id ${account.role_id}`);
  await connectDb();
  const expires = new Date(Date.now() + (persistent ? LONG_MS : SHORT_MS));
  const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  const session = await Session.create({
    account_id: account.account_id,
    role,
    persistent,
    expires_at: expires,
    user_agent: userAgent,
  });
  (await cookies()).set(
    SESSION_COOKIE,
    encodeSessionCookie({ sid: session._id.toHexString(), role, exp: Math.floor(expires.getTime() / 1000) }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // No expiry = cleared when the browser closes; the server row still expires after 12 hours.
      expires: persistent ? expires : undefined,
    },
  );
}

/** The signed-in account for this request, or null. Deduplicated per request. */
export const getCurrentAccount = cache(async (): Promise<CurrentAccount | null> => {
  await connection(); // expiry checks compare against the current time: always request-time
  const payload = decodeSessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  await connectDb();
  const session = await Session.findById(payload.sid).lean();
  if (!session || session.expires_at.getTime() <= Date.now()) return null;
  const account = await Account.findOne({ account_id: session.account_id }).lean();
  // A deleted account or a role change by an admin ends the session.
  if (!account || roleName(account.role_id) !== payload.role) return null;
  return {
    id: account.account_id,
    sessionId: payload.sid,
    username: account.username,
    email: account.email,
    firstName: account.first_name,
    lastName: account.last_name,
    birthday: account.birthday ? account.birthday.toISOString().slice(0, 10) : null,
    role: payload.role,
  };
});

/**
 * The signed-in account, or a redirect: to sign-in (clearing a stale cookie) when there is none,
 * to the person's own landing page when their role isn't allowed here.
 */
export async function requireAccount(roles?: Role[]): Promise<CurrentAccount> {
  const account = await getCurrentAccount();
  if (!account) redirect("/api/auth/expired");
  if (roles && !roles.includes(account.role)) redirect(LANDING[account.role]);
  return account;
}

export async function endSession() {
  const jar = await cookies();
  const payload = decodeSessionCookie(jar.get(SESSION_COOKIE)?.value);
  if (payload) {
    await connectDb();
    await Session.deleteOne({ _id: payload.sid });
  }
  jar.delete(SESSION_COOKIE);
}

/** Sign an account out everywhere (password change or reset), optionally keeping the current browser. */
export async function revokeSessions(accountId: number, exceptSessionId?: string) {
  await connectDb();
  await Session.deleteMany({ account_id: accountId, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) });
}

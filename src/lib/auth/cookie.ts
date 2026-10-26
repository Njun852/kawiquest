import { createHmac, timingSafeEqual } from "node:crypto";
import { ROLES, type Role } from "../constants";

// The session cookie: "<sessionId>.<role>.<expiresAtSeconds>.<hmac>".
// The signature lets the proxy route by role without a database call. It is NOT the authority:
// pages and actions still load the session row, so revoking it (sign-out, password change,
// deactivation) takes effect immediately.
// Dependency-free on purpose: the proxy imports this file.

export const SESSION_COOKIE = "kq_session";

export type CookieSession = { sid: string; role: Role; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return s;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeSessionCookie({ sid, role, exp }: CookieSession) {
  const body = `${sid}.${role}.${exp}`;
  return `${body}.${sign(body)}`;
}

/** Returns the payload when the signature is valid and it hasn't expired; otherwise null. */
export function decodeSessionCookie(value: string | undefined, now = Date.now()): CookieSession | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [sid, role, expRaw, sig] = parts as [string, string, string, string];
  const expected = Buffer.from(sign(`${sid}.${role}.${expRaw}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
  if (!(ROLES as readonly string[]).includes(role) || !/^[0-9a-f]{24}$/.test(sid)) return null;
  return { sid, role: role as Role, exp };
}

import { createHash, randomBytes } from "node:crypto";
import { env } from "../env";
import { sendMail } from "../mail";
import { AuthToken, type TokenPurpose } from "../models";

const LIFETIME_MS: Record<TokenPurpose, number> = {
  reset: 30 * 60 * 1000, // 30 minutes
  invite: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Create a single-use link token; any earlier unused token of the same purpose stops working. */
export async function issueToken(accountId: number, purpose: TokenPurpose) {
  await AuthToken.deleteMany({ account_id: accountId, purpose, used_at: null });
  const token = randomBytes(32).toString("base64url");
  await AuthToken.create({
    account_id: accountId,
    purpose,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + LIFETIME_MS[purpose]),
  });
  return token;
}

export function passwordLink(token: string) {
  return `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

/** The token row if it is unused and unexpired. */
export async function findValidToken(token: string) {
  return AuthToken.findOne({ token_hash: hashToken(token), used_at: null, expires_at: { $gt: new Date() } });
}

export async function sendResetEmail(to: string, username: string, token: string) {
  await sendMail({
    to,
    subject: "Reset your KawiQuest password",
    text: `Hi ${username},\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n${passwordLink(token)}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

export async function sendInviteEmail(to: string, username: string, role: string, token: string) {
  await sendMail({
    to,
    subject: "Your KawiQuest staff account",
    text: `Hi ${username},\n\nAn admin created a KawiQuest ${role} account for you. Set your password with this link (valid for 7 days):\n${passwordLink(token)}`,
  });
}

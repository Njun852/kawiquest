/**
 * Create a staff account and send it a set-password link (printed to the console without RESEND_API_KEY).
 * This is how the first admin gets in; after that, admins create staff from the Accounts page.
 *
 *   npm run create-admin -- --email you@example.com --username your.name --first Juan --last "Dela Cruz" [--role validator]
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAccount } from "../src/lib/auth/accounts";
import { emailSchema, nameSchema, usernameSchema } from "../src/lib/auth/schemas";
import { issueToken, passwordLink, sendInviteEmail } from "../src/lib/auth/tokens";
import { ROLE_IDS, roleName } from "../src/lib/constants";
import { connectDb, disconnectDb } from "../src/lib/db";
import { Account } from "../src/lib/models";

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      username: { type: "string" },
      first: { type: "string" },
      last: { type: "string" },
      role: { type: "string", default: "admin" },
    },
  });
  const email = emailSchema.parse(values.email ?? "");
  const username = usernameSchema.parse(values.username ?? "");
  const first_name = nameSchema("first name").parse(values.first ?? "");
  const last_name = nameSchema("last name").parse(values.last ?? "");
  const role = values.role === "validator" ? "validator" : "admin";

  await connectDb();
  const existing = await Account.findOne({ $or: [{ email }, { username }] }).lean();
  // Re-running for someone who never set a password just sends a fresh link.
  if (existing && (existing.password_hash !== null || existing.role_id !== ROLE_IDS[role])) {
    throw new Error(`An account with that email or username already exists (${roleName(existing.role_id)}).`);
  }
  const account =
    existing ?? (await createAccount({ role, username, email, password_hash: null, first_name, last_name, birthday: null }));

  const token = await issueToken(account.account_id, "invite");
  await sendInviteEmail(account.email, account.username, role, token);
  console.log(`${existing ? "Re-invited" : "Created"} ${role} ${account.username} (account #${account.account_id}).`);
  console.log(`Set-password link (valid 7 days):\n${passwordLink(token)}`);
}

main()
  .catch((err) => {
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);

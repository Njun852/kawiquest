/**
 * Local testing only: one sign-in per role, with the username as the password.
 *
 *   npm run test-accounts
 *
 *   admin / admin            → /admin
 *   validator / validator    → /validator
 *   contributor / contributor → /contribute
 *   player / player          → /player
 *
 * Re-running resets these four passwords and roles. Refuses to run unless MONGODB_URI points at this computer,
 * so the weak passwords never reach a shared or production database.
 */
import { createAccount } from "../src/lib/auth/accounts";
import { hashPassword } from "../src/lib/auth/password";
import { ROLE_IDS, type Role } from "../src/lib/constants";
import { connectDb, disconnectDb } from "../src/lib/db";
import { env } from "../src/lib/env";
import { Account, LoginThrottle, PlayerProfile } from "../src/lib/models";

const TEST_ACCOUNTS: { role: Role; first: string }[] = [
  { role: "admin", first: "Test Admin" },
  { role: "validator", first: "Test Validator" },
  { role: "contributor", first: "Test Contributor" },
  { role: "player", first: "Test Player" },
];

function assertLocalDatabase() {
  const host = new URL(env.MONGODB_URI.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to create test accounts on ${host}: MONGODB_URI must point at localhost.`);
  }
}

async function main() {
  assertLocalDatabase();
  await connectDb();
  for (const { role, first } of TEST_ACCOUNTS) {
    const username = role;
    const email = `${role}@kawiquest.test`;
    const password_hash = await hashPassword(role);
    const existing = await Account.findOne({ $or: [{ username }, { email }] }).lean();
    if (existing) {
      await Account.updateOne({ account_id: existing.account_id }, { password_hash, role_id: ROLE_IDS[role] });
      await LoginThrottle.deleteMany({ account_id: existing.account_id });
      if (role === "player" && !(await PlayerProfile.exists({ account_id: existing.account_id }))) {
        await PlayerProfile.create({ account_id: existing.account_id, current_level: 1, tutorial_completed: false });
      }
      console.log(`Reset   ${username} / ${role}  (account #${existing.account_id})`);
    } else {
      const account = await createAccount({ role, username, email, password_hash, first_name: first, last_name: "Account", birthday: null });
      console.log(`Created ${username} / ${role}  (account #${account.account_id})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);

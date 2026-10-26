import { ROLE_IDS, type Role } from "../constants";
import { Account, nextId, PlayerProfile, type IAccount } from "../models";

export type NewAccount = {
  role: Role;
  username: string;
  email: string;
  password_hash: string | null;
  first_name: string;
  last_name: string;
  birthday: Date | null;
};

/** A duplicate username or email, reported by the unique index. */
export class DuplicateAccountError extends Error {
  constructor(public field: "username" | "email") {
    super(`That ${field} is already used.`);
  }
}

/**
 * Insert an account with the next account_id. A player also gets their player_profiles row
 * (first level, tutorial not done) so the game and the dashboard have something to read.
 */
export async function createAccount(input: NewAccount): Promise<IAccount> {
  const { role, ...rest } = input;
  const row: IAccount = {
    account_id: await nextId("accounts"),
    role_id: ROLE_IDS[role],
    registration_date: new Date(),
    ...rest,
  };
  try {
    await Account.create(row);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const key = Object.keys((err as { keyPattern?: object }).keyPattern ?? {})[0];
      if (key === "email" || key === "username") throw new DuplicateAccountError(key);
    }
    throw err;
  }
  if (role === "player") {
    await PlayerProfile.create({ account_id: row.account_id, current_level: 1, tutorial_completed: false });
  }
  return row;
}

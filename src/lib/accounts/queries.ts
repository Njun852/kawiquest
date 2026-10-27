import "server-only";
import type { Collection } from "mongoose";
import { roleName, type Role } from "../constants";
import { connectDb } from "../db";
import { Account, CharacterValidation, GameSession, HandwritingSample, PlayerQuestProgress } from "../models";

/** One account as the admin panel sees it. Never includes the password hash. */
export type AccountRow = {
  account_id: number;
  role: Role;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  birthday: string | null; // yyyy-mm-dd
  registered: string; // formatted for display
  registeredAt: string; // ISO, for sorting
  /** Invited staff who haven't set a password yet. */
  invited: boolean;
  samples: number;
  sessions: number;
  questProgress: number;
  /** Decisions recorded as a validator. */
  reviews: number;
};

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Manila" });

/** Rows per account_id in a collection that has an account_id column. */
async function countBy(collection: Collection) {
  const rows = await collection.aggregate<{ _id: number; n: number }>([{ $group: { _id: "$account_id", n: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

export async function loadAccounts(): Promise<AccountRow[]> {
  await connectDb();
  const [accounts, samples, sessions, progress, reviews] = await Promise.all([
    Account.find({}, { _id: 0 }).sort({ registration_date: -1 }).lean(),
    countBy(HandwritingSample.collection),
    countBy(GameSession.collection),
    countBy(PlayerQuestProgress.collection),
    countBy(CharacterValidation.collection),
  ]);
  return accounts.map((a) => ({
    account_id: a.account_id,
    role: roleName(a.role_id) ?? "player",
    username: a.username,
    email: a.email,
    first_name: a.first_name,
    last_name: a.last_name,
    birthday: a.birthday ? a.birthday.toISOString().slice(0, 10) : null,
    registered: dateFmt.format(a.registration_date),
    registeredAt: a.registration_date.toISOString(),
    invited: a.password_hash == null,
    samples: samples.get(a.account_id) ?? 0,
    sessions: sessions.get(a.account_id) ?? 0,
    questProgress: progress.get(a.account_id) ?? 0,
    reviews: reviews.get(a.account_id) ?? 0,
  }));
}

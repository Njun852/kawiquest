import "server-only";
import { INVENTORY_SIZE, ROLE_IDS, ROLES, TARGET_WRITERS, type Role } from "../constants";
import { connectDb } from "../db";
import { Account, HandwritingSample } from "../models";
import { validatedCharacterIds } from "../validation/queries";

// The admin landing page (FR1: "Access granted to the admin dashboard"): plain counts, no charts.

export type Dashboard = {
  accounts: Record<Role, number>;
  totalAccounts: number;
  validatedForms: number;
  inventory: number;
  writers: number;
  targetWriters: number;
  characterSamples: number;
  nonCharacterSamples: number;
};

export async function loadDashboard(): Promise<Dashboard> {
  await connectDb();
  const [byRole, validated, writers, characterSamples, nonCharacterSamples] = await Promise.all([
    Account.aggregate<{ _id: number; n: number }>([{ $group: { _id: "$role_id", n: { $sum: 1 } } }]),
    validatedCharacterIds(),
    HandwritingSample.distinct("account_id").then((ids) => ids.length),
    HandwritingSample.countDocuments({ is_non_character: false }),
    HandwritingSample.countDocuments({ is_non_character: true }),
  ]);
  const accounts = Object.fromEntries(ROLES.map((r) => [r, byRole.find((x) => x._id === ROLE_IDS[r])?.n ?? 0])) as Record<Role, number>;
  return {
    accounts,
    totalAccounts: Object.values(accounts).reduce((a, b) => a + b, 0),
    validatedForms: validated.size,
    inventory: INVENTORY_SIZE,
    writers,
    targetWriters: TARGET_WRITERS,
    characterSamples,
    nonCharacterSamples,
  };
}

import "server-only";
import { refresh } from "next/cache";
import type { FormState } from "./auth/schemas";
import { requireAccount, type CurrentAccount } from "./auth/session";
import type { Role } from "./constants";
import { connectDb } from "./db";
import { QuestTask } from "./models";

export type ActionResult = FormState & { id?: number; done?: "saved" | "deleted" };

/**
 * Run a server action for the given roles: checks the session first, then refreshes the page on every outcome
 * (shows the change, and avoids the Next.js 16 dev-mode cookies invariant after non-revalidating actions).
 */
export async function asRole(
  roles: Role[],
  run: (me: CurrentAccount) => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    const me = await requireAccount(roles);
    await connectDb();
    return await run(me);
  } finally {
    refresh();
  }
}

export const asAdmin = (run: (me: CurrentAccount) => Promise<ActionResult>) => asRole(["admin"], run);

/** Rewrite a quest's task list in the given order (task_order 1..n). */
export async function writeTasks(questId: number, characterIds: number[]) {
  await QuestTask.deleteMany({ quest_id: questId });
  if (characterIds.length) {
    await QuestTask.insertMany(characterIds.map((character_id, i) => ({ quest_id: questId, character_id, task_order: i + 1 })));
  }
}

export const num = (fd: FormData, key: string) => {
  const v = Number(fd.get(key));
  return Number.isInteger(v) && v > 0 ? v : null;
};
export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

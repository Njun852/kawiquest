"use server";

import { asAdmin, num, str, writeTasks, type ActionResult } from "@/lib/server-actions";
import { GameLevel, KawiCharacter, nextId, PlayerQuestProgress, Quest, QuestTask } from "@/lib/models";

/** True if making `parentId` the parent of `questId` would create a loop. */
async function wouldLoop(questId: number, parentId: number) {
  const parents = new Map((await Quest.find({}, { quest_id: 1, parent_quest_id: 1 }).lean()).map((q) => [q.quest_id, q.parent_quest_id]));
  for (let at: number | null | undefined = parentId, steps = 0; at != null && steps < 1000; at = parents.get(at), steps++) {
    if (at === questId) return true;
  }
  return false;
}

export async function saveQuest(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "quest_id");
    const values = {
      quest_name: str(fd, "quest_name"),
      level_id: str(fd, "level_id"),
      parent_quest_id: str(fd, "parent_quest_id"),
      quest_order: str(fd, "quest_order"),
    };
    const quest_name = values.quest_name.trim();
    const level_id = Number(values.level_id);
    const parent_quest_id = values.parent_quest_id ? Number(values.parent_quest_id) : null;
    const quest_order = Number(values.quest_order);
    let tasks: number[];
    try {
      tasks = JSON.parse(str(fd, "tasks") || "[]");
      if (!Array.isArray(tasks) || !tasks.every((t) => Number.isInteger(t))) throw new Error();
    } catch {
      return { error: "The task list could not be read. Reload the page and try again.", values };
    }

    const fieldErrors: Record<string, string> = {};
    if (!quest_name) fieldErrors.quest_name = "Enter the quest name.";
    else if (quest_name.length > 100) fieldErrors.quest_name = "Use at most 100 characters.";
    if (!(await GameLevel.exists({ level_id }))) fieldErrors.level_id = "Choose a level.";
    if (!Number.isInteger(quest_order) || quest_order < 1 || quest_order > 999) fieldErrors.quest_order = "Use a whole number from 1 to 999.";
    if (parent_quest_id != null) {
      if (!(await Quest.exists({ quest_id: parent_quest_id }))) fieldErrors.parent_quest_id = "Choose an existing quest.";
      else if (id && (parent_quest_id === id || (await wouldLoop(id, parent_quest_id)))) {
        fieldErrors.parent_quest_id = "A quest can't sit under itself or one of its own sub-quests.";
      }
    }
    if (new Set(tasks).size !== tasks.length) fieldErrors.tasks = "A character can appear only once in a quest.";
    else if (tasks.length && (await KawiCharacter.countDocuments({ character_id: { $in: tasks } })) !== tasks.length) {
      fieldErrors.tasks = "Some characters no longer exist. Reload the page.";
    }
    if (Object.keys(fieldErrors).length) return { fieldErrors, values };

    const row = { quest_name, level_id, parent_quest_id, quest_order };
    let questId = id;
    if (id) {
      const res = await Quest.updateOne({ quest_id: id }, row, { runValidators: true });
      if (!res.matchedCount) return { error: "That quest no longer exists." };
    } else {
      questId = await nextId("quests");
      await Quest.create({ quest_id: questId, ...row });
    }
    await writeTasks(questId!, tasks);
    return { success: `${id ? "Saved" : "Added"} ${quest_name} with ${tasks.length} task(s).`, id: questId!, done: "saved" };
  });
}

export async function deleteQuest(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "quest_id");
    const quest = id ? await Quest.findOne({ quest_id: id }).lean() : null;
    if (!quest) return { error: "That quest no longer exists." };
    const [children, progress] = await Promise.all([
      Quest.countDocuments({ parent_quest_id: id }),
      PlayerQuestProgress.countDocuments({ quest_id: id }),
    ]);
    if (children) return { error: `Can't delete ${quest.quest_name}: ${children} sub-quest(s) sit under it. Move or delete them first.` };
    if (progress) return { error: `Can't delete ${quest.quest_name}: ${progress} player(s) have progress on it.` };
    await QuestTask.deleteMany({ quest_id: id });
    await Quest.deleteOne({ quest_id: id });
    return { success: `Deleted ${quest.quest_name} and its task list.`, done: "deleted" };
  });
}

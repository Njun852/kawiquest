"use server";

import { asAdmin, num, str, type ActionResult } from "@/lib/server-actions";
import { GameLevel, GameSession, nextId, Quest } from "@/lib/models";

export async function saveLevel(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "level_id");
    const values = { area_name: str(fd, "area_name"), level_order: str(fd, "level_order") };
    const area_name = values.area_name.trim();
    const level_order = Number(values.level_order);
    const fieldErrors: Record<string, string> = {};
    if (!area_name) fieldErrors.area_name = "Enter the area name.";
    else if (area_name.length > 100) fieldErrors.area_name = "Use at most 100 characters.";
    if (!Number.isInteger(level_order) || level_order < 1 || level_order > 999) fieldErrors.level_order = "Use a whole number from 1 to 999.";
    if (Object.keys(fieldErrors).length) return { fieldErrors, values };

    if (id) {
      const res = await GameLevel.updateOne({ level_id: id }, { area_name, level_order });
      if (!res.matchedCount) return { error: "That level no longer exists." };
      return { success: `Saved ${area_name}.`, id, done: "saved" };
    }
    const level_id = await nextId("game_levels");
    await GameLevel.create({ level_id, area_name, level_order });
    return { success: `Added ${area_name}.`, id: level_id, done: "saved" };
  });
}

export async function deleteLevel(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "level_id");
    const level = id ? await GameLevel.findOne({ level_id: id }).lean() : null;
    if (!level) return { error: "That level no longer exists." };
    const [quests, sessions] = await Promise.all([Quest.countDocuments({ level_id: id }), GameSession.countDocuments({ level_id: id })]);
    if (quests || sessions) {
      return {
        error: `Can't delete ${level.area_name}: ${quests} quest(s) and ${sessions} game session(s) refer to it. Move its quests to another level first.`,
      };
    }
    await GameLevel.deleteOne({ level_id: id });
    return { success: `Deleted ${level.area_name}.`, done: "deleted" };
  });
}

import "server-only";
import { connectDb } from "../db";
import { Category, GameLevel, KawiCharacter, Quest, QuestTask } from "../models";
import { formOf } from "./forms";

// Reads for the admin curriculum pages. Everything comes back as plain objects (no Mongo _id), so it can be
// passed straight to client components.

const noId = { _id: 0 } as const;

export type CharacterRow = {
  character_id: number;
  unicode_codepoint: string;
  name: string;
  transliteration: string;
  category_id: number;
  base_letter: string | null;
  reference_glyph: string | null;
  /** Derived: what to draw. */
  form: string;
};

export type LevelRow = { level_id: number; level_order: number; area_name: string };
export type QuestRow = { quest_id: number; level_id: number; parent_quest_id: number | null; quest_name: string; quest_order: number };
export type TaskRow = { quest_id: number; character_id: number; task_order: number };
export type CategoryRow = { category_id: number; category_name: string };

export type Curriculum = {
  categories: CategoryRow[];
  characters: CharacterRow[];
  levels: LevelRow[];
  quests: QuestRow[];
  tasks: TaskRow[];
};

export async function loadCurriculum(): Promise<Curriculum> {
  await connectDb();
  const [categories, characters, levels, quests, tasks] = await Promise.all([
    Category.find({}, noId).sort({ category_id: 1 }).lean(),
    KawiCharacter.find({}, noId).sort({ character_id: 1 }).lean(),
    GameLevel.find({}, noId).sort({ level_order: 1, level_id: 1 }).lean(),
    Quest.find({}, noId).sort({ quest_order: 1, quest_id: 1 }).lean(),
    QuestTask.find({}, noId).sort({ quest_id: 1, task_order: 1 }).lean(),
  ]);
  return {
    categories,
    characters: characters.map((c) => ({ ...c, form: formOf(c) })),
    levels,
    quests,
    tasks,
  };
}

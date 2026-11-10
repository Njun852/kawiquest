/**
 * Seed the ERD's lookup and curriculum tables and build every index.
 *
 *   npm run seed            insert missing rows; never overwrites admin edits
 *   npm run seed -- --reset replace roles, categories, levels, characters, quests and quest tasks with the seed,
 *                           remove curriculum rows the seed doesn't have, and drop old-format validation rows
 *                           (accounts, samples and game data untouched)
 */
import type { Model } from "mongoose";
import { CATEGORIES, INVENTORY_SIZE } from "../src/lib/constants";
import { categories, gameLevels, kawiCharacters, quests, questTasks, roles } from "../src/lib/curriculum/seed-data";
import { connectDb, disconnectDb } from "../src/lib/db";
import {
  Account,
  allModels,
  bumpCounter,
  Category,
  CharacterValidation,
  GameLevel,
  HandwritingSample,
  KawiCharacter,
  PlayerAttempt,
  Quest,
  QuestTask,
  Role,
} from "../src/lib/models";

const reset = process.argv.includes("--reset");

function checkInventory() {
  if (kawiCharacters.length !== INVENTORY_SIZE) throw new Error(`Expected ${INVENTORY_SIZE} forms, got ${kawiCharacters.length}`);
  for (const c of CATEGORIES) {
    const n = kawiCharacters.filter((k) => k.category_id === c.id).length;
    if (n !== c.count) throw new Error(`${c.name}: expected ${c.count}, got ${n}`);
  }
  // Characters per world (design system): Lost Temple 13, Lantern Spirits 34, Playground 10, Industrials 16,
  // School 14 (conjoiner + 13 punctuation).
  const expected: Record<number, number> = { 1: 0, 2: 13, 3: 34, 4: 10, 5: 16, 6: 14, 7: 0 };
  for (const q of quests) {
    const n = questTasks.filter((t) => t.quest_id === q.quest_id).length;
    if (n !== expected[q.quest_id]) throw new Error(`${q.quest_name}: expected ${expected[q.quest_id]} tasks, got ${n}`);
  }
  if (new Set(questTasks.map((t) => t.character_id)).size !== INVENTORY_SIZE) throw new Error("Every character must be a task of exactly one quest");
  const questIds = new Set(quests.map((q) => q.quest_id));
  for (const q of quests) {
    if (q.parent_quest_id != null && (!questIds.has(q.parent_quest_id) || q.parent_quest_id === q.quest_id)) {
      throw new Error(`${q.quest_name}: parent_quest_id ${q.parent_quest_id} is not another quest`);
    }
  }
}

/**
 * Upsert rows by their primary key column (or a compound key for quest_tasks). `keep` lists columns that --reset
 * leaves alone on existing rows (data entered in the app, such as a validator's corrected reference image).
 */
async function seed<T extends object>(model: Model<T>, rows: T[], key: (keyof T)[], counter?: string, keep: (keyof T)[] = []) {
  const ops = rows.map((r) => {
    const filter = Object.fromEntries(key.map((k) => [k, r[k]]));
    if (!reset) return { updateOne: { filter, update: { $setOnInsert: r }, upsert: true } };
    if (!keep.length) return { replaceOne: { filter, replacement: r, upsert: true } };
    const entries = Object.entries(r) as [keyof T & string, unknown][];
    const $set = Object.fromEntries(entries.filter(([k]) => !keep.includes(k)));
    const $setOnInsert = Object.fromEntries(entries.filter(([k]) => keep.includes(k)));
    return { updateOne: { filter, update: { $set, $setOnInsert }, upsert: true } };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bulkWrite's generic op type doesn't narrow from Model<T>
  const res = await model.bulkWrite(ops as any, { ordered: true });
  if (counter) await bumpCounter(counter, Math.max(...rows.map((r) => r[key[0]!] as number)));
  return { inserted: res.upsertedCount, replaced: reset ? res.modifiedCount : 0 };
}

/**
 * --reset only: drop curriculum rows the seed no longer has (the 20 ligatures and their category, removed to
 * match the manuscript's 87 characters), and validation rows from the old sample-review format.
 */
async function removeOutsideSeed() {
  const keepChars = kawiCharacters.map((c) => c.character_id);
  const gone = await KawiCharacter.find({ character_id: { $nin: keepChars } }, { _id: 0, character_id: 1 }).lean();
  const goneIds = gone.map((c) => c.character_id);
  if (goneIds.length) {
    const [samples, attempts] = await Promise.all([
      HandwritingSample.countDocuments({ character_id: { $in: goneIds } }),
      PlayerAttempt.countDocuments({ character_id: { $in: goneIds } }),
    ]);
    await KawiCharacter.deleteMany({ character_id: { $in: goneIds } });
    console.log(`Removed ${goneIds.length} character(s) not in the seed: ${goneIds.join(", ")}`);
    if (samples || attempts) {
      console.warn(`  ${samples} handwriting sample(s) and ${attempts} player attempt(s) still refer to them; they are left as they are.`);
    }
  }
  const cats = await Category.deleteMany({ category_id: { $nin: categories.map((c) => c.category_id) } });
  if (cats.deletedCount) console.log(`Removed ${cats.deletedCount} category row(s) not in the seed`);
  // character_validations used to record decisions on handwriting samples (sample_id); it now records the
  // Expert Validator's decisions on reference forms (character_id). Old-format rows can't be read any more.
  const old = await CharacterValidation.collection.deleteMany({ character_id: { $exists: false } });
  if (old.deletedCount) console.log(`Removed ${old.deletedCount} old sample-review row(s) from character_validations`);
}

async function main() {
  checkInventory();
  const conn = await connectDb();
  console.log(`Connected to ${conn.connection.host}/${conn.connection.name}${reset ? " (reset)" : ""}`);

  for (const model of allModels) await model.syncIndexes();
  console.log(`Indexes synced on ${allModels.length} collections`);

  // accounts.is_active (added 2026-11-10): accounts created before it are active.
  const activated = await Account.updateMany({ is_active: { $exists: false } }, { $set: { is_active: true } });
  if (activated.modifiedCount) console.log(`Marked ${activated.modifiedCount} existing account(s) active`);

  if (reset) {
    await QuestTask.deleteMany({}); // the task list is replaced as a whole
    await removeOutsideSeed();
  }

  const results = {
    roles: await seed(Role, roles, ["role_id"], "roles"),
    categories: await seed(Category, categories, ["category_id"], "categories"),
    game_levels: await seed(GameLevel, gameLevels, ["level_id"], "game_levels"),
    kawi_characters: await seed(KawiCharacter, kawiCharacters, ["character_id"], "kawi_characters", ["reference_glyph"]),
    quests: await seed(Quest, quests, ["quest_id"], "quests"),
    quest_tasks: await seed(QuestTask, questTasks, ["quest_id", "character_id"]),
  };

  // The code refers to roles and categories by fixed id (src/lib/constants.ts): make sure the tables agree.
  for (const r of roles) {
    const found = await Role.findOne({ role_id: r.role_id }).lean();
    if (found?.role_name !== r.role_name) throw new Error(`roles: role_id ${r.role_id} should be "${r.role_name}", found "${found?.role_name}"`);
  }

  const models = [Role, Category, GameLevel, KawiCharacter, Quest, QuestTask] as Model<unknown>[];
  const counts = await Promise.all(models.map(async (m) => [m.collection.name, await m.countDocuments()] as const));
  console.table(counts.map(([name, total]) => ({ table: name, total, ...results[name as keyof typeof results] })));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);

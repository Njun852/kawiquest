import { Schema } from "mongoose";
import { defineModel, erdOptions, pk } from "./_model";

// ERD: categories, kawi_characters, game_levels, quests, quest_tasks.

export interface ICategory {
  category_id: number;
  category_name: string;
}

const categorySchema = new Schema<ICategory>(
  { category_id: pk, category_name: { type: String, required: true, unique: true, trim: true, maxlength: 100 } },
  erdOptions,
);
export const Category = defineModel<ICategory>("Category", categorySchema, "categories");

export interface IKawiCharacter {
  character_id: number;
  /** "U+11F12" for one code point; "11F12 11F42 11F31" for a ligature (fits varchar(20)). */
  unicode_codepoint: string;
  /** Unicode name in caps without "KAWI (LETTER)": "KA", "VOWEL SIGN I", "KSA". */
  name: string;
  transliteration: string;
  category_id: number;
  /** Combining marks only: the letter they are written on ("KA"); null otherwise. */
  base_letter: string | null;
  /** Path of the validated reference glyph image; null until uploaded. */
  reference_glyph: string | null;
}

const kawiCharacterSchema = new Schema<IKawiCharacter>(
  {
    character_id: pk,
    unicode_codepoint: {
      type: String,
      required: true,
      unique: true,
      maxlength: 20,
      match: /^(U\+[0-9A-F]{4,5}|[0-9A-F]{4,5}( [0-9A-F]{4,5})+)$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    transliteration: { type: String, required: true, trim: true, maxlength: 100 },
    category_id: { type: Number, required: true, index: true },
    base_letter: { type: String, default: null, maxlength: 20 },
    reference_glyph: { type: String, default: null, maxlength: 255 },
  },
  erdOptions,
);
export const KawiCharacter = defineModel<IKawiCharacter>("KawiCharacter", kawiCharacterSchema, "kawi_characters");

export interface IGameLevel {
  level_id: number;
  level_order: number;
  area_name: string;
}

const gameLevelSchema = new Schema<IGameLevel>(
  {
    level_id: pk,
    level_order: { type: Number, required: true, index: true },
    area_name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  erdOptions,
);
export const GameLevel = defineModel<IGameLevel>("GameLevel", gameLevelSchema, "game_levels");

export interface IQuest {
  quest_id: number;
  level_id: number;
  /** The quest this one is part of (quests.quest_id); null for a top-level quest. */
  parent_quest_id: number | null;
  quest_name: string;
  quest_order: number;
}

const questSchema = new Schema<IQuest>(
  {
    quest_id: pk,
    level_id: { type: Number, required: true, index: true },
    parent_quest_id: { type: Number, default: null, index: true },
    quest_name: { type: String, required: true, trim: true, maxlength: 100 },
    quest_order: { type: Number, required: true },
  },
  erdOptions,
);
questSchema.path("parent_quest_id").validate(function (this: IQuest, v: number | null) {
  return v == null || v !== this.quest_id;
}, "A quest can't be its own parent.");
export const Quest = defineModel<IQuest>("Quest", questSchema, "quests");

/** The characters a quest asks for, in order. PK (quest_id, character_id). A character's level is the level of the quest it is a task of. */
export interface IQuestTask {
  quest_id: number;
  character_id: number;
  task_order: number;
}

const questTaskSchema = new Schema<IQuestTask>(
  {
    quest_id: { type: Number, required: true },
    character_id: { type: Number, required: true, index: true },
    task_order: { type: Number, required: true },
  },
  erdOptions,
);
questTaskSchema.index({ quest_id: 1, task_order: 1 }, { unique: true });
questTaskSchema.index({ quest_id: 1, character_id: 1 }, { unique: true });
export const QuestTask = defineModel<IQuestTask>("QuestTask", questTaskSchema, "quest_tasks");

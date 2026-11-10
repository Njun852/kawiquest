import { Schema } from "mongoose";
import { QUEST_STATUS_VALUES } from "../constants";
import { defineModel, erdOptions, pk } from "./_model";

// ERD: game_sessions, player_attempts, player_quest_progress — written by the game, read by the web.

export interface IGameSession {
  session_id: number;
  account_id: number;
  level_id: number;
  started_at: Date;
  ended_at: Date | null;
}

const sessionSchema = new Schema<IGameSession>(
  {
    session_id: pk,
    account_id: { type: Number, required: true },
    level_id: { type: Number, required: true },
    started_at: { type: Date, required: true },
    ended_at: { type: Date, default: null },
  },
  erdOptions,
);
sessionSchema.index({ account_id: 1, started_at: -1 });
export const GameSession = defineModel<IGameSession>("GameSession", sessionSchema, "game_sessions");

export interface IPlayerAttempt {
  attempt_id: number;
  session_id: number;
  character_id: number;
  accepted: boolean;
  attempted_at: Date;
}

const attemptSchema = new Schema<IPlayerAttempt>(
  {
    attempt_id: pk,
    session_id: { type: Number, required: true, index: true },
    character_id: { type: Number, required: true, index: true },
    accepted: { type: Boolean, required: true },
    attempted_at: { type: Date, required: true, index: true },
  },
  erdOptions,
);
export const PlayerAttempt = defineModel<IPlayerAttempt>("PlayerAttempt", attemptSchema, "player_attempts");

/** PK (account_id, quest_id). */
export interface IPlayerQuestProgress {
  account_id: number;
  quest_id: number;
  /** QUEST_STATUS in src/lib/constants.ts: 0 not started, 1 in progress, 2 completed. */
  status: number;
  completed_tasks: number;
  updated_at: Date;
}

const questProgressSchema = new Schema<IPlayerQuestProgress>(
  {
    account_id: { type: Number, required: true },
    quest_id: { type: Number, required: true },
    status: { type: Number, required: true, default: 0, enum: QUEST_STATUS_VALUES },
    completed_tasks: { type: Number, required: true, default: 0, min: 0 },
    updated_at: { type: Date, required: true, default: () => new Date() },
  },
  erdOptions,
);
questProgressSchema.index({ account_id: 1, quest_id: 1 }, { unique: true });
export const PlayerQuestProgress = defineModel<IPlayerQuestProgress>(
  "PlayerQuestProgress",
  questProgressSchema,
  "player_quest_progress",
);

// player_achievements and player_items — what FR7 shows on the player's dashboard. Written by the game through
// the sync API, read by the web. Added 2026-11-10 (Figure 6 keeps them in GameData as JSON).

/** PK (account_id, achievement_key). */
export interface IPlayerAchievement {
  account_id: number;
  /** The game's own id for the achievement, e.g. "first-inscription". */
  achievement_key: string;
  title: string;
  description: string | null;
  earned_at: Date;
}

const achievementSchema = new Schema<IPlayerAchievement>(
  {
    account_id: { type: Number, required: true },
    achievement_key: { type: String, required: true, trim: true, maxlength: 50 },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, trim: true, maxlength: 255 },
    earned_at: { type: Date, required: true, default: () => new Date() },
  },
  erdOptions,
);
achievementSchema.index({ account_id: 1, achievement_key: 1 }, { unique: true });
export const PlayerAchievement = defineModel<IPlayerAchievement>("PlayerAchievement", achievementSchema, "player_achievements");

/** PK (account_id, item_key). */
export interface IPlayerItem {
  account_id: number;
  item_key: string;
  item_name: string;
  quantity: number;
  acquired_at: Date;
}

const itemSchema = new Schema<IPlayerItem>(
  {
    account_id: { type: Number, required: true },
    item_key: { type: String, required: true, trim: true, maxlength: 50 },
    item_name: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: { type: Number, required: true, default: 1, min: 0 },
    acquired_at: { type: Date, required: true, default: () => new Date() },
  },
  erdOptions,
);
itemSchema.index({ account_id: 1, item_key: 1 }, { unique: true });
export const PlayerItem = defineModel<IPlayerItem>("PlayerItem", itemSchema, "player_items");

import { Schema } from "mongoose";
import { defineModel, erdOptions, pk } from "./_model";

// ERD: roles, accounts, player_profiles.

export interface IRole {
  role_id: number;
  role_name: string;
}

const roleSchema = new Schema<IRole>(
  { role_id: pk, role_name: { type: String, required: true, unique: true, trim: true, maxlength: 50 } },
  erdOptions,
);
export const Role = defineModel<IRole>("Role", roleSchema, "roles");

export interface IAccount {
  account_id: number;
  role_id: number;
  username: string;
  email: string;
  /** null until an invited staff member sets a password. */
  password_hash: string | null;
  first_name: string;
  last_name: string;
  birthday: Date | null;
  registration_date: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    account_id: pk,
    role_id: { type: Number, required: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 100 },
    password_hash: { type: String, default: null, maxlength: 255 },
    first_name: { type: String, required: true, trim: true, maxlength: 100 },
    last_name: { type: String, required: true, trim: true, maxlength: 100 },
    birthday: { type: Date, default: null },
    registration_date: { type: Date, required: true, default: () => new Date() },
  },
  erdOptions,
);
export const Account = defineModel<IAccount>("Account", accountSchema, "accounts");

/** One row per player account (ERD: player_profiles.account_id → accounts). */
export interface IPlayerProfile {
  account_id: number;
  current_level: number;
  tutorial_completed: boolean;
}

const playerProfileSchema = new Schema<IPlayerProfile>(
  {
    account_id: { type: Number, required: true, unique: true },
    current_level: { type: Number, required: true, default: 1 },
    tutorial_completed: { type: Boolean, required: true, default: false },
  },
  erdOptions,
);
export const PlayerProfile = defineModel<IPlayerProfile>("PlayerProfile", playerProfileSchema, "player_profiles");

import { Schema, type Types } from "mongoose";
import { ROLES, type Role } from "../constants";
import { defineModel } from "./_model";

// Sign-in plumbing. Not part of the ERD: these collections only keep people signed in and handle
// reset links and lockouts. They reference accounts.account_id.

const infraOptions = { versionKey: false, timestamps: { createdAt: "created_at", updatedAt: false } } as const;

/** One row per signed-in browser. */
export interface ISession {
  _id: Types.ObjectId;
  account_id: number;
  role: Role;
  /** "Keep me signed in": a 30-day persistent cookie instead of a browser-session one. */
  persistent: boolean;
  expires_at: Date;
  user_agent: string | null;
  created_at: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    account_id: { type: Number, required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    persistent: { type: Boolean, default: false },
    expires_at: { type: Date, required: true },
    user_agent: { type: String, default: null },
  },
  infraOptions,
);
sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // MongoDB removes expired rows
export const Session = defineModel<ISession>("Session", sessionSchema, "sessions");

export const TOKEN_PURPOSES = ["reset", "invite"] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

/** Single-use links for password reset and staff invites. Only a SHA-256 of the token is stored. */
export interface IAuthToken {
  _id: Types.ObjectId;
  account_id: number;
  purpose: TokenPurpose;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

const authTokenSchema = new Schema<IAuthToken>(
  {
    account_id: { type: Number, required: true },
    purpose: { type: String, enum: TOKEN_PURPOSES, required: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date, default: null },
  },
  infraOptions,
);
authTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
authTokenSchema.index({ account_id: 1, purpose: 1 });
export const AuthToken = defineModel<IAuthToken>("AuthToken", authTokenSchema, "auth_tokens");

/** Wrong-password counter: five misses lock sign-in for a minute. */
export interface ILoginThrottle {
  _id: Types.ObjectId;
  account_id: number;
  failed_logins: number;
  locked_until: Date | null;
}

const loginThrottleSchema = new Schema<ILoginThrottle>(
  {
    account_id: { type: Number, required: true, unique: true },
    failed_logins: { type: Number, default: 0 },
    locked_until: { type: Date, default: null },
  },
  { versionKey: false },
);
export const LoginThrottle = defineModel<ILoginThrottle>("LoginThrottle", loginThrottleSchema, "login_throttles");

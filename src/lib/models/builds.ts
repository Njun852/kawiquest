import { Schema, type Types } from "mongoose";
import { defineModel, erdOptions, pk } from "./_model";

// game_builds (FR3) — Android builds the super admin uploads; the active one is what players download.
// Added 2026-11-10 (Figure 6: GameBuild). The APK itself is a GridFS file in the "files" bucket.

export const BUILD_PLATFORMS = ["android"] as const;
export type BuildPlatform = (typeof BUILD_PLATFORMS)[number];

export interface IGameBuild {
  build_id: number;
  platform: BuildPlatform;
  /** As the game reports it, e.g. "0.4.2". Unique per platform. */
  version: string;
  /** Version of model.onnx this release expects (manuscript: recorded per release). */
  model_version: string | null;
  notes: string | null;
  /** GridFS filename, e.g. "builds/12-kawiquest-0.4.2.apk". */
  file_path: string;
  file_size: number;
  /** Exactly one active build per platform: the one served at /downloads/kawiquest.apk. */
  is_active: boolean;
  uploaded_at: Date;
  /** The admin's accounts.account_id. */
  uploaded_by: number;
}

const buildSchema = new Schema<IGameBuild>(
  {
    build_id: pk,
    platform: { type: String, required: true, enum: BUILD_PLATFORMS, default: "android" },
    version: { type: String, required: true, trim: true, maxlength: 20 },
    model_version: { type: String, default: null, trim: true, maxlength: 50 },
    notes: { type: String, default: null, trim: true, maxlength: 500 },
    file_path: { type: String, required: true, maxlength: 255 },
    file_size: { type: Number, required: true, min: 1 },
    is_active: { type: Boolean, required: true, default: false },
    uploaded_at: { type: Date, required: true, default: () => new Date() },
    uploaded_by: { type: Number, required: true },
  },
  erdOptions,
);
buildSchema.index({ platform: 1, version: 1 }, { unique: true });
buildSchema.index({ platform: 1, is_active: 1 });
export const GameBuild = defineModel<IGameBuild>("GameBuild", buildSchema, "game_builds");

// Upload plumbing (not part of the data model): an APK arrives in 4 MiB pieces, each written straight into
// GridFS as one chunk of a file that is registered when the last piece is in. Unfinished uploads expire.

export interface IBuildUpload {
  _id: Types.ObjectId;
  /** The GridFS file id the chunks are written under. */
  file_id: Types.ObjectId;
  account_id: number;
  filename: string;
  size: number;
  chunk_size: number;
  chunks: number;
  expires_at: Date;
  /** The build's details, entered before the upload starts. */
  meta: { version: string; model_version: string | null; notes: string | null; make_active: boolean };
}

const uploadSchema = new Schema<IBuildUpload>(
  {
    file_id: { type: Schema.Types.ObjectId, required: true },
    account_id: { type: Number, required: true },
    filename: { type: String, required: true, maxlength: 255 },
    size: { type: Number, required: true },
    chunk_size: { type: Number, required: true },
    chunks: { type: Number, required: true },
    expires_at: { type: Date, required: true },
    meta: {
      version: { type: String, required: true },
      model_version: { type: String, default: null },
      notes: { type: String, default: null },
      make_active: { type: Boolean, default: false },
    },
  },
  { versionKey: false },
);
uploadSchema.index({ expires_at: 1 });
export const BuildUpload = defineModel<IBuildUpload>("BuildUpload", uploadSchema, "build_uploads");

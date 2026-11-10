import { Schema } from "mongoose";
import { defineModel, erdOptions, pk } from "./_model";

// ERD: handwriting_samples — contributor writing collected on the web canvas.

export interface IHandwritingSample {
  sample_id: number;
  account_id: number;
  /** null for non-character samples (the reject class). */
  character_id: number | null;
  image_path: string;
  is_non_character: boolean;
}

const sampleSchema = new Schema<IHandwritingSample>(
  {
    sample_id: pk,
    account_id: { type: Number, required: true, index: true },
    character_id: { type: Number, default: null, index: true },
    image_path: { type: String, required: true, maxlength: 255 },
    is_non_character: { type: Boolean, required: true, default: false },
  },
  erdOptions,
);
sampleSchema.path("character_id").validate(function (this: IHandwritingSample, v: number | null) {
  return this.is_non_character ? v == null : v != null;
}, "A character sample needs a character_id; a non-character sample must not have one.");

export const HandwritingSample = defineModel<IHandwritingSample>("HandwritingSample", sampleSchema, "handwriting_samples");

// character_validations — the Expert Validator's decisions on each character's reference form (manuscript FR4:
// "mark it as approved or corrected with included remarks"). One row per decision; a character's current status
// is its latest row (no row = pending). Only validated forms are used in data collection.

export const VALIDATION_STATUSES = ["approved", "corrected"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export interface ICharacterValidation {
  validation_id: number;
  character_id: number;
  /** The validator's account. */
  account_id: number;
  status: ValidationStatus;
  /** Required when the form is marked corrected. */
  remarks: string | null;
  validated_at: Date;
}

const validationSchema = new Schema<ICharacterValidation>(
  {
    validation_id: pk,
    character_id: { type: Number, required: true },
    account_id: { type: Number, required: true },
    status: { type: String, required: true, enum: VALIDATION_STATUSES, maxlength: 20 },
    remarks: { type: String, default: null, trim: true, maxlength: 255 },
    validated_at: { type: Date, required: true, default: () => new Date() },
  },
  erdOptions,
);
validationSchema.path("remarks").validate(function (this: ICharacterValidation, v: string | null) {
  return this.status === "approved" || Boolean(v && v.trim());
}, "Remarks are required when a form is marked corrected.");
validationSchema.index({ character_id: 1, validation_id: -1 });
validationSchema.index({ account_id: 1, validated_at: -1 });

export const CharacterValidation = defineModel<ICharacterValidation>(
  "CharacterValidation",
  validationSchema,
  "character_validations",
);

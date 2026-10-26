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

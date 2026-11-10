"use server";

import { randomBytes } from "node:crypto";
import { asRole, num, str, type ActionResult } from "@/lib/server-actions";
import { CharacterValidation, KawiCharacter, nextId, VALIDATION_STATUSES, type ValidationStatus } from "@/lib/models";
import { deleteFile, putFile } from "@/lib/storage";

const WORD: Record<ValidationStatus, string> = { approved: "Approved", corrected: "Marked corrected" };
const GLYPH_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const GLYPH_MAX = 512 * 1024;

/**
 * FR4: record the Expert Validator's decision on a character's reference form. "Corrected" needs remarks and may
 * come with a corrected reference image, which replaces the current one.
 */
export async function decide(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asRole(["validator"], async (me) => {
    const characterId = num(fd, "character_id");
    const status = str(fd, "status") as ValidationStatus;
    const remarks = str(fd, "remarks").trim();
    const file = fd.get("glyph");
    const hasFile = file instanceof File && file.size > 0;

    if (!(VALIDATION_STATUSES as readonly string[]).includes(status)) return { error: "Choose approve or corrected." };
    if (status === "corrected" && !remarks) return { fieldErrors: { remarks: "Describe the correction in the remarks." } };
    if (remarks.length > 255) return { fieldErrors: { remarks: "Keep remarks under 255 characters." } };
    if (hasFile && status !== "corrected") return { error: "Attach a corrected image only when marking the form corrected." };
    const character = characterId ? await KawiCharacter.findOne({ character_id: characterId }).lean() : null;
    if (!character) return { error: "That character is no longer in the inventory." };

    let newGlyph: string | null = null;
    if (hasFile) {
      const ext = GLYPH_TYPES[file.type];
      if (!ext) return { fieldErrors: { glyph: "Use a PNG, JPEG, WebP or SVG image." } };
      if (file.size > GLYPH_MAX) return { fieldErrors: { glyph: "Use an image under 512 KB." } };
      newGlyph = `glyphs/${characterId}-${randomBytes(4).toString("hex")}.${ext}`;
      await putFile(newGlyph, new Uint8Array(await file.arrayBuffer()), file.type);
    }

    try {
      await CharacterValidation.create({
        validation_id: await nextId("character_validations"),
        character_id: character.character_id,
        account_id: me.id,
        status,
        remarks: remarks || null,
        validated_at: new Date(),
      });
    } catch (err) {
      if (newGlyph) await deleteFile(newGlyph);
      throw err;
    }

    if (newGlyph) {
      await KawiCharacter.updateOne({ character_id: characterId }, { reference_glyph: newGlyph });
      if (character.reference_glyph) await deleteFile(character.reference_glyph);
    }
    return { success: `${WORD[status]}: ${character.transliteration} · ${character.name}.`, id: character.character_id, done: "saved" };
  });
}

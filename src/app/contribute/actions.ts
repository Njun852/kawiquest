"use server";

import { asRole, num, str, type ActionResult } from "@/lib/server-actions";
import { HandwritingSample, KawiCharacter, nextId } from "@/lib/models";
import { encodeGrayPng } from "@/lib/png";
import { deleteFile, putFile } from "@/lib/storage";

/** The stored sample image: 50 × 50 grayscale (thesis: Dataset Development). */
const SIDE = 50;

/**
 * Save one handwriting sample. The browser sends the drawing as exactly 2,500 grayscale pixels; the server builds
 * the PNG, so nothing but a 50 × 50 image can be stored as a sample.
 */
export async function submitSample(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asRole(["contributor"], async (me) => {
    const nonCharacter = str(fd, "mode") === "non-character";
    const characterId = nonCharacter ? null : num(fd, "character_id");
    const pixels = fd.get("pixels");

    if (!(pixels instanceof Blob) || pixels.size !== SIDE * SIDE) return { error: "The drawing didn't arrive. Try again." };
    const data = new Uint8Array(await pixels.arrayBuffer());
    // Blank-canvas guard (the client checks too): some pixel must be clearly darker than the paper.
    if (!data.some((v) => v < 160)) return { error: "Draw the character first." };
    if (!nonCharacter && (!characterId || !(await KawiCharacter.exists({ character_id: characterId })))) {
      return { error: "That character is no longer in the inventory. Reload the page." };
    }

    const sample_id = await nextId("handwriting_samples");
    const image_path = `samples/${me.id}/${sample_id}.png`;
    await putFile(image_path, encodeGrayPng(SIDE, SIDE, data), "image/png");
    try {
      await HandwritingSample.create({ sample_id, account_id: me.id, character_id: characterId, image_path, is_non_character: nonCharacter });
    } catch (err) {
      await deleteFile(image_path);
      throw err;
    }
    return { success: nonCharacter ? "Saved. Draw another non-character, or switch back." : "Saved. Here's the next one.", id: sample_id, done: "saved" };
  });
}

/** Contributors may remove their own samples (a slip of the pen); nobody else's. */
export async function deleteOwnSample(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asRole(["contributor"], async (me) => {
    const id = num(fd, "sample_id");
    const sample = id ? await HandwritingSample.findOne({ sample_id: id, account_id: me.id }).lean() : null;
    if (!sample) return { error: "That sample is already gone." };
    await HandwritingSample.deleteOne({ sample_id: id });
    await deleteFile(sample.image_path);
    return { success: "Sample removed.", done: "deleted" };
  });
}

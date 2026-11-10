"use server";

import { asRole, num, str, type ActionResult } from "@/lib/server-actions";
import { HandwritingSample, KawiCharacter, nextId } from "@/lib/models";
import { encodeGrayPng } from "@/lib/png";
import { deleteFile, putFile, strokePathOf } from "@/lib/storage";
import { validatedCharacterIds } from "@/lib/validation/queries";

/** The stored sample image: 50 × 50 grayscale (thesis: Dataset Development). */
const SIDE = 50;
const DEVICES = ["mouse", "stylus", "finger"] as const;
const MAX_STROKE_JSON = 64 * 1024;
const MAX_POINTS = 5000;

type StrokeRecord = { strokes: [number, number][][]; device: (typeof DEVICES)[number] | null };

/** The canvas's strokes: point lists in 0–1 coordinates. Anything else is refused. */
function parseStrokes(raw: FormDataEntryValue | null, deviceRaw: string): StrokeRecord | null {
  if (typeof raw !== "string" || raw.length > MAX_STROKE_JSON) return null;
  let strokes: unknown;
  try {
    strokes = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(strokes) || strokes.length === 0 || strokes.length > 200) return null;
  let points = 0;
  for (const s of strokes) {
    if (!Array.isArray(s) || s.length === 0) return null;
    for (const p of s) {
      points++;
      if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === "number" && v >= 0 && v <= 1)) return null;
    }
  }
  if (points > MAX_POINTS) return null;
  const device = (DEVICES as readonly string[]).includes(deviceRaw) ? (deviceRaw as StrokeRecord["device"]) : null;
  return { strokes: strokes as StrokeRecord["strokes"], device };
}

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
    const record = parseStrokes(fd.get("strokes"), str(fd, "device"));
    if (!record) return { error: "The drawing didn't arrive. Try again." };
    if (!nonCharacter && (!characterId || !(await KawiCharacter.exists({ character_id: characterId })))) {
      return { error: "That character is no longer in the inventory. Reload the page." };
    }
    if (!nonCharacter && !(await validatedCharacterIds()).has(characterId!)) {
      return { error: "That reference form hasn't been validated yet. Reload the page." };
    }

    const sample_id = await nextId("handwriting_samples");
    const image_path = `samples/${me.id}/${sample_id}.png`;
    // The stroke record sits beside the PNG (manuscript: each sample is stored as stroke JSON and a 50 × 50 PNG).
    const stroke_path = strokePathOf(image_path);
    const strokeJson = JSON.stringify({
      format: "kawiquest-strokes/1",
      sample_id,
      account_id: me.id,
      character_id: characterId,
      is_non_character: nonCharacter,
      input_method: record.device,
      coordinates: "unit square: x right, y down, 0–1",
      submitted_at: new Date().toISOString(),
      strokes: record.strokes.map((s) => s.map(([x, y]) => [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000])),
    });
    await putFile(image_path, encodeGrayPng(SIDE, SIDE, data), "image/png");
    await putFile(stroke_path, new TextEncoder().encode(strokeJson), "application/json");
    try {
      await HandwritingSample.create({ sample_id, account_id: me.id, character_id: characterId, image_path, is_non_character: nonCharacter });
    } catch (err) {
      await Promise.all([deleteFile(image_path), deleteFile(stroke_path)]);
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
    await Promise.all([deleteFile(sample.image_path), deleteFile(strokePathOf(sample.image_path))]);
    return { success: "Sample removed.", done: "deleted" };
  });
}

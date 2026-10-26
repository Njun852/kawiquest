"use server";

import { randomBytes } from "node:crypto";
import { asAdmin, num, str, writeTasks, type ActionResult } from "@/lib/server-actions";
import { validateCharacter, type CharacterValues } from "@/lib/curriculum/validate";
import { parseCsv } from "@/lib/csv";
import { Category, HandwritingSample, KawiCharacter, nextId, PlayerAttempt, QuestTask } from "@/lib/models";
import { deleteFile, putFile } from "@/lib/storage";

const FIELDS = ["unicode_codepoint", "name", "transliteration", "category_id", "base_letter"] as const;

async function categoryIds() {
  return new Set((await Category.find({}, { category_id: 1 }).lean()).map((c) => c.category_id));
}

export async function saveCharacter(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "character_id");
    const values = Object.fromEntries(FIELDS.map((k) => [k, str(fd, k)])) as Record<(typeof FIELDS)[number], string>;
    const result = validateCharacter(values, await categoryIds());
    if (!result.ok) return { fieldErrors: result.fieldErrors, values };

    const clash = await KawiCharacter.findOne({ unicode_codepoint: result.value.unicode_codepoint, ...(id && { character_id: { $ne: id } }) }).lean();
    if (clash) return { fieldErrors: { unicode_codepoint: `Already used by #${clash.character_id} ${clash.name}.` }, values };

    if (id) {
      const res = await KawiCharacter.updateOne({ character_id: id }, result.value, { runValidators: true });
      if (!res.matchedCount) return { error: "That character no longer exists. Close the drawer and try again." };
      return { success: `Saved #${id} ${result.value.name}.`, id, done: "saved" };
    }
    const character_id = await nextId("kawi_characters");
    await KawiCharacter.create({ character_id, ...result.value, reference_glyph: null });
    return { success: `Added #${character_id} ${result.value.name}. Add it to a quest so the game teaches it.`, id: character_id, done: "saved" };
  });
}

export async function deleteCharacter(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "character_id");
    const character = id ? await KawiCharacter.findOne({ character_id: id }).lean() : null;
    if (!character) return { error: "That character no longer exists." };

    // Samples and attempts are research data: never orphan them.
    const [samples, attempts] = await Promise.all([
      HandwritingSample.countDocuments({ character_id: id }),
      PlayerAttempt.countDocuments({ character_id: id }),
    ]);
    if (samples || attempts) {
      return {
        error: `Can't delete ${character.name}: ${samples} handwriting sample(s) and ${attempts} player attempt(s) refer to it.`,
      };
    }

    // Remove it from every quest, closing the gap in each task list.
    const quests = await QuestTask.distinct("quest_id", { character_id: id });
    for (const questId of quests) {
      const rest = await QuestTask.find({ quest_id: questId, character_id: { $ne: id } }).sort({ task_order: 1 }).lean();
      await writeTasks(questId, rest.map((t) => t.character_id));
    }
    await KawiCharacter.deleteOne({ character_id: id });
    if (character.reference_glyph) await deleteFile(character.reference_glyph);
    return { success: `Deleted #${id} ${character.name}${quests.length ? ` and removed it from ${quests.length} quest(s)` : ""}.`, done: "deleted" };
  });
}

const GLYPH_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const GLYPH_MAX = 512 * 1024;

export async function uploadGlyph(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "character_id");
    const file = fd.get("glyph");
    const character = id ? await KawiCharacter.findOne({ character_id: id }).lean() : null;
    if (!character) return { error: "Save the character first, then add its reference glyph." };
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
    const ext = GLYPH_TYPES[file.type];
    if (!ext) return { error: "Use a PNG, JPEG, WebP or SVG image." };
    if (file.size > GLYPH_MAX) return { error: "Use an image under 512 KB." };

    const path = `glyphs/${id}-${randomBytes(4).toString("hex")}.${ext}`;
    await putFile(path, new Uint8Array(await file.arrayBuffer()), file.type);
    await KawiCharacter.updateOne({ character_id: id }, { reference_glyph: path });
    if (character.reference_glyph) await deleteFile(character.reference_glyph);
    return { success: "Reference glyph updated.", id: id! };
  });
}

export async function removeGlyph(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "character_id");
    const character = id ? await KawiCharacter.findOne({ character_id: id }).lean() : null;
    if (!character?.reference_glyph) return { error: "There is no reference glyph to remove." };
    await KawiCharacter.updateOne({ character_id: id }, { reference_glyph: null });
    await deleteFile(character.reference_glyph);
    return { success: "Reference glyph removed.", id: id! };
  });
}

/**
 * CSV columns: unicode_codepoint, name, transliteration, category, base_letter (header row required;
 * category by name or id). Rows match existing characters by unicode_codepoint and update them; others are added.
 * Nothing is written unless every row is valid.
 */
export async function importCharacters(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const file = fd.get("csv");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
    if (file.size > 512 * 1024) return { error: "Use a CSV under 512 KB." };

    const rows = parseCsv(await file.text());
    const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const missing = ["unicode_codepoint", "name", "transliteration", "category"].filter((h) => col(h) < 0);
    if (missing.length) return { error: `The header row needs these columns: ${missing.join(", ")}.` };
    if (!rows.length) return { error: "The file has no rows under the header." };

    const categories = await Category.find({}).lean();
    const byName = new Map(categories.map((c) => [c.category_name.toLowerCase(), c.category_id]));
    const ids = new Set(categories.map((c) => c.category_id));
    const errors: string[] = [];
    const valid: CharacterValues[] = [];
    const seen = new Set<string>();

    rows.forEach((r, i) => {
      const cell = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
      const category = cell("category");
      const result = validateCharacter(
        {
          unicode_codepoint: cell("unicode_codepoint"),
          name: cell("name"),
          transliteration: cell("transliteration"),
          category_id: byName.get(category.toLowerCase()) ?? (Number(category) || ""),
          base_letter: cell("base_letter"),
        },
        ids,
      );
      const line = i + 2;
      if (!result.ok) errors.push(`Line ${line}: ${Object.values(result.fieldErrors).join(" ")}`);
      else if (seen.has(result.value.unicode_codepoint)) errors.push(`Line ${line}: ${result.value.unicode_codepoint} appears twice in the file.`);
      else {
        seen.add(result.value.unicode_codepoint);
        valid.push(result.value);
      }
    });
    if (errors.length) {
      return { error: `Nothing imported. Fix ${errors.length} row(s): ${errors.slice(0, 5).join(" · ")}${errors.length > 5 ? " · …" : ""}` };
    }

    let added = 0;
    let updated = 0;
    for (const v of valid) {
      const res = await KawiCharacter.updateOne({ unicode_codepoint: v.unicode_codepoint }, v);
      if (res.matchedCount) updated++;
      else {
        await KawiCharacter.create({ character_id: await nextId("kawi_characters"), ...v, reference_glyph: null });
        added++;
      }
    }
    return { success: `Imported ${valid.length} row(s): ${added} added, ${updated} updated.${added ? " Add new characters to a quest so the game teaches them." : ""}` };
  });
}

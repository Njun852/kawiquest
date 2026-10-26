import "server-only";
import { PASSES_PER_WRITER } from "../constants";
import { formOf } from "../curriculum/forms";
import { connectDb } from "../db";
import { Category, HandwritingSample, KawiCharacter } from "../models";

// Everything the contributor canvas needs, derived from the contributor's own handwriting_samples
// (the ERD has no pass or timestamp columns: a pass is "every character written once more").

export type CanvasTarget = {
  character_id: number;
  form: string;
  name: string;
  transliteration: string;
  unicode_codepoint: string;
  category: string;
  reference_glyph: string | null;
};

export type ContributorState = {
  /** The pass being written: 1, 2, or beyond the study target once both are done. */
  pass: number;
  passesTarget: number;
  /** Characters already written in this pass, out of `total`. */
  done: number;
  total: number;
  /** Characters still to write in this pass, in inventory order. */
  queue: CanvasTarget[];
  totals: { characters: number; nonCharacters: number };
  recent: { sample_id: number; image_path: string; label: string; is_non_character: boolean }[];
};

export async function loadContributorState(accountId: number): Promise<ContributorState> {
  await connectDb();
  const [characters, categories, counts, nonCharacters, recent] = await Promise.all([
    KawiCharacter.find({}, { _id: 0 }).sort({ character_id: 1 }).lean(),
    Category.find({}, { _id: 0 }).lean(),
    HandwritingSample.aggregate<{ _id: number; n: number }>([
      { $match: { account_id: accountId, is_non_character: false } },
      { $group: { _id: "$character_id", n: { $sum: 1 } } },
    ]),
    HandwritingSample.countDocuments({ account_id: accountId, is_non_character: true }),
    HandwritingSample.find({ account_id: accountId }, { _id: 0 }).sort({ sample_id: -1 }).limit(6).lean(),
  ]);

  const count = new Map(counts.map((c) => [c._id, c.n]));
  const categoryName = new Map(categories.map((c) => [c.category_id, c.category_name]));
  const written = (id: number) => count.get(id) ?? 0;
  // The current pass is one more than the fewest times any character has been written.
  const pass = (characters.length ? Math.min(...characters.map((c) => written(c.character_id))) : 0) + 1;
  const byId = new Map(characters.map((c) => [c.character_id, c]));

  const queue = characters
    .filter((c) => written(c.character_id) < pass)
    .map((c) => ({
      character_id: c.character_id,
      form: formOf(c),
      name: c.name,
      transliteration: c.transliteration,
      unicode_codepoint: c.unicode_codepoint,
      category: categoryName.get(c.category_id) ?? "",
      reference_glyph: c.reference_glyph,
    }));

  return {
    pass,
    passesTarget: PASSES_PER_WRITER,
    done: characters.length - queue.length,
    total: characters.length,
    queue,
    totals: { characters: [...count.values()].reduce((a, b) => a + b, 0), nonCharacters },
    recent: recent.map((s) => {
      const c = s.character_id != null ? byId.get(s.character_id) : undefined;
      return {
        sample_id: s.sample_id,
        image_path: s.image_path,
        label: s.is_non_character ? "Non-character" : c ? `${c.transliteration} · ${c.name}` : "Deleted character",
        is_non_character: s.is_non_character,
      };
    }),
  };
}

import { CATEGORY_ID } from "../constants";
import { CONSONANTS } from "./forms";

// Rules for a kawi_characters row, shared by the edit drawer and the CSV import.

const KAWI_FIRST = 0x11f00;
const KAWI_LAST = 0x11f5f;
const CONJOINER = 0x11f42;
const CONSONANT_NAMES = new Set<string>(CONSONANTS.map(([n]) => n));

export type CharacterInput = {
  unicode_codepoint: string;
  name: string;
  transliteration: string;
  category_id: string | number;
  base_letter: string;
};

export type CharacterValues = {
  unicode_codepoint: string;
  name: string;
  transliteration: string;
  category_id: number;
  base_letter: string | null;
};

/**
 * Accepts "U+11F12", "11F12", "U+11F12 U+11F42 U+11F31", "11F12 11F42 11F31" or the Kawi text itself,
 * and returns the code points, or an error message.
 */
export function parseCodePoints(input: string): number[] | string {
  const text = input.trim();
  if (!text) return "Enter the Unicode code point(s).";
  // Pasted Kawi text: anything outside ASCII.
  const cps = /[^\x00-\x7f]/.test(text)
    ? [...text.replace(/\s+/g, "")].map((ch) => ch.codePointAt(0)!)
    : text
        .split(/[\s,+]+/)
        .filter((t) => t && t.toUpperCase() !== "U")
        .map((t) => (/^(U\+?)?[0-9a-f]{4,5}$/i.test(t) ? parseInt(t.replace(/^U\+?/i, ""), 16) : NaN));
  if (cps.some((c) => Number.isNaN(c))) return "Use code points like U+11F12, separated by spaces.";
  if (cps.some((c) => c < KAWI_FIRST || c > KAWI_LAST)) return "Every code point must be in the Kawi block (U+11F00–U+11F5F).";
  return cps;
}

/** The ERD's storage format, which fits varchar(20): "U+11F12", or "11F12 11F42 11F31" for a sequence. */
export function formatCodePoints(cps: number[]) {
  const hex = cps.map((c) => c.toString(16).toUpperCase());
  return hex.length === 1 ? `U+${hex[0]}` : hex.join(" ");
}

export function validateCharacter(
  input: CharacterInput,
  categoryIds: Set<number>,
): { ok: true; value: CharacterValues } | { ok: false; fieldErrors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = input.name.trim().toUpperCase();
  const transliteration = input.transliteration.trim();
  const category_id = Number(input.category_id);
  const base_letter = input.base_letter.trim().toUpperCase() || null;

  if (!name) errors.name = "Enter the name, e.g. KA or VOWEL SIGN I.";
  else if (name.length > 100) errors.name = "Use at most 100 characters.";
  if (!transliteration) errors.transliteration = "Enter the transliteration, e.g. ka.";
  else if (transliteration.length > 100) errors.transliteration = "Use at most 100 characters.";
  if (!categoryIds.has(category_id)) errors.category_id = "Choose a category.";

  const cps = parseCodePoints(input.unicode_codepoint);
  if (typeof cps === "string") errors.unicode_codepoint = cps;

  const isMarked = category_id === CATEGORY_ID.marked;
  const isLigature = category_id === CATEGORY_ID.ligatures;
  if (base_letter && !CONSONANT_NAMES.has(base_letter)) errors.base_letter = "Choose a consonant, e.g. KA.";
  if (isMarked && !base_letter) errors.base_letter = "Marked forms are written on a base letter; choose one (usually KA).";
  if (!isMarked && base_letter) errors.base_letter = "Only marked forms have a base letter.";

  if (Array.isArray(cps)) {
    if (isLigature) {
      if (cps.length < 3 || !cps.includes(CONJOINER) || cps[0] === CONJOINER || cps.at(-1) === CONJOINER) {
        errors.unicode_codepoint = "A ligature is consonant + conjoiner (U+11F42) + consonant.";
      }
    } else if (cps.length !== 1) {
      errors.unicode_codepoint = isMarked
        ? "Enter only the mark's own code point; the base letter is chosen below."
        : "Enter a single code point.";
    }
    if (formatCodePoints(cps).length > 20) errors.unicode_codepoint = "Too many code points (the column holds 20 characters).";
  }

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { unicode_codepoint: formatCodePoints(cps as number[]), name, transliteration, category_id, base_letter } };
}

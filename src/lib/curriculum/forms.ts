import type { IKawiCharacter } from "../models";

// What to display for a kawi_characters row. The ERD stores only the code point(s) and, for combining
// marks, the base letter's name; the visible form is derived here.

/** The 34 consonants in Unicode order from U+11F12, with IAST transliterations. */
export const CONSONANTS = [
  ["KA", "ka"], ["KHA", "kha"], ["GA", "ga"], ["GHA", "gha"], ["NGA", "ṅa"], ["CA", "ca"], ["CHA", "cha"], ["JA", "ja"],
  ["JHA", "jha"], ["NYA", "ña"], ["TTA", "ṭa"], ["TTHA", "ṭha"], ["DDA", "ḍa"], ["DDHA", "ḍha"], ["NNA", "ṇa"], ["TA", "ta"],
  ["THA", "tha"], ["DA", "da"], ["DHA", "dha"], ["NA", "na"], ["PA", "pa"], ["PHA", "pha"], ["BA", "ba"], ["BHA", "bha"],
  ["MA", "ma"], ["YA", "ya"], ["RA", "ra"], ["LA", "la"], ["WA", "wa"], ["SHA", "śa"], ["SSA", "ṣa"], ["SA", "sa"],
  ["HA", "ha"], ["JNYA", "jña"],
] as const;
export type ConsonantName = (typeof CONSONANTS)[number][0];

export function consonantHex(name: ConsonantName) {
  return (0x11f12 + CONSONANTS.findIndex(([n]) => n === name)).toString(16).toUpperCase();
}

const REPHA = 0x11f02; // written before the consonant it sits on

/** "U+11F36" → ["11F36"]; "11F12 11F42 11F31" → ["11F12", "11F42", "11F31"]. */
export function codePointsOf(unicodeCodepoint: string) {
  return unicodeCodepoint.replace(/^U\+/, "").split(" ");
}

/** The string to render: dependent signs on their base letter, ligatures as stored. */
export function formOf(c: Pick<IKawiCharacter, "unicode_codepoint" | "base_letter">) {
  const own = codePointsOf(c.unicode_codepoint).map((h) => parseInt(h, 16));
  if (!c.base_letter) return String.fromCodePoint(...own);
  const base = parseInt(consonantHex(c.base_letter as ConsonantName), 16);
  return own[0] === REPHA ? String.fromCodePoint(...own, base) : String.fromCodePoint(base, ...own);
}

/** Store a form's code points the ERD way: "U+XXXXX" for one, space-separated hex for a sequence. */
export function toUnicodeCodepoint(chars: string) {
  const hex = [...chars].map((ch) => ch.codePointAt(0)!.toString(16).toUpperCase());
  return hex.length === 1 ? `U+${hex[0]}` : hex.join(" ");
}

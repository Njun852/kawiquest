import { CATEGORIES, CATEGORY_ID, ROLE_IDS, ROLES } from "../constants";
import type { ICategory, IGameLevel, IKawiCharacter, IQuest, IQuestTask, IRole } from "../models";
import { CONSONANTS, consonantHex, type ConsonantName } from "./forms";

// Initial rows for the ERD's lookup and curriculum tables. Sources: the Unicode Kawi block as listed in the
// thesis (Table 2, 87 characters), IAST transliterations as in the Expert Validation Form ("ka", "kā", "kta"),
// and the levels and quests from the KawiQuest design system.

export const roles: IRole[] = ROLES.map((r) => ({ role_id: ROLE_IDS[r], role_name: r }));

export const categories: ICategory[] = CATEGORIES.map((c) => ({ category_id: c.id, category_name: c.name }));

/** game_levels in play order: the story areas around the five worlds. */
export const LEVEL = { house: 1, museum: 2, station: 3, lostTemple: 4, lanternSpirits: 5, playground: 6, industrials: 7, school: 8, greatHall: 9 } as const;

export const gameLevels: IGameLevel[] = [
  "House",
  "City Museum",
  "Station",
  "Lost Temple",
  "Lantern Spirits",
  "Playground",
  "Industrials",
  "School",
  "Great Hall",
].map((area_name, i) => ({ level_id: i + 1, level_order: i + 1, area_name }));

export const quests: IQuest[] = [
  { quest_id: 1, level_id: LEVEL.house, parent_quest_id: null, quest_name: "Lola's Lucky Mark", quest_order: 1 },
  { quest_id: 2, level_id: LEVEL.lostTemple, parent_quest_id: null, quest_name: "The Sealed Shrines", quest_order: 2 },
  { quest_id: 3, level_id: LEVEL.lanternSpirits, parent_quest_id: null, quest_name: "Names for the Spirits", quest_order: 3 },
  { quest_id: 4, level_id: LEVEL.playground, parent_quest_id: null, quest_name: "Scores in Kawi", quest_order: 4 },
  { quest_id: 5, level_id: LEVEL.industrials, parent_quest_id: null, quest_name: "Start the Water Tank", quest_order: 5 },
  { quest_id: 6, level_id: LEVEL.school, parent_quest_id: null, quest_name: "The Copper Plate Lesson", quest_order: 6 },
  { quest_id: 7, level_id: LEVEL.greatHall, parent_quest_id: null, quest_name: "The Great Plate", quest_order: 7 },
];

// ---- kawi_characters: 87 encoded characters + 20 ligatures ----

type Row = Omit<IKawiCharacter, "character_id" | "reference_glyph"> & { quest_id: number };

const row = (hex: string | string[], name: string, transliteration: string, category: keyof typeof CATEGORY_ID, quest_id: number, base_letter: string | null = null): Row => ({
  unicode_codepoint: Array.isArray(hex) ? hex.join(" ") : `U+${hex}`,
  name,
  transliteration,
  category_id: CATEGORY_ID[category],
  base_letter,
  quest_id,
});

const vowels = (
  [
    ["11F04", "A", "a"], ["11F05", "AA", "ā"], ["11F06", "I", "i"], ["11F07", "II", "ī"], ["11F08", "U", "u"],
    ["11F09", "UU", "ū"], ["11F0A", "VOCALIC R", "ṛ"], ["11F0B", "VOCALIC RR", "ṝ"], ["11F0C", "VOCALIC L", "ḷ"],
    ["11F0D", "VOCALIC LL", "ḹ"], ["11F0E", "E", "e"], ["11F0F", "AI", "ai"], ["11F10", "O", "o"],
  ] as const
).map(([hex, name, tr]) => row(hex, name, tr, "vowels", 2));

const consonants = CONSONANTS.map(([name, tr]) => row(consonantHex(name), name, tr, "consonants", 3));

const digits = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"].map((n, i) =>
  row((0x11f50 + i).toString(16).toUpperCase(), `DIGIT ${n}`, String(i), "digits", 4),
);

/** Dependent signs are written and recognised on the fixed base letter KA. */
const onKa = (hex: string, name: string, tr: string, quest = 5) => row(hex, name, tr, "marked", quest, "KA");
const marked = [
  onKa("11F34", "VOWEL SIGN AA", "kā"),
  onKa("11F35", "VOWEL SIGN ALTERNATE AA", "kā (alt.)"),
  onKa("11F36", "VOWEL SIGN I", "ki"),
  onKa("11F37", "VOWEL SIGN II", "kī"),
  onKa("11F38", "VOWEL SIGN U", "ku"),
  onKa("11F39", "VOWEL SIGN UU", "kū"),
  onKa("11F3A", "VOWEL SIGN VOCALIC R", "kṛ"),
  onKa("11F3E", "VOWEL SIGN E", "ke"),
  onKa("11F3F", "VOWEL SIGN AI", "kai"),
  onKa("11F40", "VOWEL SIGN EU", "kĕ"),
  onKa("11F41", "SIGN KILLER", "k"),
  onKa("11F00", "SIGN CANDRABINDU", "kam̐"),
  onKa("11F01", "SIGN ANUSVARA", "kaṃ"),
  onKa("11F02", "SIGN REPHA", "rka"),
  onKa("11F03", "SIGN VISARGA", "kaḥ"),
  onKa("11F5A", "SIGN NUKTA", "(nukta)"),
  // Counted in Marked forms but taught in the School quest with the ligatures.
  onKa("11F42", "CONJOINER", "(conjoiner)", 6),
];

const punctuation = (
  [
    ["DANDA", "(danda)"], ["DOUBLE DANDA", "(double danda)"], ["PUNCTUATION SECTION MARKER", "(section marker)"],
    ["PUNCTUATION ALTERNATE SECTION MARKER", "(alt. section marker)"], ["PUNCTUATION FLOWER", "(flower)"],
    ["PUNCTUATION SPACE FILLER", "(space filler)"], ["PUNCTUATION DOT", "(dot)"], ["PUNCTUATION DOUBLE DOT", "(double dot)"],
    ["PUNCTUATION TRIPLE DOT", "(triple dot)"], ["PUNCTUATION CIRCLE", "(circle)"], ["PUNCTUATION FILLED CIRCLE", "(filled circle)"],
    ["PUNCTUATION SPIRAL", "(spiral)"], ["PUNCTUATION CLOSING SPIRAL", "(closing spiral)"],
  ] as const
).map(([name, tr], i) => row((0x11f43 + i).toString(16).toUpperCase(), name, tr, "punctuation", 6));

/**
 * The 20 ligatures (consonant + conjoiner + consonant). The thesis leaves the list to the Expert Validator:
 * KSA (design system) and KTA (Expert Validation Form) are named; the other 18 are placeholders.
 */
const LIGATURES: [ConsonantName, ConsonantName, string][] = [
  ["KA", "SA", "ksa"], ["KA", "TA", "kta"], ["KA", "RA", "kra"], ["KA", "YA", "kya"], ["KA", "WA", "kwa"],
  ["TA", "RA", "tra"], ["PA", "RA", "pra"], ["GA", "RA", "gra"], ["DA", "RA", "dra"], ["BA", "RA", "bra"],
  ["SA", "TA", "sta"], ["NA", "TA", "nta"], ["NA", "DA", "nda"], ["NGA", "KA", "ṅka"], ["NGA", "GA", "ṅga"],
  ["MA", "PA", "mpa"], ["MA", "BA", "mba"], ["NYA", "CA", "ñca"], ["NYA", "JA", "ñja"], ["SA", "WA", "swa"],
];
const ligatures = LIGATURES.map(([a, b, tr]) =>
  row([consonantHex(a), "11F42", consonantHex(b)], a.slice(0, -1) + b, tr, "ligatures", 6),
);

// character_id follows the category order: vowels 1–13, consonants 14–47, digits 48–57, marked forms 58–74,
// punctuation 75–87, ligatures 88–107.
const all = [...vowels, ...consonants, ...digits, ...marked, ...punctuation, ...ligatures];

export const kawiCharacters: IKawiCharacter[] = all.map((r, i) => ({
  character_id: i + 1,
  unicode_codepoint: r.unicode_codepoint,
  name: r.name,
  transliteration: r.transliteration,
  category_id: r.category_id,
  base_letter: r.base_letter,
  reference_glyph: null,
}));

/** quest_tasks: each world quest asks for its characters in inventory order. */
export const questTasks: IQuestTask[] = quests.flatMap((q) =>
  all
    .map((r, i) => ({ r, character_id: i + 1 }))
    .filter(({ r }) => r.quest_id === q.quest_id)
    .map(({ character_id }, i) => ({ quest_id: q.quest_id, character_id, task_order: i + 1 })),
);

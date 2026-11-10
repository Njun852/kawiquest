// Fixed lookup rows. The `roles` and `categories` tables are seeded with exactly these ids, so code can
// refer to them by name without a query; the seed refuses to run if the tables disagree.

export const ROLES = ["admin", "validator", "contributor", "player"] as const;
export type Role = (typeof ROLES)[number];

/** roles.role_id for each role_name. */
export const ROLE_IDS: Record<Role, number> = { admin: 1, validator: 2, contributor: 3, player: 4 };

export function roleName(roleId: number): Role | null {
  return (Object.entries(ROLE_IDS) as [Role, number][]).find(([, id]) => id === roleId)?.[0] ?? null;
}

/** The five categories (categories.category_id → category_name), with their size in the 87-character inventory. */
export const CATEGORIES = [
  { id: 1, key: "vowels", name: "Vowels", count: 13 },
  { id: 2, key: "consonants", name: "Consonants", count: 34 },
  { id: 3, key: "digits", name: "Digits", count: 10 },
  { id: 4, key: "marked", name: "Marked forms", count: 17 },
  { id: 5, key: "punctuation", name: "Punctuation", count: 13 },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.id])) as Record<CategoryKey, number>;

/** The 87 encoded Kawi characters (thesis: Kawi Learning Content). The CNN adds one reject class. */
export const INVENTORY_SIZE = 87;

/** Dataset targets from the thesis: at least 90 writers, each writing every class twice. */
export const TARGET_WRITERS = 90;
export const PASSES_PER_WRITER = 2;
export const TARGET_PER_CLASS = TARGET_WRITERS * PASSES_PER_WRITER; // 180 samples per character

/** player_quest_progress.status. */
export const QUEST_STATUS = { notStarted: 0, inProgress: 1, completed: 2 } as const;
export const QUEST_STATUS_VALUES: number[] = Object.values(QUEST_STATUS);

import "server-only";
import { formOf } from "../curriculum/forms";
import { connectDb } from "../db";
import { Category, CharacterValidation, KawiCharacter, type ValidationStatus } from "../models";

// Expert validation of reference forms (manuscript FR4). A character's status is its latest
// character_validations row; no row means pending. Approved and corrected forms count as validated.

export type FormStatus = "pending" | ValidationStatus;
export const REVIEW_FILTERS = ["pending", "approved", "corrected", "all"] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

const TZ_OFFSET_MS = 8 * 3600 * 1000; // Asia/Manila is UTC+8 all year
const whenFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export type Decision = { validation_id: number; status: ValidationStatus; remarks: string | null; by: number; at: string };

export type ReviewItem = {
  character_id: number;
  form: string;
  name: string;
  transliteration: string;
  unicode_codepoint: string;
  category_id: number;
  category: string;
  base_letter: string | null;
  reference_glyph: string | null;
  status: FormStatus;
  /** Every decision on this form, newest first. */
  history: Decision[];
};

export type ReviewData = {
  filter: ReviewFilter;
  items: ReviewItem[];
  categories: { category_id: number; category_name: string }[];
  /** Forms matching the status filter, per category, for the category tabs. */
  byCategory: Record<number, number>;
  counts: Record<FormStatus, number>;
  total: number;
  reviewedToday: number;
};

/** All decisions grouped by character, newest first. The inventory is 87 forms, so this stays small. */
async function decisionsByCharacter() {
  const rows = await CharacterValidation.find({}, { _id: 0 }).sort({ validation_id: -1 }).lean();
  const map = new Map<number, Decision[]>();
  for (const r of rows) {
    const list = map.get(r.character_id) ?? [];
    list.push({ validation_id: r.validation_id, status: r.status, remarks: r.remarks, by: r.account_id, at: whenFmt.format(r.validated_at) });
    map.set(r.character_id, list);
  }
  return map;
}

/** IDs of characters whose reference form the Expert Validator has approved or corrected. */
export async function validatedCharacterIds(): Promise<Set<number>> {
  await connectDb();
  const ids = await CharacterValidation.distinct("character_id");
  return new Set(ids as number[]);
}

/** Reference forms still waiting for the Expert Validator. */
export async function pendingCount() {
  await connectDb();
  const [characters, validated] = await Promise.all([KawiCharacter.estimatedDocumentCount(), validatedCharacterIds()]);
  return Math.max(0, characters - validated.size);
}

export async function loadReview(me: { id: number }, opts: { filter: ReviewFilter; categoryId?: number }): Promise<ReviewData> {
  await connectDb();
  const todayStart = new Date(Math.floor((Date.now() + TZ_OFFSET_MS) / 86400000) * 86400000 - TZ_OFFSET_MS);
  const [characters, categories, decisions, reviewedToday] = await Promise.all([
    KawiCharacter.find({}, { _id: 0 }).sort({ character_id: 1 }).lean(),
    Category.find({}, { _id: 0 }).sort({ category_id: 1 }).lean(),
    decisionsByCharacter(),
    CharacterValidation.countDocuments({ account_id: me.id, validated_at: { $gte: todayStart } }),
  ]);
  const categoryName = new Map(categories.map((c) => [c.category_id, c.category_name]));

  const all: ReviewItem[] = characters.map((c) => {
    const history = decisions.get(c.character_id) ?? [];
    return {
      character_id: c.character_id,
      form: formOf(c),
      name: c.name,
      transliteration: c.transliteration,
      unicode_codepoint: c.unicode_codepoint,
      category_id: c.category_id,
      category: categoryName.get(c.category_id) ?? "",
      base_letter: c.base_letter,
      reference_glyph: c.reference_glyph,
      status: history[0]?.status ?? "pending",
      history,
    };
  });

  const counts: Record<FormStatus, number> = { pending: 0, approved: 0, corrected: 0 };
  for (const item of all) counts[item.status]++;

  const byStatus = opts.filter === "all" ? all : all.filter((i) => i.status === opts.filter);
  const byCategory: Record<number, number> = {};
  for (const item of byStatus) byCategory[item.category_id] = (byCategory[item.category_id] ?? 0) + 1;

  return {
    filter: opts.filter,
    items: opts.categoryId ? byStatus.filter((i) => i.category_id === opts.categoryId) : byStatus,
    categories,
    byCategory,
    counts,
    total: all.length,
    reviewedToday,
  };
}

export type MyReview = {
  validation_id: number;
  character_id: number;
  form: string | null;
  label: string;
  status: ValidationStatus;
  remarks: string | null;
  at: string;
  /** Someone decided on this form after this reviewer. */
  superseded: boolean;
};

export async function loadMyReviews(me: { id: number }, limit = 100): Promise<{ rows: MyReview[]; total: number }> {
  await connectDb();
  const [mine, total, characters, latest] = await Promise.all([
    CharacterValidation.find({ account_id: me.id }, { _id: 0 }).sort({ validation_id: -1 }).limit(limit).lean(),
    CharacterValidation.countDocuments({ account_id: me.id }),
    KawiCharacter.find({}, { _id: 0 }).lean(),
    CharacterValidation.aggregate<{ _id: number; id: number }>([{ $group: { _id: "$character_id", id: { $max: "$validation_id" } } }]),
  ]);
  const charById = new Map(characters.map((c) => [c.character_id, c]));
  const latestId = new Map(latest.map((l) => [l._id, l.id]));
  return {
    total,
    rows: mine.map((v) => {
      const c = charById.get(v.character_id);
      return {
        validation_id: v.validation_id,
        character_id: v.character_id,
        form: c ? formOf(c) : null,
        label: c ? `${c.transliteration} · ${c.name}` : "Deleted character",
        status: v.status,
        remarks: v.remarks,
        at: whenFmt.format(v.validated_at),
        superseded: (latestId.get(v.character_id) ?? v.validation_id) !== v.validation_id,
      };
    }),
  };
}

import "server-only";
import type { PipelineStage } from "mongoose";
import { formOf } from "../curriculum/forms";
import { connectDb } from "../db";
import { Category, CharacterValidation, HandwritingSample, KawiCharacter, type ValidationStatus } from "../models";

// The validation queue. A sample's status is its latest character_validations row; no row means pending.

export const QUEUE_FILTERS = ["pending", "flagged", "mine"] as const;
export type QueueFilter = (typeof QUEUE_FILTERS)[number];
const PAGE = 50;
const TZ_OFFSET_MS = 8 * 3600 * 1000; // Asia/Manila is UTC+8 all year

export type QueueCharacter = {
  character_id: number;
  form: string;
  name: string;
  transliteration: string;
  unicode_codepoint: string;
  category: string;
  reference_glyph: string | null;
};

export type QueueItem = {
  sample_id: number;
  image_path: string;
  /** The contributor's account ID: validators never see names. */
  account_id: number;
  is_non_character: boolean;
  character: QueueCharacter | null;
  latest: { status: ValidationStatus; remarks: string | null; by: number; at: string } | null;
};

export type QueueData = {
  filter: QueueFilter;
  items: QueueItem[];
  matching: number;
  pendingTotal: number;
  reviewedToday: number;
  characters: { character_id: number; label: string; category_id: number }[];
  categories: { category_id: number; category_name: string }[];
  /** Samples matching the status filter, per category (and non-characters), for the category tabs. */
  byCategory: Record<number, number>;
  nonCharacters: number;
};

/** Lookup stage: each sample's most recent decision as `latest` (null when pending). */
const withLatest: PipelineStage[] = [
  {
    $lookup: {
      from: "character_validations",
      localField: "sample_id",
      foreignField: "sample_id",
      pipeline: [{ $sort: { validation_id: -1 } }, { $limit: 1 }],
      as: "latest",
    },
  },
  { $addFields: { latest: { $ifNull: [{ $first: "$latest" }, null] } } },
];

export async function pendingCount() {
  await connectDb();
  const [samples, decided] = await Promise.all([
    HandwritingSample.estimatedDocumentCount(),
    CharacterValidation.distinct("sample_id").then((ids) => ids.length),
  ]);
  return Math.max(0, samples - decided);
}

export async function loadQueue(
  me: { id: number },
  opts: { filter: QueueFilter; characterId?: number | "non"; categoryId?: number },
): Promise<QueueData> {
  await connectDb();
  const [characters, categories] = await Promise.all([
    KawiCharacter.find({}, { _id: 0 }).sort({ character_id: 1 }).lean(),
    Category.find({}, { _id: 0 }).sort({ category_id: 1 }).lean(),
  ]);

  const base: Record<string, unknown> = {};
  if (opts.characterId === "non") base.is_non_character = true;
  else if (opts.characterId) base.character_id = opts.characterId;
  else if (opts.categoryId) base.character_id = { $in: characters.filter((c) => c.category_id === opts.categoryId).map((c) => c.character_id) };

  const statusMatch =
    opts.filter === "pending" ? { latest: null } : opts.filter === "flagged" ? { "latest.status": "flagged" } : { "latest.account_id": me.id };
  const sort: Record<string, 1 | -1> = opts.filter === "mine" ? { "latest.validation_id": -1 } : { sample_id: 1 }; // oldest first

  const [result] = await HandwritingSample.aggregate<{ items: Record<string, unknown>[]; total: { n: number }[] }>([
    { $match: base },
    ...withLatest,
    { $match: statusMatch },
    { $sort: sort },
    { $facet: { items: [{ $limit: PAGE }, { $project: { _id: 0 } }], total: [{ $count: "n" }] } },
  ]);

  // Counts for the category tabs: the same status filter, without the character/category filter.
  const perCharacter = await HandwritingSample.aggregate<{ _id: number | null; n: number }>([
    ...withLatest,
    { $match: statusMatch },
    { $group: { _id: "$character_id", n: { $sum: 1 } } },
  ]);
  const byCategory: Record<number, number> = {};
  for (const row of perCharacter) {
    const cat = row._id != null ? characters.find((c) => c.character_id === row._id)?.category_id : undefined;
    if (cat != null) byCategory[cat] = (byCategory[cat] ?? 0) + row.n;
  }
  const nonCharacters = perCharacter.find((r) => r._id == null)?.n ?? 0;

  const todayStart = new Date(Math.floor((Date.now() + TZ_OFFSET_MS) / 86400000) * 86400000 - TZ_OFFSET_MS);
  const [pendingTotal, reviewedToday] = await Promise.all([
    pendingCount(),
    CharacterValidation.countDocuments({ account_id: me.id, validated_at: { $gte: todayStart } }),
  ]);

  const byId = new Map(characters.map((c) => [c.character_id, c]));
  const categoryName = new Map(categories.map((c) => [c.category_id, c.category_name]));
  const items: QueueItem[] = (result?.items ?? []).map((raw) => {
    const s = raw as { sample_id: number; image_path: string; account_id: number; is_non_character: boolean; character_id: number | null; latest: { status: ValidationStatus; remarks: string | null; account_id: number; validated_at: Date } | null };
    const c = s.character_id != null ? byId.get(s.character_id) : undefined;
    return {
      sample_id: s.sample_id,
      image_path: s.image_path,
      account_id: s.account_id,
      is_non_character: s.is_non_character,
      character: c
        ? {
            character_id: c.character_id,
            form: formOf(c),
            name: c.name,
            transliteration: c.transliteration,
            unicode_codepoint: c.unicode_codepoint,
            category: categoryName.get(c.category_id) ?? "",
            reference_glyph: c.reference_glyph,
          }
        : null,
      latest: s.latest
        ? { status: s.latest.status, remarks: s.latest.remarks, by: s.latest.account_id, at: new Date(s.latest.validated_at).toISOString() }
        : null,
    };
  });

  return {
    filter: opts.filter,
    items,
    matching: result?.total[0]?.n ?? 0,
    pendingTotal,
    reviewedToday,
    characters: characters.map((c) => ({ character_id: c.character_id, label: `${c.transliteration} · ${c.name}`, category_id: c.category_id })),
    categories,
    byCategory,
    nonCharacters,
  };
}

export type MyReview = {
  validation_id: number;
  sample_id: number;
  image_path: string | null;
  label: string;
  status: ValidationStatus;
  remarks: string | null;
  at: string;
  /** Someone decided after this reviewer. */
  superseded: boolean;
};

const whenFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export async function loadMyReviews(me: { id: number }, limit = 100): Promise<{ rows: MyReview[]; total: number }> {
  await connectDb();
  const [mine, total] = await Promise.all([
    CharacterValidation.find({ account_id: me.id }, { _id: 0 }).sort({ validation_id: -1 }).limit(limit).lean(),
    CharacterValidation.countDocuments({ account_id: me.id }),
  ]);
  const sampleIds = [...new Set(mine.map((v) => v.sample_id))];
  const [samples, characters, latest] = await Promise.all([
    HandwritingSample.find({ sample_id: { $in: sampleIds } }, { _id: 0 }).lean(),
    KawiCharacter.find({}, { _id: 0, character_id: 1, name: 1, transliteration: 1 }).lean(),
    CharacterValidation.aggregate<{ _id: number; id: number }>([
      { $match: { sample_id: { $in: sampleIds } } },
      { $group: { _id: "$sample_id", id: { $max: "$validation_id" } } },
    ]),
  ]);
  const sampleById = new Map(samples.map((s) => [s.sample_id, s]));
  const charById = new Map(characters.map((c) => [c.character_id, c]));
  const latestId = new Map(latest.map((l) => [l._id, l.id]));
  return {
    total,
    rows: mine.map((v) => {
      const s = sampleById.get(v.sample_id);
      const c = s?.character_id != null ? charById.get(s.character_id) : undefined;
      return {
        validation_id: v.validation_id,
        sample_id: v.sample_id,
        image_path: s?.image_path ?? null,
        label: !s ? "Sample deleted" : s.is_non_character ? "Non-character" : c ? `${c.transliteration} · ${c.name}` : "Deleted character",
        status: v.status,
        remarks: v.remarks,
        at: whenFmt.format(v.validated_at),
        superseded: (latestId.get(v.sample_id) ?? v.validation_id) !== v.validation_id,
      };
    }),
  };
}

export type SampleStatus = "pending" | ValidationStatus;

/** Current status of each given sample (latest decision; pending when none). */
export async function statusOf(sampleIds: number[]): Promise<Map<number, SampleStatus>> {
  await connectDb();
  const rows = await CharacterValidation.aggregate<{ _id: number; status: ValidationStatus }>([
    { $match: { sample_id: { $in: sampleIds } } },
    { $sort: { validation_id: -1 } },
    { $group: { _id: "$sample_id", status: { $first: "$status" } } },
  ]);
  const map = new Map<number, SampleStatus>(sampleIds.map((id) => [id, "pending"]));
  for (const r of rows) map.set(r._id, r.status);
  return map;
}

/** How many of an account's samples are in each status. */
export async function statusCountsFor(accountId: number): Promise<Record<SampleStatus, number>> {
  await connectDb();
  const rows = await HandwritingSample.aggregate<{ _id: ValidationStatus | null; n: number }>([
    { $match: { account_id: accountId } },
    ...withLatest,
    { $group: { _id: "$latest.status", n: { $sum: 1 } } },
  ]);
  const out: Record<SampleStatus, number> = { pending: 0, approved: 0, rejected: 0, flagged: 0 };
  for (const r of rows) out[r._id ?? "pending"] += r.n;
  return out;
}

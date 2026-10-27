import "server-only";
import { ROLES, roleName, TARGET_PER_CLASS, TARGET_WRITERS, type Role } from "../constants";
import { formOf } from "../curriculum/forms";
import { connectDb } from "../db";
import {
  Account,
  Category,
  CharacterValidation,
  GameSession,
  HandwritingSample,
  KawiCharacter,
  PlayerAttempt,
  PlayerQuestProgress,
  Quest,
} from "../models";

// Platform analytics, limited to what the ERD records. Everything is plain data for the client charts.

const TZ = "Asia/Manila";
const WEEKS = 8;
const HARDEST_MIN_ATTEMPTS = 5;

export type Analytics = {
  accounts: { total: number; byRole: Record<Role, number> };
  dataset: {
    samples: number;
    characterSamples: number;
    nonCharacter: number;
    writers: number;
    targetWriters: number;
    targetSamples: number;
    targetPerClass: number;
  };
  coverage: { character_id: number; form: string; name: string; transliteration: string; samples: number; percent: number }[];
  byCategory: { category: string; samples: number; target: number; attempts: number; accepted: number }[];
  game: { sessions: number; players: number; minutesPlayed: number; attempts: number; accepted: number };
  weekly: { week: string; label: string; accepted: number; rejected: number }[];
  quests: { quest_id: number; quest_name: string; completed: number; inProgress: number; notStarted: number }[];
  hardest: { character_id: number; form: string; name: string; transliteration: string; attempts: number; accepted: number; rate: number }[];
  validation: { pending: number; approved: number; rejected: number; flagged: number };
  throughput: { account_id: number; username: string; reviewed: number; approved: number; rejected: number; flagged: number }[];
};

const weekLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: TZ });

/** Monday 00:00 (Manila) of the week containing `d`, as a Date. */
function weekStart(d: Date) {
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const offset = d.getTime() - local.getTime();
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  return new Date(local.getTime() + offset);
}

export async function loadAnalytics(now = new Date()): Promise<Analytics> {
  await connectDb();
  const since = new Date(weekStart(now).getTime() - (WEEKS - 1) * 7 * 24 * 3600 * 1000);

  const [roleRows, characters, categories, sampleRows, writerIds, sessionAgg, attemptsByChar, weeklyRows, quests, progressRows] =
    await Promise.all([
      Account.aggregate<{ _id: number; n: number }>([{ $group: { _id: "$role_id", n: { $sum: 1 } } }]),
      KawiCharacter.find({}, { _id: 0 }).sort({ character_id: 1 }).lean(),
      Category.find({}, { _id: 0 }).sort({ category_id: 1 }).lean(),
      HandwritingSample.aggregate<{ _id: number | null; n: number }>([{ $group: { _id: "$character_id", n: { $sum: 1 } } }]),
      HandwritingSample.distinct("account_id", { is_non_character: false }),
      GameSession.aggregate<{ sessions: number; players: number[]; ms: number }>([
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            players: { $addToSet: "$account_id" },
            ms: { $sum: { $cond: [{ $ifNull: ["$ended_at", false] }, { $subtract: ["$ended_at", "$started_at"] }, 0] } },
          },
        },
      ]),
      PlayerAttempt.aggregate<{ _id: number; attempts: number; accepted: number }>([
        { $group: { _id: "$character_id", attempts: { $sum: 1 }, accepted: { $sum: { $cond: ["$accepted", 1, 0] } } } },
      ]),
      PlayerAttempt.aggregate<{ _id: Date; accepted: number; total: number }>([
        { $match: { attempted_at: { $gte: since } } },
        {
          $group: {
            _id: { $dateTrunc: { date: "$attempted_at", unit: "week", startOfWeek: "monday", timezone: TZ } },
            total: { $sum: 1 },
            accepted: { $sum: { $cond: ["$accepted", 1, 0] } },
          },
        },
      ]),
      Quest.find({ parent_quest_id: null }, { _id: 0 }).sort({ quest_order: 1 }).lean(),
      PlayerQuestProgress.aggregate<{ _id: { quest: number; status: number }; n: number }>([
        { $group: { _id: { quest: "$quest_id", status: "$status" }, n: { $sum: 1 } } },
      ]),
    ]);

  const byRole = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const r of roleRows) {
    const name = roleName(r._id);
    if (name) byRole[name] = r.n;
  }

  const samplesByChar = new Map(sampleRows.filter((r) => r._id != null).map((r) => [r._id as number, r.n]));
  const nonCharacter = sampleRows.find((r) => r._id == null)?.n ?? 0;
  const characterSamples = [...samplesByChar.values()].reduce((a, b) => a + b, 0);
  const attempts = new Map(attemptsByChar.map((r) => [r._id, r]));

  const coverage = characters.map((c) => {
    const n = samplesByChar.get(c.character_id) ?? 0;
    return {
      character_id: c.character_id,
      form: formOf(c),
      name: c.name,
      transliteration: c.transliteration,
      samples: n,
      percent: Math.round((n / TARGET_PER_CLASS) * 100),
    };
  });

  const byCategory = categories.map((cat) => {
    const chars = characters.filter((c) => c.category_id === cat.category_id);
    const sum = (f: (id: number) => number) => chars.reduce((acc, c) => acc + f(c.character_id), 0);
    return {
      category: cat.category_name,
      samples: sum((id) => samplesByChar.get(id) ?? 0),
      target: chars.length * TARGET_PER_CLASS,
      attempts: sum((id) => attempts.get(id)?.attempts ?? 0),
      accepted: sum((id) => attempts.get(id)?.accepted ?? 0),
    };
  });

  // Last WEEKS weeks, oldest first, including empty weeks so the time axis is honest.
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * 24 * 3600 * 1000);
    const row = weeklyRows.find((w) => Math.abs(w._id.getTime() - start.getTime()) < 12 * 3600 * 1000);
    return {
      week: start.toISOString().slice(0, 10),
      label: weekLabel.format(start),
      accepted: row?.accepted ?? 0,
      rejected: row ? row.total - row.accepted : 0,
    };
  });

  const players = byRole.player;
  const questStats = quests.map((q) => {
    const count = (status: number) => progressRows.filter((p) => p._id.quest === q.quest_id && p._id.status === status).reduce((a, p) => a + p.n, 0);
    const completed = count(2);
    const inProgress = count(1);
    return { quest_id: q.quest_id, quest_name: q.quest_name, completed, inProgress, notStarted: Math.max(0, players - completed - inProgress) };
  });

  const charById = new Map(characters.map((c) => [c.character_id, c]));
  const hardest = attemptsByChar
    .filter((r) => r.attempts >= HARDEST_MIN_ATTEMPTS && charById.has(r._id))
    .map((r) => {
      const c = charById.get(r._id)!;
      return { character_id: c.character_id, form: formOf(c), name: c.name, transliteration: c.transliteration, attempts: r.attempts, accepted: r.accepted, rate: r.accepted / r.attempts };
    })
    .sort((a, b) => a.rate - b.rate || b.attempts - a.attempts)
    .slice(0, 8);

  // Validation: each sample's latest decision, and decisions per validator.
  const [latestRows, perValidator] = await Promise.all([
    CharacterValidation.aggregate<{ _id: string; n: number }>([
      { $sort: { validation_id: -1 } },
      { $group: { _id: "$sample_id", status: { $first: "$status" } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    CharacterValidation.aggregate<{ _id: number; reviewed: number; approved: number; rejected: number; flagged: number }>([
      {
        $group: {
          _id: "$account_id",
          reviewed: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          flagged: { $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] } },
        },
      },
      { $sort: { reviewed: -1 } },
    ]),
  ]);
  const decided = Object.fromEntries(latestRows.map((r) => [r._id, r.n])) as Record<string, number>;
  const totalSamples = characterSamples + nonCharacter;
  const validation = {
    approved: decided.approved ?? 0,
    rejected: decided.rejected ?? 0,
    flagged: decided.flagged ?? 0,
    pending: Math.max(0, totalSamples - latestRows.reduce((a, r) => a + r.n, 0)),
  };
  const validatorNames = new Map(
    (await Account.find({ account_id: { $in: perValidator.map((v) => v._id) } }, { _id: 0, account_id: 1, username: 1 }).lean()).map((a) => [a.account_id, a.username]),
  );
  const throughput = perValidator.map((v) => ({ account_id: v._id, username: validatorNames.get(v._id) ?? `#${v._id}`, reviewed: v.reviewed, approved: v.approved, rejected: v.rejected, flagged: v.flagged }));

  const s = sessionAgg[0];
  const totalAttempts = attemptsByChar.reduce((a, r) => a + r.attempts, 0);
  return {
    accounts: { total: Object.values(byRole).reduce((a, b) => a + b, 0), byRole },
    dataset: {
      samples: characterSamples + nonCharacter,
      characterSamples,
      nonCharacter,
      writers: writerIds.length,
      targetWriters: TARGET_WRITERS,
      targetSamples: characters.length * TARGET_PER_CLASS,
      targetPerClass: TARGET_PER_CLASS,
    },
    coverage,
    byCategory,
    game: {
      sessions: s?.sessions ?? 0,
      players: s?.players.length ?? 0,
      minutesPlayed: Math.round((s?.ms ?? 0) / 60000),
      attempts: totalAttempts,
      accepted: attemptsByChar.reduce((a, r) => a + r.accepted, 0),
    },
    weekly,
    quests: questStats,
    hardest,
    validation,
    throughput,
  };
}


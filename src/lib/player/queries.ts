import "server-only";
import { QUEST_STATUS } from "../constants";
import { formOf } from "../curriculum/forms";
import { connectDb } from "../db";
import {
  Category,
  GameBuild,
  GameLevel,
  GameSession,
  KawiCharacter,
  PlayerAchievement,
  PlayerAttempt,
  PlayerItem,
  PlayerProfile,
  PlayerQuestProgress,
  Quest,
  QuestTask,
} from "../models";

// FR7: everything the player's dashboard shows, read from what the game syncs (player_profiles, game_sessions,
// player_attempts, player_quest_progress, player_achievements, player_items).

export type Mastery = "learned" | "practising" | "new";
export type QuestStatus = "completed" | "in_progress" | "not_started";

export type PlayerDashboard = {
  level: { order: number; name: string; total: number } | null;
  tutorialCompleted: boolean;
  quests: { quest_id: number; name: string; level: string; parent: number | null; status: QuestStatus; done: number; total: number }[];
  categories: {
    category_id: number;
    name: string;
    characters: { character_id: number; form: string; transliteration: string; name: string; mastery: Mastery; attempts: number; accepted: number }[];
    attempts: number;
    accepted: number;
  }[];
  totals: { attempts: number; accepted: number; learned: number; characters: number };
  achievements: { key: string; title: string; description: string | null; earned: string }[];
  items: { key: string; name: string; quantity: number; acquired: string }[];
  sessions: { count: number; minutes: number; last: string | null; recent: { id: number; level: string; started: string; minutes: number | null }[] };
  download: { version: string } | null;
};

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Manila" });
const whenFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const STATUS: Record<number, QuestStatus> = {
  [QUEST_STATUS.completed]: "completed",
  [QUEST_STATUS.inProgress]: "in_progress",
  [QUEST_STATUS.notStarted]: "not_started",
};
const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));

export async function loadPlayerDashboard(accountId: number): Promise<PlayerDashboard> {
  await connectDb();
  const noId = { _id: 0 } as const;
  const [profile, levels, quests, tasks, progress, categories, characters, sessions, achievements, items, active] = await Promise.all([
    PlayerProfile.findOne({ account_id: accountId }, noId).lean(),
    GameLevel.find({}, noId).sort({ level_order: 1 }).lean(),
    Quest.find({}, noId).sort({ quest_order: 1, quest_id: 1 }).lean(),
    QuestTask.aggregate<{ _id: number; n: number }>([{ $group: { _id: "$quest_id", n: { $sum: 1 } } }]),
    PlayerQuestProgress.find({ account_id: accountId }, noId).lean(),
    Category.find({}, noId).sort({ category_id: 1 }).lean(),
    KawiCharacter.find({}, noId).sort({ character_id: 1 }).lean(),
    GameSession.find({ account_id: accountId }, noId).sort({ started_at: -1 }).lean(),
    PlayerAchievement.find({ account_id: accountId }, noId).sort({ earned_at: -1 }).lean(),
    PlayerItem.find({ account_id: accountId, quantity: { $gt: 0 } }, noId).sort({ item_name: 1 }).lean(),
    GameBuild.findOne({ platform: "android", is_active: true }, { _id: 0, version: 1 }).lean(),
  ]);

  // Writing attempts belong to sessions; tally them per character.
  const perChar = await PlayerAttempt.aggregate<{ _id: number; attempts: number; accepted: number }>([
    { $match: { session_id: { $in: sessions.map((s) => s.session_id) } } },
    { $group: { _id: "$character_id", attempts: { $sum: 1 }, accepted: { $sum: { $cond: ["$accepted", 1, 0] } } } },
  ]);
  const tally = new Map(perChar.map((t) => [t._id, t]));

  const levelName = new Map(levels.map((l) => [l.level_id, l.area_name]));
  const current = profile ? levels.find((l) => l.level_id === profile.current_level) ?? null : null;
  const taskCount = new Map(tasks.map((t) => [t._id, t.n]));
  const progressBy = new Map(progress.map((p) => [p.quest_id, p]));

  const cats = categories.map((cat) => {
    const chars = characters
      .filter((c) => c.category_id === cat.category_id)
      .map((c) => {
        const t = tally.get(c.character_id);
        const mastery: Mastery = t?.accepted ? "learned" : t?.attempts ? "practising" : "new";
        return {
          character_id: c.character_id,
          form: formOf(c),
          transliteration: c.transliteration,
          name: c.name,
          mastery,
          attempts: t?.attempts ?? 0,
          accepted: t?.accepted ?? 0,
        };
      });
    return {
      category_id: cat.category_id,
      name: cat.category_name,
      characters: chars,
      attempts: chars.reduce((a, c) => a + c.attempts, 0),
      accepted: chars.reduce((a, c) => a + c.accepted, 0),
    };
  });

  const ended = sessions.filter((s) => s.ended_at);
  return {
    level: current ? { order: current.level_order, name: current.area_name, total: levels.length } : null,
    tutorialCompleted: profile?.tutorial_completed ?? false,
    quests: quests.map((q) => {
      const p = progressBy.get(q.quest_id);
      const total = taskCount.get(q.quest_id) ?? 0;
      return {
        quest_id: q.quest_id,
        name: q.quest_name,
        level: levelName.get(q.level_id) ?? "",
        parent: q.parent_quest_id,
        status: p ? STATUS[p.status] ?? "not_started" : "not_started",
        done: Math.min(p?.completed_tasks ?? 0, total || Infinity),
        total,
      };
    }),
    categories: cats,
    totals: {
      attempts: cats.reduce((a, c) => a + c.attempts, 0),
      accepted: cats.reduce((a, c) => a + c.accepted, 0),
      learned: cats.reduce((a, c) => a + c.characters.filter((ch) => ch.mastery === "learned").length, 0),
      characters: characters.length,
    },
    achievements: achievements.map((a) => ({ key: a.achievement_key, title: a.title, description: a.description, earned: dateFmt.format(a.earned_at) })),
    items: items.map((i) => ({ key: i.item_key, name: i.item_name, quantity: i.quantity, acquired: dateFmt.format(i.acquired_at) })),
    sessions: {
      count: sessions.length,
      minutes: ended.reduce((a, s) => a + minutesBetween(s.started_at, s.ended_at!), 0),
      last: sessions[0] ? whenFmt.format(sessions[0].started_at) : null,
      recent: sessions.slice(0, 5).map((s) => ({
        id: s.session_id,
        level: levelName.get(s.level_id) ?? "",
        started: whenFmt.format(s.started_at),
        minutes: s.ended_at ? minutesBetween(s.started_at, s.ended_at) : null,
      })),
    },
    download: active ? { version: active.version } : null,
  };
}

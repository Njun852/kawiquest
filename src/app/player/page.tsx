import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Banner, ButtonLink, Card, CardBody, CardHead, CopperTile, PageHead, ProgressBar, StatTile, StatusBadge } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadPlayerDashboard, type PlayerDashboard } from "@/lib/player/queries";

export const metadata: Metadata = { title: "Dashboard" };

const nf = new Intl.NumberFormat("en");
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const hours = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

/** FR7: the player's game data — progress, quests, assessment results, achievements and items — view only. */
export default function PlayerHome() {
  return (
    <Suspense fallback={<PageHead eyebrow="My progress" title="Dashboard" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const me = await requireAccount(["player"]);
  const d = await loadPlayerDashboard(me.id);
  const questsDone = d.quests.filter((q) => q.status === "completed").length;
  const nothingYet = d.sessions.count === 0 && d.totals.attempts === 0;

  return (
    <>
      <PageHead eyebrow="My progress" title={`Hi, ${me.firstName}`} />
      {nothingYet && (
        <Banner tone="wait" title="No game data yet.">
          Play KawiQuest on your Android phone and sign in with this account. Your progress shows here after the game
          syncs.
        </Banner>
      )}
      {nothingYet && d.download && (
        <div>
          <ButtonLink href="/downloads/kawiquest.apk" variant="primary" icon="download">
            Download KawiQuest {d.download.version}
          </ButtonLink>
        </div>
      )}

      <div className="kq-grid kq-g4">
        <StatTile
          label="Current area"
          value={<span className="kq-stat__text">{d.level?.name ?? "Not started"}</span>}
          footnote={d.level ? `Area ${d.level.order} of ${d.level.total}${d.tutorialCompleted ? "" : " · tutorial not finished"}` : "Begins at the House"}
        />
        <StatTile label="Quests completed" value={nf.format(questsDone)} target={nf.format(d.quests.length)} percent={pct(questsDone, d.quests.length)} />
        <StatTile
          label="Characters written correctly"
          value={nf.format(d.totals.learned)}
          target={nf.format(d.totals.characters)}
          percent={pct(d.totals.learned, d.totals.characters)}
          tone="patina"
        />
        <StatTile
          label="Writing accuracy"
          value={d.totals.attempts ? `${pct(d.totals.accepted, d.totals.attempts)}%` : "—"}
          footnote={`${nf.format(d.totals.accepted)} accepted of ${nf.format(d.totals.attempts)} attempts`}
        />
      </div>

      <div className="kq-grid kq-g-2-1">
        <Assessment d={d} />
        <div className="kq-stack" style={{ gap: 16 }}>
          <Quests d={d} />
          <Sessions d={d} />
        </div>
      </div>

      <div className="kq-grid kq-g2">
        <Achievements d={d} />
        <Items d={d} />
      </div>
    </>
  );
}

const MASTERY_STATE = { learned: "learned", practising: "default", new: "locked" } as const;
const MASTERY_WORD = { learned: "written correctly", practising: "practising", new: "not tried yet" } as const;

/** Assessment results: every character's state from the game's writing attempts, by category. */
function Assessment({ d }: { d: PlayerDashboard }) {
  return (
    <Card>
      <CardHead title="Assessment results">
        <span className="kq-row kq-mastery-legend" style={{ gap: 12, fontSize: 12 }}>
          <span>
            <CopperTile form="𑼒" size="sm" state="learned" /> Written correctly
          </span>
          <span>
            <CopperTile form="𑼒" size="sm" /> Practising
          </span>
          <span>
            <CopperTile form="𑼒" size="sm" state="locked" /> Not tried
          </span>
        </span>
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 18 }}>
        {d.categories.map((cat) => (
          <section key={cat.category_id} className="kq-stack" style={{ gap: 8 }}>
            <div className="kq-row" style={{ justifyContent: "space-between" }}>
              <h3 className="kq-h-card" style={{ margin: 0 }}>
                {cat.name}
              </h3>
              <span className="kq-muted" style={{ fontSize: 13 }}>
                {cat.attempts ? `${pct(cat.accepted, cat.attempts)}% accepted · ${nf.format(cat.attempts)} attempts` : "No attempts yet"}
              </span>
            </div>
            <ul className="kq-mastery" aria-label={`${cat.name} characters`}>
              {cat.characters.map((c) => (
                <li key={c.character_id} title={`${c.transliteration} (${c.name}): ${MASTERY_WORD[c.mastery]}${c.attempts ? `, ${c.accepted} of ${c.attempts} accepted` : ""}`}>
                  <CopperTile form={c.form} size="md" state={MASTERY_STATE[c.mastery]} label={`${c.transliteration}, ${MASTERY_WORD[c.mastery]}`} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardBody>
    </Card>
  );
}

function Quests({ d }: { d: PlayerDashboard }) {
  const top = d.quests.filter((q) => q.parent == null);
  return (
    <Card>
      <CardHead title="Quests" />
      <CardBody className="kq-stack" style={{ gap: 12 }}>
        {top.length === 0 && <p className="kq-muted" style={{ margin: 0 }}>No quests yet.</p>}
        {top.map((q) => (
          <div key={q.quest_id} className="kq-stack" style={{ gap: 6 }}>
            <div className="kq-row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: 8 }}>
              <span>
                <strong>{q.name}</strong>
                <div className="kq-muted" style={{ fontSize: 12 }}>
                  {q.level}
                </div>
              </span>
              <StatusBadge status={q.status} />
            </div>
            {q.total > 0 && <ProgressBar percent={pct(q.done, q.total)} label={`${q.name}: ${q.done} of ${q.total} tasks`} />}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Sessions({ d }: { d: PlayerDashboard }) {
  return (
    <Card>
      <CardHead title="Play sessions">
        <span className="kq-muted" style={{ fontSize: 13 }}>
          {d.sessions.count ? `${d.sessions.count} · ${hours(d.sessions.minutes)}` : "None yet"}
        </span>
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 8, fontSize: 14 }}>
        {d.sessions.recent.length === 0 && <p className="kq-muted" style={{ margin: 0 }}>Your sessions appear here after you play.</p>}
        {d.sessions.recent.map((s) => (
          <div key={s.id} className="kq-row" style={{ justifyContent: "space-between" }}>
            <span>
              {s.level}
              <div className="kq-muted" style={{ fontSize: 12 }}>
                {s.started}
              </div>
            </span>
            <span className="kq-muted">{s.minutes == null ? "In progress" : hours(s.minutes)}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Achievements({ d }: { d: PlayerDashboard }) {
  return (
    <Card>
      <CardHead title="Achievements">
        <span className="kq-muted" style={{ fontSize: 13 }}>
          {d.achievements.length}
        </span>
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 10 }}>
        {d.achievements.length === 0 && <p className="kq-muted" style={{ margin: 0 }}>Earn achievements in the game.</p>}
        {d.achievements.map((a) => (
          <div key={a.key} className="kq-row" style={{ flexWrap: "nowrap", gap: 12, alignItems: "flex-start" }}>
            <Badge tone="brand" icon="star">
              {a.earned}
            </Badge>
            <span>
              <strong>{a.title}</strong>
              {a.description && (
                <div className="kq-muted" style={{ fontSize: 13 }}>
                  {a.description}
                </div>
              )}
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Items({ d }: { d: PlayerDashboard }) {
  return (
    <Card>
      <CardHead title="Items">
        <span className="kq-muted" style={{ fontSize: 13 }}>
          {d.items.length}
        </span>
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 8, fontSize: 14 }}>
        {d.items.length === 0 && <p className="kq-muted" style={{ margin: 0 }}>Items you collect in the game appear here.</p>}
        {d.items.map((i) => (
          <div key={i.key} className="kq-row" style={{ justifyContent: "space-between" }}>
            <span>
              {i.name}
              <div className="kq-muted" style={{ fontSize: 12 }}>
                Since {i.acquired}
              </div>
            </span>
            <span className="kq-mono">× {i.quantity}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

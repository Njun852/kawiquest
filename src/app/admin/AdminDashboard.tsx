"use client";

import { ChartCard, EmptyChart, Legend } from "@/components/charts/ChartCard";
import { coverageBand, CoverageGrid, HBars, ProgressBars, SERIES, StackedColumns } from "@/components/charts/Charts";
import { TipRow } from "@/components/charts/useTip";
import { Card, CardBody, CardHead, CopperTile, DataTable, PageHead, StatTile, StatusBadge } from "@/components/ui";
import type { Analytics } from "@/lib/analytics/queries";

const nf = new Intl.NumberFormat("en");
const compactNf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
/** Stat-tile figures auto-compact from 10,000 (11.7K) so they fit the tile. */
const fig = (n: number) => (n >= 10_000 ? compactNf.format(n) : nf.format(n));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function hours(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${minutes % 60} min`;
}

export function AdminDashboard({ data }: { data: Analytics }) {
  const { accounts, dataset, game } = data;
  const r = accounts.byRole;
  const anyAttempts = game.attempts > 0;

  return (
    <>
      <PageHead eyebrow="Analytics" title="Platform analytics" />

      <div className="kq-grid kq-g4">
        <StatTile
          label="Accounts"
          value={fig(accounts.total)}
          footnote={`${r.player} players · ${r.contributor} contributors · ${r.validator} validators · ${r.admin} admins`}
        />
        <StatTile
          label="Writers"
          value={fig(dataset.writers)}
          target={dataset.targetWriters}
          percent={pct(dataset.writers, dataset.targetWriters)}
          footnote="Contributors with at least one character sample"
        />
        <StatTile
          label="Handwriting samples"
          value={fig(dataset.characterSamples)}
          target={fig(dataset.targetSamples)}
          percent={pct(dataset.characterSamples, dataset.targetSamples)}
          footnote={`${nf.format(dataset.characterSamples)} of ${nf.format(dataset.targetSamples)} · ${nf.format(dataset.nonCharacter)} non-character`}
        />
        <StatTile
          label="Game sessions"
          value={fig(game.sessions)}
          footnote={game.sessions ? `${game.players} player(s) · ${hours(game.minutesPlayed)} played` : "None synced from the game yet"}
        />
      </div>

      <ChartCard
        title="Class coverage"
        subtitle={`Samples per class against the target of ${dataset.targetPerClass} (${dataset.targetWriters} writers × 2 passes). Hover or focus a tile for its count.`}
        legend={
          <Legend
            items={[0, 1, 2, 3, 4].map((step) => ({
              label: ["No samples", "Under 25%", "25–60%", "60–99%", "Target reached"][step]!,
              color: `var(--cov-${step})`,
            }))}
          />
        }
        table={{
          columns: ["ID", "Character", "Samples", "% of target", "Band"],
          numeric: [true, false, true, true, false],
          rows: data.coverage.map((c) => [c.character_id, `${c.transliteration} · ${c.name}`, c.samples, `${c.percent}%`, coverageBand(c.percent).word]),
        }}
      >
        <CoverageGrid cells={data.coverage} target={dataset.targetPerClass} />
      </ChartCard>

      <div className="kq-grid kq-g2" style={{ alignItems: "start" }}>
        <ChartCard
          title="Samples by category"
          subtitle="Share of each category's sample target."
          table={{
            columns: ["Category", "Samples", "Target", "% of target"],
            numeric: [false, true, true, true],
            rows: data.byCategory.map((c) => [c.category, c.samples, c.target, `${pct(c.samples, c.target)}%`]),
          }}
        >
          <HBars
            rows={data.byCategory.map((c) => ({
              label: c.category,
              value: c.samples,
              max: c.target,
              display: `${pct(c.samples, c.target)}%`,
              tip: (
                <>
                  <div className="kq-tip__title">{c.category}</div>
                  <TipRow value={`${nf.format(c.samples)} / ${nf.format(c.target)}`} label="samples" />
                </>
              ),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Writing accuracy by category"
          subtitle="Share of in-game writing attempts the recognizer accepted."
          table={{
            columns: ["Category", "Attempts", "Accepted", "Accepted %"],
            numeric: [false, true, true, true],
            rows: data.byCategory.map((c) => [c.category, c.attempts, c.accepted, c.attempts ? `${pct(c.accepted, c.attempts)}%` : "not yet"]),
          }}
        >
          {anyAttempts ? (
            <HBars
              color={SERIES.accepted}
              rows={data.byCategory.map((c) => ({
                label: c.category,
                value: c.accepted,
                max: c.attempts,
                display: c.attempts ? `${pct(c.accepted, c.attempts)}%` : "not yet",
                tip: (
                  <>
                    <div className="kq-tip__title">{c.category}</div>
                    <TipRow value={c.attempts ? `${pct(c.accepted, c.attempts)}%` : "—"} label="accepted" />
                    <TipRow value={`${nf.format(c.accepted)} / ${nf.format(c.attempts)}`} label="attempts" />
                  </>
                ),
              }))}
            />
          ) : (
            <EmptyChart>No writing attempts synced from the game yet.</EmptyChart>
          )}
        </ChartCard>
      </div>

      <div className="kq-grid kq-g-2-1" style={{ alignItems: "start" }}>
        <ChartCard
          title="Writing attempts per week"
          subtitle="Last 8 weeks, Manila time."
          legend={
            anyAttempts ? (
              <Legend
                items={[
                  { label: "Accepted", color: SERIES.accepted },
                  { label: "Not accepted", color: SERIES.rejected },
                ]}
              />
            ) : undefined
          }
          table={{
            columns: ["Week of", "Accepted", "Not accepted", "Accepted %"],
            numeric: [false, true, true, true],
            rows: data.weekly.map((w) => [w.label, w.accepted, w.rejected, w.accepted + w.rejected ? `${pct(w.accepted, w.accepted + w.rejected)}%` : "—"]),
          }}
        >
          {data.weekly.some((w) => w.accepted + w.rejected > 0) ? (
            <StackedColumns weeks={data.weekly} />
          ) : (
            <EmptyChart>No writing attempts in the last 8 weeks.</EmptyChart>
          )}
        </ChartCard>

        <ChartCard
          title="Quest progress"
          subtitle={`Share of the ${nf.format(r.player)} player(s) who completed each top-level quest.`}
          legend={
            <Legend
              items={[
                { label: "Completed", color: SERIES.completed },
                { label: "In progress", color: SERIES.inProgress },
                { label: "Not started", color: "var(--surface-2)" },
              ]}
            />
          }
          table={{
            columns: ["Quest", "Completed", "In progress", "Not started"],
            numeric: [false, true, true, true],
            rows: data.quests.map((q) => [q.quest_name, q.completed, q.inProgress, q.notStarted]),
          }}
        >
          {r.player > 0 ? (
            <ProgressBars
              rows={data.quests.map((q) => ({ label: q.quest_name, completed: q.completed, inProgress: q.inProgress, total: q.completed + q.inProgress + q.notStarted }))}
            />
          ) : (
            <EmptyChart>No players yet.</EmptyChart>
          )}
        </ChartCard>
      </div>

      <div className="kq-grid kq-g-2-1" style={{ alignItems: "start" }}>
        <Card style={{ overflow: "hidden" }}>
          <CardHead title="Validator throughput">
            <span className="kq-muted" style={{ fontSize: 13 }}>
              Decisions recorded per validator
            </span>
          </CardHead>
          <DataTable
            caption="Validator throughput"
            columns={[
              { key: "who", header: "Validator", render: (v) => <strong>{v.username}</strong> },
              { key: "reviewed", header: "Reviewed", kind: "num", render: (v) => nf.format(v.reviewed) },
              { key: "approved", header: "Approve", kind: "num", render: (v) => `${pct(v.approved, v.reviewed)}%` },
              { key: "rejected", header: "Reject", kind: "num", render: (v) => `${pct(v.rejected, v.reviewed)}%` },
              { key: "flagged", header: "Flag", kind: "num", render: (v) => `${pct(v.flagged, v.reviewed)}%` },
            ]}
            rows={data.throughput}
            rowKey={(v) => String(v.account_id)}
            empty="No decisions recorded yet."
          />
        </Card>
        <Card>
          <CardHead title="Validation status">
            <span className="kq-mono kq-muted">{nf.format(dataset.samples)}</span>
          </CardHead>
          <CardBody className="kq-stack" style={{ gap: 10, fontSize: 14 }}>
            {(["approved", "pending", "flagged", "rejected"] as const).map((st) => (
              <div key={st} className="kq-row" style={{ justifyContent: "space-between" }}>
                <StatusBadge status={st} />
                <span className="kq-mono">
                  {nf.format(data.validation[st])} <span className="kq-muted">· {pct(data.validation[st], dataset.samples)}%</span>
                </span>
              </div>
            ))}
            <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
              Each sample counts once, by its latest decision.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card style={{ overflow: "hidden" }}>
        <CardHead title="Hardest characters">
          <span className="kq-muted" style={{ fontSize: 13 }}>
            Lowest accepted rate in the game, at least 5 attempts
          </span>
        </CardHead>
        <DataTable
          caption="Hardest characters"
          columns={[
            { key: "form", header: "Form", render: (h) => <CopperTile form={h.form} size="md" label={h.transliteration} /> },
            { key: "name", header: "Character", render: (h) => <><strong>{h.transliteration}</strong> <span className="kq-muted">· {h.name}</span></> },
            { key: "attempts", header: "Attempts", kind: "num", render: (h) => nf.format(h.attempts) },
            { key: "accepted", header: "Accepted", kind: "num", render: (h) => `${Math.round(h.rate * 100)}%` },
          ]}
          rows={data.hardest}
          rowKey={(h) => String(h.character_id)}
          empty="Not enough writing attempts yet."
        />
      </Card>

      <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
        Not shown: recognition confidence, time spent per review, and samples over time. The data model doesn&apos;t
        record them.
      </p>
    </>
  );
}

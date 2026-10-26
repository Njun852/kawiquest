"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { TipRow, useTip } from "./useTip";

// Chart marks per the dataviz spec: bars <= 24px thick with a 4px rounded data end and a square baseline, a 2px
// surface gap between touching segments, hairline grid, labels in text tokens, values selectively at the tip.

export const SERIES = {
  copper: "var(--copper)", // single-series magnitude
  accepted: "var(--ok)", // validated pair: #2a7a40 / #e9a066
  rejected: "var(--copper-on-dark)",
  completed: "var(--ok)", // validated ordinal ramp, light → dark: #5bc56a → #2a7a40
  inProgress: "var(--good-bright)",
};

const nf = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Horizontal bars, one series (nominal categories all take the same hue; the title names the measure). */
export function HBars({
  rows,
  color = SERIES.copper,
  unit = "",
}: {
  rows: { label: string; value: number; max: number; display: string; tip: ReactNode }[];
  color?: string;
  unit?: string;
}) {
  const { bind, node } = useTip();
  return (
    <div className="kq-hbars">
      {rows.map((r) => {
        const pct = r.max > 0 ? Math.min(100, (r.value / r.max) * 100) : 0;
        return (
          <div key={r.label} className="kq-hbars__row">
            <span className="kq-hbars__label">{r.label}</span>
            <div className="kq-hbars__track" {...bind(r.tip, `${r.label}: ${r.display}${unit}`)}>
              <i style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="kq-hbars__value">{r.display}</span>
          </div>
        );
      })}
      {node}
    </div>
  );
}

/** Stacked columns over time: accepted (bottom) and not accepted (top), with a total on each cap. */
export function StackedColumns({ weeks }: { weeks: { label: string; accepted: number; rejected: number }[] }) {
  const { bind, node } = useTip();
  const max = Math.max(1, ...weeks.map((w) => w.accepted + w.rejected));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  return (
    <div className="kq-cols">
      <div className="kq-cols__plot">
        {ticks.map((t) => (
          <div key={t} className="kq-cols__grid" style={{ bottom: `${(t / top) * 100}%` }}>
            <span>{compact.format(t)}</span>
          </div>
        ))}
        {weeks.map((w, i) => {
          const total = w.accepted + w.rejected;
          // Label selectively: the latest week and the busiest one.
          const labelled = total > 0 && (i === weeks.length - 1 || total === max);
          const rate = total ? Math.round((w.accepted / total) * 100) : null;
          return (
            <div
              key={w.label}
              className="kq-cols__slot"
              {...bind(
                <>
                  <div className="kq-tip__title">Week of {w.label}</div>
                  <TipRow color={SERIES.accepted} value={nf.format(w.accepted)} label="accepted" />
                  <TipRow color={SERIES.rejected} value={nf.format(w.rejected)} label="not accepted" />
                  {rate != null && <TipRow value={`${rate}%`} label="accepted rate" />}
                </>,
                `Week of ${w.label}: ${w.accepted} accepted, ${w.rejected} not accepted`,
              )}
            >
              <div className="kq-cols__stack" style={{ height: `${(total / top) * 100}%` }}>
                {labelled && <span className="kq-cols__cap">{compact.format(total)}</span>}
                {w.rejected > 0 && <i className="kq-cols__seg kq-cols__seg--top" style={{ flexGrow: w.rejected, background: SERIES.rejected }} />}
                {w.accepted > 0 && (
                  <i className={cx("kq-cols__seg", w.rejected === 0 && "kq-cols__seg--top")} style={{ flexGrow: w.accepted, background: SERIES.accepted }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="kq-cols__axis">
        {weeks.map((w) => (
          <span key={w.label}>{w.label}</span>
        ))}
      </div>
      {node}
    </div>
  );
}

/** Horizontal stacked bars for an ordered status (completed / in progress / not started = the empty track). */
export function ProgressBars({ rows }: { rows: { label: string; completed: number; inProgress: number; total: number }[] }) {
  const { bind, node } = useTip();
  return (
    <div className="kq-hbars">
      {rows.map((r) => {
        const pc = r.total ? (r.completed / r.total) * 100 : 0;
        const pp = r.total ? (r.inProgress / r.total) * 100 : 0;
        const notStarted = Math.max(0, r.total - r.completed - r.inProgress);
        return (
          <div key={r.label} className="kq-hbars__row">
            <span className="kq-hbars__label">{r.label}</span>
            <div
              className="kq-hbars__track kq-hbars__track--stack"
              {...bind(
                <>
                  <div className="kq-tip__title">{r.label}</div>
                  <TipRow color={SERIES.completed} value={nf.format(r.completed)} label="completed" />
                  <TipRow color={SERIES.inProgress} value={nf.format(r.inProgress)} label="in progress" />
                  <TipRow value={nf.format(notStarted)} label="not started" />
                </>,
                `${r.label}: ${r.completed} completed, ${r.inProgress} in progress, ${notStarted} not started`,
              )}
            >
              {pc > 0 && <i style={{ width: `${pc}%`, background: SERIES.completed }} />}
              {pp > 0 && <i style={{ width: `${pp}%`, background: SERIES.inProgress }} />}
            </div>
            <span className="kq-hbars__value">{r.total ? `${Math.round(pc)}%` : "—"}</span>
          </div>
        );
      })}
      {node}
    </div>
  );
}

/** Coverage bands from the design system (cov-0 … cov-4), always paired with the bar length and a word. */
export function coverageBand(percent: number) {
  if (percent <= 0) return { step: 0, word: "No samples" };
  if (percent < 25) return { step: 1, word: "Under 25% of target" };
  if (percent < 60) return { step: 2, word: "25–60% of target" };
  if (percent < 100) return { step: 3, word: "60–99% of target" };
  return { step: 4, word: "Target reached" };
}

export function CoverageGrid({
  cells,
  target,
}: {
  cells: { character_id: number; form: string; name: string; transliteration: string; samples: number; percent: number }[];
  target: number;
}) {
  const { bind, node } = useTip();
  return (
    <>
      <div className="kq-covgrid">
        {cells.map((c) => {
          const band = coverageBand(c.percent);
          return (
            <span
              key={c.character_id}
              lang="kaw"
              {...bind(
                <>
                  <div className="kq-tip__title">
                    {c.transliteration} · {c.name}
                  </div>
                  <TipRow value={`${nf.format(c.samples)} / ${target}`} label="samples" />
                  <TipRow value={`${c.percent}%`} label={band.word} />
                </>,
                `${c.transliteration}, ${c.name}: ${c.samples} of ${target} samples, ${band.word}`,
              )}
            >
              {c.form}
              <i style={{ width: `${Math.min(100, c.percent)}%`, background: `var(--cov-${band.step || 1})` }} />
            </span>
          );
        })}
      </div>
      {node}
    </>
  );
}

/** Round tick values for a 0-based axis (0, 5, 10 … or 0, 1K, 2K …). */
function niceTicks(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let t = 0; t <= max + step * 0.999; t += step) out.push(Math.round(t * 100) / 100);
  return out.length > 1 ? out : [0, Math.max(1, max)];
}

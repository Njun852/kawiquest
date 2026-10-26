import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Copper toward a collection target; patina toward a validation or quality target. */
export function ProgressBar({ percent, tone = "copper", label }: { percent: number; tone?: "copper" | "patina"; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cx("kq-bar", tone === "patina" && "kq-bar--patina")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <i style={{ width: `${clamped}%` }} />
    </div>
  );
}

// One figure per tile; don't invent deltas the data doesn't support.
export function StatTile({
  label,
  value,
  target,
  percent,
  tone,
  footnote,
}: {
  label: string;
  value: ReactNode;
  target?: ReactNode;
  percent?: number;
  tone?: "copper" | "patina";
  footnote?: ReactNode;
}) {
  return (
    <div className="kq-card kq-stat">
      <span className="kq-label">{label}</span>
      <span className="kq-stat__num">
        {value}
        {target != null && <small> / {target}</small>}
      </span>
      {percent != null && <ProgressBar percent={percent} tone={tone} label={label} />}
      {footnote && <span className="kq-stat__foot">{footnote}</span>}
    </div>
  );
}

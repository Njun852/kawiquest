"use client";

import { useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";

/**
 * Per-mark hover/focus tooltip (dataviz: the mark is the hit target; same details on keyboard focus as on hover).
 * Content is React nodes, so names from the database are rendered as text, never as HTML.
 */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);

  const bind = (content: ReactNode, label: string) => ({
    tabIndex: 0,
    "aria-label": label,
    onPointerEnter: (e: PointerEvent) => setTip({ x: e.clientX, y: e.clientY, content }),
    onPointerMove: (e: PointerEvent) => setTip({ x: e.clientX, y: e.clientY, content }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, content });
    },
    onBlur: () => setTip(null),
  });

  const node = tip ? (
    <div className="kq-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  ) : null;

  return { bind, node };
}

/** A tooltip row: line key in the series color, value first (strong), label after (muted). */
export function TipRow({ color, value, label }: { color?: string; value: ReactNode; label: ReactNode }) {
  return (
    <div className="kq-tip__row">
      {color && <i style={{ background: color }} />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

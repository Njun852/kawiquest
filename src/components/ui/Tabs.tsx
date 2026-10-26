import Link from "next/link";
import type { ReactNode } from "react";

export type TabItem = { value: string; label: ReactNode; count?: ReactNode; href?: string };

// Each control takes either `href` per item (URL-driven, works from server pages)
// or `onChange` (client state). Hook-free so it renders on either side.

/** Plain text tabs, name over count; the active one underlined in copper. */
export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
}) {
  return (
    <div className="kq-tabs" role="group" aria-label={label}>
      {items.map((t) => {
        const active = t.value === value;
        const inner = (
          <>
            {t.label}
            {t.count != null && <span>{t.count}</span>}
          </>
        );
        return t.href ? (
          <Link key={t.value} href={t.href} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <button key={t.value} type="button" aria-pressed={active} onClick={onChange && (() => onChange(t.value))}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/** A surface-2 track with a white selected segment. */
export function Segmented({
  items,
  value,
  onChange,
  label,
}: {
  items: Omit<TabItem, "count">[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
}) {
  return (
    <div className="kq-seg" role="group" aria-label={label}>
      {items.map((t) => {
        const active = t.value === value;
        return t.href ? (
          <Link key={t.value} href={t.href} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        ) : (
          <button key={t.value} type="button" aria-pressed={active} onClick={onChange && (() => onChange(t.value))}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

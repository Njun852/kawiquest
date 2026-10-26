import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

// surface-1, 1px line border, 12px radius, shadow-1.
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx("kq-card", className)} {...rest} />;
}

export function CardHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="kq-card__head">
      <h2 className="kq-h-card">{title}</h2>
      {children}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("kq-card__body", className)} {...rest} />;
}

/** Eyebrow + display-lg title + actions, at the top of every signed-in page. */
export function PageHead({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="kq-pagehead">
      <div>
        {eyebrow && <span className="kq-label">{eyebrow}</span>}
        <h1 className="kq-h-page">{title}</h1>
      </div>
      {actions && <div className="kq-row">{actions}</div>}
    </div>
  );
}

/** The card of filters that sits between the tabs and the table on CRUD pages. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="kq-card kq-filter">{children}</div>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className="kq-avatar" aria-hidden>
      {initials}
    </span>
  );
}

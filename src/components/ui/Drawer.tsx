"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

/**
 * The 340px edit drawer beside a table (filter bar → table → drawer). Below 960px it becomes a
 * right-hand sheet over a backdrop. Escape closes it; focus moves to it when it opens.
 */
export function Drawer({
  title,
  onClose,
  footer,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="kq-drawer-backdrop" onClick={onClose} aria-hidden />
      <aside ref={ref} className="kq-panel kq-drawer" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <div className="kq-drawer__head">
          <h2 className="kq-h-title">{title}</h2>
          <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="kq-drawer__body">
          {children}
          {footer && <div className="kq-drawer__foot">{footer}</div>}
        </div>
      </aside>
    </>
  );
}

/** Table and drawer side by side; the drawer column only exists while it is open. */
export function SplitLayout({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={open ? "kq-split" : "kq-split kq-split--closed"}>{children}</div>;
}

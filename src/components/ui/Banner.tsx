import type { ReactNode } from "react";
import { Icon } from "./Icon";

const icons = { ok: "check", bad: "x", wait: "clock" } as const;

/**
 * The result banner (kq-result): submission confirmations, sign-in errors, save results.
 * Feedback names the next step.
 */
export function Banner({ tone, title, children }: { tone: "ok" | "bad" | "wait"; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`kq-result kq-result--${tone}`} role={tone === "bad" ? "alert" : "status"}>
      <Icon name={icons[tone]} />
      <div>
        {title}
        {children && <small>{children}</small>}
      </div>
    </div>
  );
}

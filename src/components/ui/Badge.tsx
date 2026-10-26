import type { ReactNode } from "react";
import type { Role } from "@/lib/constants";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./Icon";

type Tone = "ok" | "bad" | "wait" | "brand" | "neutral";

export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={cx("kq-badge", tone !== "neutral" && `kq-badge--${tone}`)}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

// Status always carries an icon and a word: accept/reject are never told apart by colour alone.
const statuses = {
  approved: { tone: "ok", icon: "check", word: "Approved" },
  accepted: { tone: "ok", icon: "check", word: "Accepted" },
  completed: { tone: "ok", icon: "check", word: "Completed" },
  rejected: { tone: "bad", icon: "x", word: "Rejected" },
  pending: { tone: "wait", icon: "clock", word: "Pending" },
  flagged: { tone: "wait", icon: "clock", word: "Flagged" },
  in_progress: { tone: "wait", icon: "clock", word: "In progress" },
  not_started: { tone: "neutral", icon: undefined, word: "Not started" },
  locked: { tone: "neutral", icon: "lock", word: "Locked" },
} as const satisfies Record<string, { tone: Tone; icon: IconName | undefined; word: string }>;

export type Status = keyof typeof statuses;

export function StatusBadge({ status, children }: { status: Status; children?: ReactNode }) {
  const s = statuses[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {children ?? s.word}
    </Badge>
  );
}

export type { Role };

// AdminAccounts: admin = copper, validator = patina, contributor = ochre, player = neutral.
const roleTone: Record<Role, Tone> = { admin: "brand", validator: "ok", contributor: "wait", player: "neutral" };
const roleWord: Record<Role, string> = {
  admin: "Admin",
  validator: "Validator",
  contributor: "Contributor",
  player: "Player",
};

/** The role column in AdminAccounts. The sidebar brand row always uses tone "brand". */
export function RoleBadge({ role, brand }: { role: Role; brand?: boolean }) {
  return <Badge tone={brand ? "brand" : roleTone[role]}>{roleWord[role]}</Badge>;
}

import type { IconName } from "@/components/ui";
import type { Role } from "@/lib/constants";

/** A count shown at the right of a nav item, loaded separately (see NavCount). */
export type CountKey = "characters" | "levels" | "quests" | "mySubmissions" | "pending";

export type NavItem = { href: string; label: string; icon: IconName; count?: CountKey };
export type NavSection = { title: string; items: NavItem[] };

const account: NavSection = { title: "Account", items: [{ href: "/account", label: "Account settings", icon: "key" }] };

// The sidebar per role (design system: AdminShell), limited to what the ERD stores:
// no NPCs or items pages for admins.
export const NAV: Record<Role, NavSection[]> = {
  admin: [
    { title: "Analytics", items: [{ href: "/admin", label: "Platform analytics", icon: "chart" }] },
    {
      title: "Curriculum",
      items: [
        { href: "/admin/characters", label: "Kawi characters", icon: "shield", count: "characters" },
        { href: "/admin/levels", label: "Game levels", icon: "mountain", count: "levels" },
        { href: "/admin/quests", label: "Quests", icon: "scroll", count: "quests" },
      ],
    },
    { title: "People", items: [{ href: "/admin/accounts", label: "Accounts", icon: "users" }] },
    account,
  ],
  validator: [
    {
      title: "Review",
      items: [
        { href: "/validator", label: "Validation queue", icon: "shield", count: "pending" },
        { href: "/validator/reviews", label: "My reviews", icon: "history" },
        { href: "/validator/glyphs", label: "Reference glyphs", icon: "layers" },
      ],
    },
    account,
  ],
  player: [{ title: "My progress", items: [{ href: "/player", label: "Dashboard", icon: "grid" }] }, account],
  contributor: [
    {
      title: "Contribute",
      items: [
        { href: "/contribute", label: "Writing canvas", icon: "pen" },
        { href: "/contribute/submissions", label: "My submissions", icon: "history", count: "mySubmissions" },
      ],
    },
    account,
  ],
};

/** The landing page of each role is matched exactly; every other item also owns its sub-pages. */
export const LANDING_HREFS = new Set(["/admin", "/validator", "/player", "/contribute"]);

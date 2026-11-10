import type { IconName } from "@/components/ui";
import type { Role } from "@/lib/constants";

/** A count shown at the right of a nav item, loaded separately (see NavCount). */
export type CountKey = "mySubmissions" | "pending";

export type NavItem = { href: string; label: string; icon: IconName; count?: CountKey };
export type NavSection = { title: string; items: NavItem[] };

const account: NavSection = { title: "Account", items: [{ href: "/account", label: "Account settings", icon: "key" }] };

// The sidebar per role (design system: AdminShell), limited to the manuscript's requirements:
// admin FR1–FR3, validator FR4, player FR5–FR7, contributor = the dataset collection portal.
export const NAV: Record<Role, NavSection[]> = {
  admin: [
    { title: "Admin", items: [{ href: "/admin", label: "Dashboard", icon: "grid" }] },
    { title: "People", items: [{ href: "/admin/accounts", label: "Accounts", icon: "users" }] },
    { title: "Game", items: [{ href: "/admin/builds", label: "Game builds", icon: "box" }] },
    account,
  ],
  validator: [
    {
      title: "Expert validation",
      items: [
        { href: "/validator", label: "Reference forms", icon: "shield", count: "pending" },
        { href: "/validator/reviews", label: "My reviews", icon: "history" },
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

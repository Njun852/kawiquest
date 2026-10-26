"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Button, Icon, Logo, RoleBadge } from "@/components/ui";
import type { Role } from "@/lib/constants";
import { LANDING_HREFS, type NavSection } from "./nav";

/**
 * The sidebar: brand row with role badge, nav sections, and the signed-in footer.
 * On phones it collapses to a top bar with a menu button; the menu closes on navigation.
 */
export function ShellNav({
  role,
  sections,
  counts,
  footer,
}: {
  role: Role;
  sections: NavSection[];
  /** Server-rendered counts keyed by href. */
  counts: Record<string, ReactNode>;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  // The phone menu is open only on the page it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);
  const panelId = useId();

  const isActive = (href: string) =>
    LANDING_HREFS.has(href) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="kq-side" aria-label={`${role} navigation`} data-open={open}>
      <div className="kq-brand">
        <Link href={sections[0]!.items[0]!.href} style={{ textDecoration: "none" }} aria-label="KawiQuest home">
          <Logo />
        </Link>
        <RoleBadge role={role} brand />
        <Button
          className="kq-side__menu"
          variant="ghost"
          size="sm"
          icon={open ? "x" : "grid"}
          iconOnly
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close menu" : "Menu"}
        </Button>
      </div>
      <div className="kq-side__panel" id={panelId}>
        {sections.map((section) => (
          <div key={section.title} className="kq-stack" style={{ gap: 2 }}>
            <div className="kq-nav-sec kq-label">{section.title}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="kq-nav"
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <Icon name={item.icon} />
                {item.label}
                {counts[item.href]}
              </Link>
            ))}
          </div>
        ))}
        <div className="kq-side__foot">{footer}</div>
      </div>
    </nav>
  );
}

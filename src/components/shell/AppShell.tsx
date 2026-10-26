import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getCurrentAccount } from "@/lib/auth/session";
import type { Role } from "@/lib/constants";
import { NAV } from "./nav";
import { NavCount } from "./NavCount";
import { ShellNav } from "./ShellNav";
import { SidebarUser } from "./SidebarUser";

/**
 * The frame of every signed-in page: a 236px sidebar on surface-2 and the main column (design: AdminShell).
 * The nav itself is static per role, so it prerenders; counts and the signed-in footer stream in.
 * Access is still checked by each page (requireAccount) and by the proxy.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const sections = NAV[role];
  const counts = Object.fromEntries(
    sections
      .flatMap((s) => s.items)
      .filter((i) => i.count)
      .map((i) => [
        i.href,
        <Suspense key={i.href} fallback={null}>
          <NavCount count={i.count!} />
        </Suspense>,
      ]),
  );
  return (
    <div className="kq-shell">
      <ShellNav
        role={role}
        sections={sections}
        counts={counts}
        footer={
          <Suspense fallback={<span className="kq-muted" style={{ fontSize: 13 }}>Signed in</span>}>
            <SidebarUser />
          </Suspense>
        }
      />
      <main className="kq-main">{children}</main>
    </div>
  );
}

/** For pages every role shares (Account settings): the shell of whoever is signed in. */
export function SignedInShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="kq-shell" aria-busy />}>
      <ShellForCurrentAccount>{children}</ShellForCurrentAccount>
    </Suspense>
  );
}

async function ShellForCurrentAccount({ children }: { children: ReactNode }) {
  const me = await getCurrentAccount();
  if (!me) redirect("/api/auth/expired");
  return <AppShell role={me.role}>{children}</AppShell>;
}

import type { ReactNode } from "react";
import { Icon, Logo, type IconName } from "@/components/ui";

const landings: Array<{ icon: IconName; role: string; page: string }> = [
  { icon: "chart", role: "Admin", page: "Platform analytics" },
  { icon: "shield", role: "Validator", page: "Validation queue" },
  { icon: "grid", role: "Player", page: "Progress dashboard (view only)" },
  { icon: "pen", role: "Contributor", page: "Writing canvas" },
];

/** WebSignIn layout: the teal panel (logo, copper plate, where each role lands) beside a form card.
 *  Don't claim here that game and web share sign-in: the game signs players in its own way. */
export function AuthPlate({ children }: { children: ReactNode }) {
  return (
    <div className="kq-auth">
      <div className="kq-plate kq-auth__plate">
        <Logo />
        <div className="kq-stack" style={{ gap: 20, alignItems: "flex-start" }}>
          <span className="kq-tile kq-tile--rivets kq-auth__hero" lang="kaw" aria-hidden>
            𑼒
          </span>
          <h2>Learn to write Kawi, the script of the Laguna Copperplate.</h2>
        </div>
        <div>
          <span className="kq-label">Where you&apos;ll land</span>
          <div className="kq-landlist">
            {landings.map((l) => (
              <div key={l.role}>
                <Icon name={l.icon} />
                <b>{l.role}</b>
                <span>→ {l.page}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <main className="kq-auth__main">{children}</main>
    </div>
  );
}

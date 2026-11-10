import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { CopperPlate } from "./CopperPlate";

/** Sign-in layout: the teal panel (logo, the 3D copper plate, the line about Kawi) beside a form card.
 *  Don't claim here that game and web share sign-in: the game signs players in its own way. */
export function AuthPlate({ children }: { children: ReactNode }) {
  return (
    <div className="kq-auth">
      <div className="kq-plate kq-auth__plate">
        <Logo />
        <CopperPlate />
        <h2>Learn to write Kawi, the script of the Laguna Copperplate.</h2>
      </div>
      <main className="kq-auth__main">{children}</main>
    </div>
  );
}

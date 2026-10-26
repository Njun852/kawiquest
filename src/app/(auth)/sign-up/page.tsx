import type { Metadata } from "next";
import { CopperTile, Logo } from "@/components/ui";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="kq-plate kq-topbar">
        <Logo />
        <span className="kq-muted" style={{ fontSize: 14 }}>
          learn the ancient Kawi script
        </span>
        <span className="kq-muted" style={{ marginLeft: "auto", fontSize: 13 }}>
          STI College – General Santos
        </span>
      </header>
      <main className="kq-signup">
        <div className="kq-stack" style={{ gap: 20 }}>
          <span className="kq-label">Create your account</span>
          <h1>Learn it, or lend your hand to it.</h1>
          <p className="kq-muted kq-signup__lede">
            Play KawiQuest to learn to write the script of the Laguna Copperplate, or contribute handwriting that trains the
            recognizer.
          </p>
          <div className="kq-row kq-signup__tiles" style={{ gap: 16, marginTop: 8 }} aria-hidden>
            {["𑼄", "𑼒", "𑼔", "𑼣", "𑼒𑼶", "𑼒𑽂𑼱"].map((f) => (
              <CopperTile key={f} form={f} size="sm" />
            ))}
          </div>
        </div>
        <SignUpForm />
      </main>
    </div>
  );
}

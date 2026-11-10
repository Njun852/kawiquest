import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Card, CardBody, CardHead, PageHead, StatTile } from "@/components/ui";
import { loadDashboard } from "@/lib/accounts/dashboard";
import { requireAccount } from "@/lib/auth/session";
import { PASSES_PER_WRITER, TARGET_PER_CLASS } from "@/lib/constants";

export const metadata: Metadata = { title: "Dashboard" };

const nf = new Intl.NumberFormat("en");
const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);

export default function AdminHome() {
  return (
    <>
      <PageHead eyebrow="Admin" title="Dashboard" />
      <Suspense fallback={<div aria-busy />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireAccount(["admin"]);
  const d = await loadDashboard();
  const sampleTarget = d.inventory * TARGET_PER_CLASS;
  return (
    <>
      <div className="kq-grid kq-g4">
        <StatTile
          label="Accounts"
          value={nf.format(d.totalAccounts)}
          footnote={`${d.accounts.player} players · ${d.accounts.contributor} contributors · ${d.accounts.validator} validators · ${d.accounts.admin} admins`}
        />
        <StatTile
          label="Reference forms validated"
          value={nf.format(d.validatedForms)}
          target={nf.format(d.inventory)}
          percent={pct(d.validatedForms, d.inventory)}
          tone="patina"
          footnote="Approved or corrected by the Expert Validator"
        />
        <StatTile
          label="Writers"
          value={nf.format(d.writers)}
          target={nf.format(d.targetWriters)}
          percent={pct(d.writers, d.targetWriters)}
          footnote="Contributors with at least one sample"
        />
        <StatTile
          label="Character samples"
          value={nf.format(d.characterSamples)}
          target={nf.format(sampleTarget)}
          percent={pct(d.characterSamples, sampleTarget)}
          footnote={`${d.targetWriters} writers × ${PASSES_PER_WRITER} passes × ${d.inventory} · plus ${nf.format(d.nonCharacterSamples)} non-characters`}
        />
      </div>
      <Card>
        <CardHead title="Manage" />
        <CardBody className="kq-row" style={{ gap: 8 }}>
          <ButtonLink href="/admin/accounts" icon="users">
            Accounts
          </ButtonLink>
          <ButtonLink href="/admin/builds" icon="box">
            Game builds
          </ButtonLink>
        </CardBody>
      </Card>
    </>
  );
}

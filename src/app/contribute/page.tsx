import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadContributorState } from "@/lib/contribute/queries";
import { ContributeCanvas } from "./ContributeCanvas";

export const metadata: Metadata = { title: "Writing canvas" };

export default function ContributePage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Dataset contribution" title="Writing canvas" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const me = await requireAccount(["contributor"]);
  return <ContributeCanvas state={await loadContributorState(me.id)} />;
}

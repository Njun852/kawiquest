import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadCurriculum } from "@/lib/curriculum/queries";
import { QuestsAdmin } from "./QuestsAdmin";

export const metadata: Metadata = { title: "Quests" };

export default function QuestsPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Curriculum" title="Quests" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAccount(["admin"]);
  return <QuestsAdmin data={await loadCurriculum()} />;
}

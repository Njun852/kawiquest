import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadCurriculum } from "@/lib/curriculum/queries";
import { LevelsAdmin } from "./LevelsAdmin";

export const metadata: Metadata = { title: "Game levels" };

export default function LevelsPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Curriculum" title="Game levels" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAccount(["admin"]);
  return <LevelsAdmin data={await loadCurriculum()} />;
}

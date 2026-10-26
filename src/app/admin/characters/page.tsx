import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadCurriculum } from "@/lib/curriculum/queries";
import { CharactersAdmin } from "./CharactersAdmin";

export const metadata: Metadata = { title: "Kawi characters" };

export default function CharactersPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Curriculum" title="Kawi characters" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAccount(["admin"]);
  const data = await loadCurriculum();
  return <CharactersAdmin data={data} />;
}

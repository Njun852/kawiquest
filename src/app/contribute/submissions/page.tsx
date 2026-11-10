import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { Category, HandwritingSample, KawiCharacter } from "@/lib/models";
import { Submissions, type SubmissionRow } from "./Submissions";

export const metadata: Metadata = { title: "My submissions" };

const LIMIT = 120;

export default function SubmissionsPage() {
  return (
    <>
      <PageHead eyebrow="Contribute" title="My submissions" />
      <Suspense fallback={<div aria-busy />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const me = await requireAccount(["contributor"]);
  await connectDb();
  const [samples, total, characters, categories] = await Promise.all([
    HandwritingSample.find({ account_id: me.id }, { _id: 0 }).sort({ sample_id: -1 }).limit(LIMIT).lean(),
    HandwritingSample.countDocuments({ account_id: me.id }),
    KawiCharacter.find({}, { _id: 0, character_id: 1, name: 1, transliteration: 1, category_id: 1 }).lean(),
    Category.find({}, { _id: 0 }).lean(),
  ]);
  const byId = new Map(characters.map((c) => [c.character_id, c]));
  const categoryName = new Map(categories.map((c) => [c.category_id, c.category_name]));
  const rows: SubmissionRow[] = samples.map((s) => {
    const c = s.character_id != null ? byId.get(s.character_id) : undefined;
    return {
      sample_id: s.sample_id,
      image_path: s.image_path,
      is_non_character: s.is_non_character,
      label: s.is_non_character ? "Non-character" : c ? `${c.transliteration} · ${c.name}` : "Deleted character",
      category: s.is_non_character ? "Reject class" : c ? categoryName.get(c.category_id) ?? "" : "",
    };
  });
  return <Submissions rows={rows} total={total} shown={Math.min(total, LIMIT)} />;
}

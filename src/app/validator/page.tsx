import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadReview, REVIEW_FILTERS, type ReviewFilter } from "@/lib/validation/queries";
import { ReferenceReview } from "./ReferenceReview";

export const metadata: Metadata = { title: "Reference forms" };

export default function ValidatorHome({ searchParams }: PageProps<"/validator">) {
  return (
    <Suspense fallback={<PageHead eyebrow="Expert validation" title="Reference forms" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Content({ searchParams }: { searchParams: PageProps<"/validator">["searchParams"] }) {
  const me = await requireAccount(["validator"]);
  const sp = await searchParams;
  const status = one(sp.status);
  const filter: ReviewFilter = (REVIEW_FILTERS as readonly string[]).includes(status ?? "") ? (status as ReviewFilter) : "pending";
  const category = Number(one(sp.category)) || undefined;
  const data = await loadReview(me, { filter, categoryId: category });
  return <ReferenceReview data={data} params={{ status: filter, category: category ? String(category) : "" }} />;
}

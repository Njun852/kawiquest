import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadQueue, QUEUE_FILTERS, type QueueFilter } from "@/lib/validation/queries";
import { ValidationQueue } from "./ValidationQueue";

export const metadata: Metadata = { title: "Validation queue" };

export default function ValidatorHome({ searchParams }: PageProps<"/validator">) {
  return (
    <Suspense fallback={<PageHead eyebrow="Dataset quality" title="Validation queue" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Content({ searchParams }: { searchParams: PageProps<"/validator">["searchParams"] }) {
  const me = await requireAccount(["validator"]);
  const sp = await searchParams;
  const status = one(sp.status);
  const filter: QueueFilter = (QUEUE_FILTERS as readonly string[]).includes(status ?? "") ? (status as QueueFilter) : "pending";
  const character = one(sp.character);
  const category = Number(one(sp.category)) || undefined;
  const data = await loadQueue(me, {
    filter,
    characterId: character === "non" ? "non" : Number(character) || undefined,
    categoryId: category,
  });
  return <ValidationQueue data={data} params={{ status: filter, character: character ?? "", category: category ? String(category) : "" }} />;
}

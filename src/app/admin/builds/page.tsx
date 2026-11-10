import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadBuilds } from "@/lib/builds/queries";
import { MAX_APK_BYTES } from "@/lib/builds/upload";
import { BuildsAdmin } from "./BuildsAdmin";

export const metadata: Metadata = { title: "Game builds" };

export default function BuildsPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Game" title="Game builds" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAccount(["admin"]);
  return <BuildsAdmin builds={await loadBuilds()} maxBytes={MAX_APK_BYTES} />;
}

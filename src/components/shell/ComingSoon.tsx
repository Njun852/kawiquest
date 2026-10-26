import { Suspense } from "react";
import { Banner, PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import type { Role } from "@/lib/constants";

/** Placeholder content for a page whose module isn't built yet. Still checks access. */
export function ComingSoon({ role, eyebrow, title, comingIn }: { role: Role; eyebrow: string; title: string; comingIn: string }) {
  return (
    <>
      <PageHead eyebrow={eyebrow} title={title} />
      <Suspense fallback={null}>
        <Gate role={role} comingIn={comingIn} />
      </Suspense>
    </>
  );
}

async function Gate({ role, comingIn }: { role: Role; comingIn: string }) {
  await requireAccount([role]);
  return <Banner tone="wait" title="Not built yet.">This page arrives with {comingIn}.</Banner>;
}

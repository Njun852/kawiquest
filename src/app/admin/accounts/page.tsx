import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { loadAccounts } from "@/lib/accounts/queries";
import { requireAccount } from "@/lib/auth/session";
import { AccountsAdmin } from "./AccountsAdmin";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="People" title="Accounts" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const me = await requireAccount(["admin"]);
  return <AccountsAdmin accounts={await loadAccounts()} meId={me.id} />;
}

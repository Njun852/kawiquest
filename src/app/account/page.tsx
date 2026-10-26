import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { PasswordForm, ProfileForm } from "./AccountForms";

export const metadata: Metadata = { title: "Account settings" };

export default function AccountPage() {
  return (
    <>
      <PageHead eyebrow="Account" title="Account settings" />
      <Suspense fallback={<div aria-busy />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const me = await requireAccount();
  return (
    <div className="kq-grid kq-g2" style={{ alignItems: "start" }}>
      <ProfileForm
        accountId={me.id}
        initial={{ first_name: me.firstName, last_name: me.lastName, birthday: me.birthday ?? "", username: me.username, email: me.email }}
      />
      <PasswordForm />
    </div>
  );
}

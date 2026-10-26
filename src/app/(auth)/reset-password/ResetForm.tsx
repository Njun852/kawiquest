"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Banner, Button, PasswordField } from "@/components/ui";
import type { FormState } from "@/lib/auth/schemas";
import { resetPassword } from "../actions";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  const err = state.fieldErrors ?? {};

  if (!token) {
    return (
      <div className="kq-panel kq-auth__form">
        <h1 className="kq-h-page">Link incomplete</h1>
        <Banner tone="bad" title="This link is missing its code.">
          Open the link from your email again, or ask for a new one.
        </Banner>
        <Link href="/forgot-password" className="kq-btn kq-btn--primary kq-btn--lg">
          Ask for a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="kq-panel kq-auth__form" noValidate>
      <div>
        <h1 className="kq-h-page">Choose a password</h1>
        <p className="kq-muted">Use at least 8 characters.</p>
      </div>
      <input type="hidden" name="token" value={token} />
      <PasswordField label="New password" name="password" autoComplete="new-password" error={err.password} hint="At least 8 characters." autoFocus />
      <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" error={err.confirm} />
      {(state.error || err.token) && (
        <Banner tone="bad" title={state.error ?? "This link has expired or was already used. Ask for a new one."}>
          <Link href="/forgot-password">Ask for a new link</Link>
        </Banner>
      )}
      <Button type="submit" variant="primary" size="lg" pending={pending} style={{ width: "100%" }}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}

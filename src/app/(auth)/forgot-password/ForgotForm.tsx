"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner, Button, TextField } from "@/components/ui";
import type { FormState } from "@/lib/auth/schemas";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="kq-panel kq-auth__form" noValidate>
      <div>
        <h1 className="kq-h-page">Forgot password?</h1>
        <p className="kq-muted">Enter your email or username and we&apos;ll email you a link to choose a new one.</p>
      </div>
      <TextField
        label="Email or username"
        name="identifier"
        autoComplete="username"
        defaultValue={state.values?.identifier}
        error={state.fieldErrors?.identifier}
        autoFocus
      />
      {state.success && <Banner tone="ok" title="Check your email.">{state.success}</Banner>}
      <Button type="submit" variant="primary" size="lg" pending={pending} style={{ width: "100%" }}>
        {pending ? "Sending…" : state.success ? "Send again" : "Send link"}
      </Button>
      <p style={{ fontSize: 14, textAlign: "center" }}>
        <Link href="/sign-in" style={{ fontWeight: 600 }}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

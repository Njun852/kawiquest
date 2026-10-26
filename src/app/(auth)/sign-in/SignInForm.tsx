"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Banner, Button, Checkbox, PasswordField, TextField } from "@/components/ui";
import type { FormState } from "@/lib/auth/schemas";
import { signIn } from "../actions";

export function SignInForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action} className="kq-panel kq-auth__form" noValidate>
      <div>
        <h1 className="kq-h-page">Sign in</h1>
        <p className="kq-muted">Welcome back to KawiQuest.</p>
      </div>

      {!state.error && params.get("reset") && (
        <Banner tone="ok" title="Password updated.">
          Sign in with your new password.
        </Banner>
      )}
      {!state.error && params.get("expired") && (
        <Banner tone="wait" title="You've been signed out.">
          Sign in again to continue.
        </Banner>
      )}

      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <TextField
        label="Email or username"
        name="identifier"
        autoComplete="username"
        defaultValue={state.values?.identifier}
        required
        autoFocus
      />
      <PasswordField label="Password" name="password" autoComplete="current-password" required />

      <div className="kq-row" style={{ justifyContent: "space-between" }}>
        <Checkbox label="Keep me signed in" name="keep" />
        <Link href="/forgot-password" style={{ fontWeight: 600, fontSize: 14 }}>
          Forgot password?
        </Link>
      </div>

      {state.error && <Banner tone="bad" title={state.error} />}

      <Button type="submit" variant="primary" size="lg" pending={pending} style={{ width: "100%" }}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p style={{ fontSize: 14, textAlign: "center" }}>
        New here?{" "}
        <Link href="/sign-up" style={{ fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

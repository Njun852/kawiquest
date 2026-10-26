"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner, Button, Icon, PasswordField, TextField } from "@/components/ui";
import type { FormState } from "@/lib/auth/schemas";
import { signUp } from "../actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  const err = state.fieldErrors ?? {};
  const role = state.values?.role || "player";

  return (
    <form action={action} className="kq-panel kq-stack" style={{ gap: 16 }} noValidate>
      <h2 className="kq-ribbon" style={{ margin: 0 }}>
        Create account
      </h2>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }} aria-describedby={err.role ? "role-error" : undefined}>
        <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>I want to…</legend>
        <div className="kq-grid kq-g2" style={{ gap: 12 }}>
          <label className="kq-radiocard">
            <input type="radio" name="role" value="player" defaultChecked={role === "player"} />
            <span>
              <b>
                <Icon name="grid" />
                Player
              </b>
              <small>Play in the KawiQuest app; see your progress and achievements here.</small>
            </span>
          </label>
          <label className="kq-radiocard">
            <input type="radio" name="role" value="contributor" defaultChecked={role === "contributor"} />
            <span>
              <b>
                <Icon name="pen" />
                Contributor
              </b>
              <small>Write Kawi characters here for the research dataset.</small>
            </span>
          </label>
        </div>
        {err.role && (
          <small id="role-error" className="kq-field__error" style={{ marginTop: 4 }}>
            <Icon name="alert" />
            {err.role}
          </small>
        )}
      </fieldset>

      <div className="kq-grid kq-g2">
        <TextField label="First name" name="first_name" autoComplete="given-name" defaultValue={state.values?.first_name} error={err.first_name} />
        <TextField label="Last name" name="last_name" autoComplete="family-name" defaultValue={state.values?.last_name} error={err.last_name} />
      </div>
      <TextField
        label="Birthday"
        name="birthday"
        type="date"
        autoComplete="bday"
        defaultValue={state.values?.birthday}
        error={err.birthday}
        hint="Never shown to validators or released with the dataset."
      />
      <div className="kq-grid kq-g2">
        <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} error={err.email} />
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          defaultValue={state.values?.username}
          error={err.username}
          hint="Shown instead of your name."
        />
      </div>
      <div className="kq-grid kq-g2">
        <PasswordField label="Password" name="password" autoComplete="new-password" error={err.password} hint="At least 8 characters." />
        <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" error={err.confirm} />
      </div>

      <div className="kq-stack" style={{ gap: 4 }}>
        <label className="kq-row" style={{ alignItems: "flex-start", flexWrap: "nowrap", fontSize: 14, lineHeight: "20px", gap: 8 }}>
          <input type="checkbox" name="agree" style={{ width: 18, height: 18, marginTop: 2, flex: "none" }} aria-invalid={err.agree ? true : undefined} />
          <span>
            I agree to the terms and study information, including use of my handwriting in an openly released research
            dataset. Only an anonymous account ID is kept with it — never my name, username, email or birthday.
          </span>
        </label>
        {err.agree && (
          <small className="kq-field__error">
            <Icon name="alert" />
            {err.agree}
          </small>
        )}
      </div>

      {state.error && <Banner tone="bad" title={state.error} />}

      <Button type="submit" variant="primary" size="lg" pending={pending}>
        {pending ? "Creating your account…" : "Sign up"}
      </Button>
      <p className="kq-muted" style={{ margin: 0, fontSize: 13, textAlign: "center" }}>
        Already have an account?{" "}
        <Link href="/sign-in" style={{ fontWeight: 600 }}>
          Sign in
        </Link>{" "}
        · Validator and admin accounts are created by an admin.
      </p>
    </form>
  );
}

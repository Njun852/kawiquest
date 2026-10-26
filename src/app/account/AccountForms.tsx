"use client";

import { useActionState } from "react";
import { Banner, Button, Card, CardBody, CardHead, PasswordField, TextField } from "@/components/ui";
import type { FormState } from "@/lib/auth/schemas";
import { changePassword, updateProfile } from "./actions";

export type ProfileValues = { first_name: string; last_name: string; birthday: string; username: string; email: string };

export function ProfileForm({ accountId, initial }: { accountId: number; initial: ProfileValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, { values: initial });
  const err = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <Card>
      <CardHead title="Profile">
        <span className="kq-mono kq-muted" title="Your account ID">
          #{accountId}
        </span>
      </CardHead>
      <CardBody>
        <form action={action} className="kq-stack" style={{ gap: 14 }} noValidate>
          <div className="kq-grid kq-g2">
            <TextField label="First name" name="first_name" autoComplete="given-name" defaultValue={v.first_name} error={err.first_name} />
            <TextField label="Last name" name="last_name" autoComplete="family-name" defaultValue={v.last_name} error={err.last_name} />
          </div>
          <TextField label="Birthday" name="birthday" type="date" autoComplete="bday" defaultValue={v.birthday} error={err.birthday} />
          <TextField label="Username" name="username" autoComplete="username" defaultValue={state.values?.username} error={err.username} />
          <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} error={err.email} />
          <PasswordField
            label="Current password"
            name="current"
            autoComplete="current-password"
            error={err.current}
            hint="Needed only to change your email."
          />
          {state.success && <Banner tone="ok" title={state.success} />}
          {state.error && <Banner tone="bad" title={state.error} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" icon="save" pending={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const err = state.fieldErrors ?? {};
  return (
    <Card>
      <CardHead title="Password" />
      <CardBody>
        <form action={action} className="kq-stack" style={{ gap: 14 }} noValidate>
          <PasswordField label="Current password" name="current" autoComplete="current-password" error={err.current} />
          <PasswordField label="New password" name="password" autoComplete="new-password" error={err.password} hint="At least 8 characters." />
          <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" error={err.confirm} />
          {state.success && <Banner tone="ok" title={state.success} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" pending={pending}>
              {pending ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

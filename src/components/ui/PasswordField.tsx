"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** Password input with a show/hide toggle; label, hint and error wired like TextField. */
export function PasswordField({
  label,
  hint,
  error,
  id,
  ...rest
}: { label: ReactNode; hint?: ReactNode; error?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const auto = useId();
  const fid = id ?? auto;
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${fid}-error` : hint ? `${fid}-hint` : undefined;
  return (
    <div className="kq-field">
      <label htmlFor={fid}>
        <span>{label}</span>
      </label>
      <span className="kq-pwd">
        <input
          id={fid}
          className="kq-input"
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <Button variant="ghost" size="sm" icon={shown ? "eyeOff" : "eye"} iconOnly onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? "Hide password" : "Show password"}
        </Button>
      </span>
      {hint && !error && <small id={`${fid}-hint`}>{hint}</small>}
      {error && (
        <small id={`${fid}-error`} className="kq-field__error">
          <Icon name="alert" />
          {error}
        </small>
      )}
    </div>
  );
}

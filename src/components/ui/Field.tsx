import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Shown under the field, e.g. "That username is taken". */
  error?: ReactNode;
  /** Small uppercase label style, as in filter bars. */
  compact?: boolean;
  grow?: boolean;
  className?: string;
};

function Wrap({
  id,
  label,
  hint,
  error,
  compact,
  grow,
  className,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={cx("kq-field", grow && "kq-field--grow", className)}>
      <label htmlFor={id}>
        <span className={cx(compact && "kq-label")}>{label}</span>
      </label>
      {children}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="kq-field__error">
          <Icon name="alert" />
          {error}
        </small>
      )}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  hint,
  error,
  compact,
  grow,
  className,
  mono,
  id,
  ...rest
}: FieldProps & { mono?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrap id={fid} {...{ label, hint, error, compact, grow, className }}>
      <input
        id={fid}
        className="kq-input"
        style={mono ? { fontFamily: "var(--font-mono)" } : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...rest}
      />
    </Wrap>
  );
}

export function SelectField({
  label,
  hint,
  error,
  compact,
  grow,
  className,
  options,
  id,
  ...rest
}: FieldProps & {
  options: Array<{ value: string; label: string }>;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrap id={fid} {...{ label, hint, error, compact, grow, className }}>
      <select
        id={fid}
        className="kq-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  compact,
  grow,
  className,
  id,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrap id={fid} {...{ label, hint, error, compact, grow, className }}>
      <textarea
        id={fid}
        className="kq-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...rest}
      />
    </Wrap>
  );
}

export function Checkbox({ label, ...rest }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="kq-check">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

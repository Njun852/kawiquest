import { z } from "zod";
import { ANY_ROLE, areaOf, LANDING, matches } from "./routes";
import type { Role } from "../constants";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/, "Use 3–32 letters, numbers, dots, dashes or underscores.");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");

export const nameSchema = (label: string) =>
  z.string().trim().min(1, `Enter your ${label}.`).max(100, `Use at most 100 characters.`);

/** accounts.birthday: a yyyy-mm-dd date input, stored as midnight UTC. */
export const birthdaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your birthday.")
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getTime() < Date.now(), "Enter a real date in the past.");

/** Shape returned by every form action: a banner, per-field errors, and the values to refill. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

export function fieldErrorsOf(error: z.ZodError): Partial<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Where to go after sign-in: the requested page if this role may open it, else the role's landing page. */
export function safeNext(next: string | null | undefined, role: Role) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return LANDING[role];
  const path = next.split("?")[0]!;
  const area = areaOf(path);
  if (area === role || (!area && matches(path, ANY_ROLE))) return next;
  return LANDING[role];
}

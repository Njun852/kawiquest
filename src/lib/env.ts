import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb").default("mongodb://localhost:27017/kawiquest"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters (see .env.example)"),
  APP_URL: z.url().default("http://localhost:3000"),
  RESEND_API_KEY: optional,
  MAIL_FROM: z.string().default("KawiQuest <no-reply@example.com>"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;

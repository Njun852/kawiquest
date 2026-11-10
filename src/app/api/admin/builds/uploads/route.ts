import { z } from "zod";
import { adminOrError, errorResponse, json } from "@/lib/builds/api";
import { startUpload } from "@/lib/builds/upload";

const startSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  version: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/, "Use a version like 0.4.2 (letters, numbers, dots, dashes; up to 20)."),
  model_version: z.string().trim().max(50).optional().transform((v) => v || null),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
  make_active: z.boolean().optional().default(false),
});

/** FR3: start an APK upload. Body: file name and size plus the build's details. */
export async function POST(req: Request) {
  const me = await adminOrError(req, true);
  if (me instanceof Response) return me;
  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return json({ error: "Check the build details.", fieldErrors }, 400);
  }
  const { filename, size, ...meta } = parsed.data;
  try {
    return json(await startUpload(me.id, { name: filename, size }, meta), 201);
  } catch (err) {
    return errorResponse(err);
  }
}

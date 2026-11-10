import { adminOrError, errorResponse, json } from "@/lib/builds/api";
import { abortUpload, CHUNK_SIZE, completeUpload, putChunk } from "@/lib/builds/upload";

type Ctx = RouteContext<"/api/admin/builds/uploads/[id]">;

/** One piece of the APK: PUT ?index=n with the raw bytes as the body. */
export async function PUT(req: Request, ctx: Ctx) {
  const me = await adminOrError(req, true);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const index = Number(new URL(req.url).searchParams.get("index"));
  const length = Number(req.headers.get("content-length") ?? NaN);
  if (length > CHUNK_SIZE) return json({ error: "Piece too large." }, 413);
  try {
    await putChunk(id, me.id, index, new Uint8Array(await req.arrayBuffer()));
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Every piece is in: register the build. */
export async function POST(req: Request, ctx: Ctx) {
  const me = await adminOrError(req, true);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  try {
    const build = await completeUpload(id, me.id);
    return json({ build_id: build.build_id, version: build.version, is_active: build.is_active }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Cancel: drop the pieces written so far. */
export async function DELETE(req: Request, ctx: Ctx) {
  const me = await adminOrError(req, true);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  await abortUpload(id, me.id);
  return json({ ok: true });
}

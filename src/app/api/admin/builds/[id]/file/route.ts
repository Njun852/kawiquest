import { adminOrError, json } from "@/lib/builds/api";
import { buildDownload } from "@/lib/builds/upload";
import { GameBuild } from "@/lib/models";

/** Admins can download any build, active or not. */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/builds/[id]/file">) {
  const me = await adminOrError(req);
  if (me instanceof Response) return me;
  const id = Number((await ctx.params).id);
  const build = Number.isInteger(id) ? await GameBuild.findOne({ build_id: id }).lean() : null;
  const res = build && (await buildDownload(build));
  return res || json({ error: "That build no longer exists." }, 404);
}

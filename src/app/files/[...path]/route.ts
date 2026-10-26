import type { NextRequest } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { HandwritingSample } from "@/lib/models";
import { getFile } from "@/lib/storage";

// Serves stored files to signed-in people. Paths are unique per upload, so responses can be cached.
// Uploaded SVGs could carry script: the sandbox CSP and nosniff keep any file inert when opened directly.
export async function GET(_req: NextRequest, ctx: RouteContext<"/files/[...path]">) {
  const me = await getCurrentAccount();
  if (!me) return new Response("Sign in to see this file.", { status: 401 });

  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p === "")) return new Response("Not found", { status: 404 });
  const key = path.join("/");

  // Handwriting samples are research data: only their writer, validators and admins may see them.
  if (path[0] === "samples" && me.role !== "admin" && me.role !== "validator") {
    await connectDb();
    const sample = await HandwritingSample.findOne({ image_path: key }, { account_id: 1 }).lean();
    if (!sample || sample.account_id !== me.id) return new Response("Not found", { status: 404 });
  }

  const file = await getFile(key);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

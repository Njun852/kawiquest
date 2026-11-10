import { connection } from "next/server";
import { buildDownload } from "@/lib/builds/upload";
import { connectDb } from "@/lib/db";
import { GameBuild } from "@/lib/models";

/** FR3: download the active Android build. Public, so testers can install before they have an account. */
export async function GET() {
  await connection();
  await connectDb();
  const build = await GameBuild.findOne({ platform: "android", is_active: true }).lean();
  const res = build && (await buildDownload(build));
  return res || new Response("No build has been published yet.", { status: 404, headers: { "Content-Type": "text/plain" } });
}

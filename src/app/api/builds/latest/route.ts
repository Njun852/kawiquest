import { connection } from "next/server";
import { json } from "@/lib/builds/api";
import { connectDb } from "@/lib/db";
import { GameBuild } from "@/lib/models";

/**
 * FR3: the active Android build, for the game's update check and the download page. Public: no sign-in needed.
 * { version, model_version, size, uploaded_at, url }
 */
export async function GET() {
  await connection();
  await connectDb();
  const build = await GameBuild.findOne({ platform: "android", is_active: true }).lean();
  if (!build) return json({ error: "No build has been published yet." }, 404);
  return json({
    platform: build.platform,
    version: build.version,
    model_version: build.model_version,
    notes: build.notes,
    size: build.file_size,
    uploaded_at: build.uploaded_at.toISOString(),
    url: "/downloads/kawiquest.apk",
  });
}

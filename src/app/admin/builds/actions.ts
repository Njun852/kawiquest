"use server";

import { deleteBuildFile } from "@/lib/builds/upload";
import { GameBuild } from "@/lib/models";
import { asAdmin, num, type ActionResult } from "@/lib/server-actions";

/** Make this the build players download (FR3 "deploy"). Only one Android build is active at a time. */
export async function makeActive(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "build_id");
    const build = id ? await GameBuild.findOne({ build_id: id }).lean() : null;
    if (!build) return { error: "That build no longer exists." };
    await GameBuild.updateMany({ platform: build.platform, build_id: { $ne: build.build_id } }, { is_active: false });
    await GameBuild.updateOne({ build_id: build.build_id }, { is_active: true });
    return { success: `Version ${build.version} is now the download for players.`, id: build.build_id, done: "saved" };
  });
}

/** Delete an old build and its APK. The active build can't be deleted: make another one active first. */
export async function deleteBuild(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = num(fd, "build_id");
    const build = id ? await GameBuild.findOne({ build_id: id }).lean() : null;
    if (!build) return { error: "That build is already gone." };
    if (build.is_active) return { error: "This is the build players download. Make another build active first." };
    await GameBuild.deleteOne({ build_id: build.build_id });
    await deleteBuildFile(build.file_path);
    return { success: `Deleted version ${build.version}.`, done: "deleted" };
  });
}

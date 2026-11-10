import "server-only";
import { connectDb } from "../db";
import { Account, GameBuild } from "../models";

export type BuildRow = {
  build_id: number;
  version: string;
  model_version: string | null;
  notes: string | null;
  size: number;
  is_active: boolean;
  uploaded: string;
  uploaded_by: string;
};

const whenFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export async function loadBuilds(): Promise<BuildRow[]> {
  await connectDb();
  const builds = await GameBuild.find({ platform: "android" }, { _id: 0 }).sort({ build_id: -1 }).lean();
  const admins = await Account.find({ account_id: { $in: [...new Set(builds.map((b) => b.uploaded_by))] } }, { _id: 0, account_id: 1, username: 1 }).lean();
  const name = new Map(admins.map((a) => [a.account_id, a.username]));
  return builds.map((b) => ({
    build_id: b.build_id,
    version: b.version,
    model_version: b.model_version,
    notes: b.notes,
    size: b.file_size,
    is_active: b.is_active,
    uploaded: whenFmt.format(b.uploaded_at),
    uploaded_by: name.get(b.uploaded_by) ?? `#${b.uploaded_by}`,
  }));
}

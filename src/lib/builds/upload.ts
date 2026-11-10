import "server-only";
import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";
import { connectDb } from "../db";
import { BuildUpload, GameBuild, nextId, type IGameBuild } from "../models";

// FR3 APK storage. A build arrives in CHUNK_SIZE pieces (each request stays under Vercel's 4.5 MB body limit);
// each piece is written straight into GridFS as chunk n of a file that is registered once every piece is in.
// The result is an ordinary GridFS file in the "files" bucket, streamed back out for downloads.

export const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB
export const MAX_APK_BYTES = 400 * 1024 * 1024;
const UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;
const APK_TYPE = "application/vnd.android.package-archive";
const BUCKET = "files";

export type BuildMeta = { version: string; model_version: string | null; notes: string | null; make_active: boolean };

export class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function collections() {
  const conn = await connectDb();
  const db = conn.connection.db!;
  return { db, chunks: db.collection(`${BUCKET}.chunks`), files: db.collection(`${BUCKET}.files`) };
}

/** Drop unfinished uploads past their expiry, with the chunks they had written. */
async function sweepExpired() {
  const { chunks } = await collections();
  const stale = await BuildUpload.find({ expires_at: { $lt: new Date() } }, { file_id: 1 }).lean();
  if (!stale.length) return;
  await chunks.deleteMany({ files_id: { $in: stale.map((u) => u.file_id) } });
  await BuildUpload.deleteMany({ _id: { $in: stale.map((u) => u._id) } });
}

export async function startUpload(accountId: number, file: { name: string; size: number }, meta: BuildMeta) {
  if (!/\.apk$/i.test(file.name)) throw new UploadError("Choose an Android build: an .apk file.");
  if (!Number.isInteger(file.size) || file.size <= 0) throw new UploadError("That file is empty.");
  if (file.size > MAX_APK_BYTES) throw new UploadError(`Builds can be up to ${MAX_APK_BYTES / 1024 / 1024} MB.`);
  await connectDb();
  await sweepExpired();
  if (await GameBuild.exists({ platform: "android", version: meta.version })) {
    throw new UploadError(`Version ${meta.version} is already uploaded. Use a new version number.`, 409);
  }
  const { chunks } = await collections();
  await chunks.createIndex({ files_id: 1, n: 1 }, { unique: true }); // GridFS's own index, in case no file was written yet
  const upload = await BuildUpload.create({
    file_id: new Types.ObjectId(),
    account_id: accountId,
    filename: file.name.slice(0, 255),
    size: file.size,
    chunk_size: CHUNK_SIZE,
    chunks: Math.ceil(file.size / CHUNK_SIZE),
    expires_at: new Date(Date.now() + UPLOAD_TTL_MS),
    meta,
  });
  return { uploadId: upload._id.toHexString(), chunkSize: CHUNK_SIZE, chunks: upload.chunks };
}

async function findUpload(uploadId: string, accountId: number) {
  if (!Types.ObjectId.isValid(uploadId)) throw new UploadError("Unknown upload.", 404);
  await connectDb();
  const upload = await BuildUpload.findOne({ _id: uploadId, account_id: accountId }).lean();
  if (!upload || upload.expires_at.getTime() < Date.now()) throw new UploadError("This upload expired. Start it again.", 404);
  return upload;
}

/** Write piece `index`. Re-sending a piece replaces it, so the browser can retry safely. */
export async function putChunk(uploadId: string, accountId: number, index: number, data: Uint8Array) {
  const upload = await findUpload(uploadId, accountId);
  if (!Number.isInteger(index) || index < 0 || index >= upload.chunks) throw new UploadError("Piece number out of range.");
  const expected = index < upload.chunks - 1 ? upload.chunk_size : upload.size - upload.chunk_size * (upload.chunks - 1);
  if (data.byteLength !== expected) throw new UploadError(`Piece ${index} should be ${expected} bytes, got ${data.byteLength}.`);
  // APKs are ZIP archives: refuse anything else at the first piece rather than after the whole upload.
  if (index === 0 && !(data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04)) {
    throw new UploadError("That file isn't an Android build (an APK is a ZIP archive). Choose the .apk from the Unity build.");
  }
  const { chunks } = await collections();
  await chunks.updateOne(
    { files_id: upload.file_id, n: index },
    { $set: { files_id: upload.file_id, n: index, data: new mongoose.mongo.Binary(Buffer.from(data)) } },
    { upsert: true },
  );
}

/** Register the GridFS file and the game_builds row once every piece is in. */
export async function completeUpload(uploadId: string, accountId: number): Promise<IGameBuild> {
  const upload = await findUpload(uploadId, accountId);
  const { meta } = upload;
  const { files, chunks } = await collections();
  const have = await chunks.countDocuments({ files_id: upload.file_id });
  if (have !== upload.chunks) throw new UploadError(`Only ${have} of ${upload.chunks} pieces arrived. Try again.`);
  if (await GameBuild.exists({ platform: "android", version: meta.version })) {
    throw new UploadError(`Version ${meta.version} was uploaded meanwhile. Use a new version number.`, 409);
  }

  const build_id = await nextId("game_builds");
  const file_path = `builds/${build_id}-kawiquest-${meta.version.replace(/[^0-9A-Za-z._-]/g, "_")}.apk`;
  await files.insertOne({
    _id: upload.file_id,
    length: upload.size,
    chunkSize: upload.chunk_size,
    uploadDate: new Date(),
    filename: file_path,
    metadata: { contentType: APK_TYPE, originalName: upload.filename },
  });
  // The first build is active automatically; later ones when the admin asks.
  const first = !(await GameBuild.exists({ platform: "android" }));
  const activate = first || meta.make_active;
  if (activate) await GameBuild.updateMany({ platform: "android" }, { is_active: false });
  const build = await GameBuild.create({
    build_id,
    platform: "android",
    version: meta.version,
    model_version: meta.model_version,
    notes: meta.notes,
    file_path,
    file_size: upload.size,
    is_active: activate,
    uploaded_at: new Date(),
    uploaded_by: accountId,
  });
  await BuildUpload.deleteOne({ _id: upload._id });
  return build.toObject();
}

export async function abortUpload(uploadId: string, accountId: number) {
  const upload = await findUpload(uploadId, accountId).catch(() => null);
  if (!upload) return;
  const { chunks } = await collections();
  await chunks.deleteMany({ files_id: upload.file_id });
  await BuildUpload.deleteOne({ _id: upload._id });
}

/** A stored build as a streamed download (never buffered whole in memory). */
export async function buildDownload(build: Pick<IGameBuild, "file_path" | "file_size" | "version">) {
  const conn = await connectDb();
  const bucket = new mongoose.mongo.GridFSBucket(conn.connection.db!, { bucketName: BUCKET });
  const [file] = await bucket.find({ filename: build.file_path }).limit(1).toArray();
  if (!file) return null;
  const body = Readable.toWeb(bucket.openDownloadStream(file._id)) as ReadableStream<Uint8Array>;
  return new Response(body, {
    headers: {
      "Content-Type": APK_TYPE,
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename="kawiquest-${build.version.replace(/[^0-9A-Za-z._-]/g, "_")}.apk"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Remove a build's file from GridFS (its chunks and its files entry). */
export async function deleteBuildFile(filePath: string) {
  const conn = await connectDb();
  const bucket = new mongoose.mongo.GridFSBucket(conn.connection.db!, { bucketName: BUCKET });
  for (const f of await bucket.find({ filename: filePath }).toArray()) await bucket.delete(f._id);
}

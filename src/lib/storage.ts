import "server-only";
import mongoose from "mongoose";
import { connectDb } from "./db";

// Files (reference glyphs now, handwriting sample images later) live in MongoDB GridFS, bucket "files".
// A file's path ("glyphs/88-k3j9.png") is its GridFS filename and is what ERD columns such as
// kawi_characters.reference_glyph store. Browsers fetch it from /files/<path>.

async function bucket() {
  const conn = await connectDb();
  return new mongoose.mongo.GridFSBucket(conn.connection.db!, { bucketName: "files" });
}

export async function putFile(path: string, data: Uint8Array, contentType: string) {
  const b = await bucket();
  await new Promise<void>((resolve, reject) => {
    const stream = b.openUploadStream(path, { metadata: { contentType } });
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    stream.end(Buffer.from(data));
  });
}

export async function getFile(path: string) {
  const b = await bucket();
  const [file] = await b.find({ filename: path }).sort({ uploadDate: -1 }).limit(1).toArray();
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of b.openDownloadStream(file._id)) chunks.push(chunk as Buffer);
  return {
    data: Buffer.concat(chunks),
    contentType: (file.metadata?.contentType as string | undefined) ?? "application/octet-stream",
  };
}

export async function deleteFile(path: string) {
  const b = await bucket();
  for (const f of await b.find({ filename: path }).toArray()) await b.delete(f._id);
}

/** Public URL of a stored file. */
export const fileUrl = (path: string) => `/files/${path}`;

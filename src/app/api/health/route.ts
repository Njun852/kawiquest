import { connection } from "next/server";
import { connectDb } from "@/lib/db";
import { KawiCharacter } from "@/lib/models";

// Liveness for the web app and its database. Request-time only: never prerendered.
export async function GET() {
  await connection();
  try {
    const mongoose = await connectDb();
    await mongoose.connection.db!.admin().ping();
    const characters = await KawiCharacter.estimatedDocumentCount();
    return Response.json({ ok: true, db: "up", curriculum: { characters } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}

import { connection } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { GameLevel, HandwritingSample, KawiCharacter, Quest } from "@/lib/models";
import type { CountKey } from "./nav";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** A live row count beside a nav item. Rendered inside its own <Suspense> so the sidebar never waits on it. */
export async function NavCount({ count }: { count: CountKey }) {
  await connection();
  await connectDb();
  let n: number;
  switch (count) {
    case "characters":
      n = await KawiCharacter.estimatedDocumentCount();
      break;
    case "levels":
      n = await GameLevel.estimatedDocumentCount();
      break;
    case "quests":
      n = await Quest.estimatedDocumentCount();
      break;
    case "mySubmissions": {
      const me = await getCurrentAccount();
      if (!me) return null;
      n = await HandwritingSample.countDocuments({ account_id: me.id });
      break;
    }
  }
  return <span className="kq-count">{compact.format(n)}</span>;
}

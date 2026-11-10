import { connection } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { HandwritingSample } from "@/lib/models";
import { pendingCount } from "@/lib/validation/queries";
import type { CountKey } from "./nav";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** A live row count beside a nav item. Rendered inside its own <Suspense> so the sidebar never waits on it. */
export async function NavCount({ count }: { count: CountKey }) {
  await connection();
  await connectDb();
  let n: number;
  switch (count) {
    case "pending":
      n = await pendingCount();
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

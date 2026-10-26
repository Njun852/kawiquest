import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { loadAnalytics } from "@/lib/analytics/queries";
import { requireAccount } from "@/lib/auth/session";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = { title: "Platform analytics" };

export default function AdminHome() {
  return (
    <Suspense fallback={<PageHead eyebrow="Analytics" title="Platform analytics" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireAccount(["admin"]);
  return <AdminDashboard data={await loadAnalytics()} />;
}

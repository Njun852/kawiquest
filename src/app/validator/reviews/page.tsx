import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHead, CopperTile, DataTable, PageHead, StatusBadge } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadMyReviews, type MyReview } from "@/lib/validation/queries";

export const metadata: Metadata = { title: "My reviews" };

export default function MyReviewsPage() {
  return (
    <>
      <PageHead eyebrow="Review" title="My reviews" />
      <Suspense fallback={<div aria-busy />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const me = await requireAccount(["validator"]);
  const { rows, total } = await loadMyReviews(me);
  return (
    <Card style={{ overflow: "hidden" }}>
      <CardHead title={`${total} decision${total === 1 ? "" : "s"}`}>
        <span className="kq-muted" style={{ fontSize: 13 }}>
          Newest first{total > rows.length ? ` · latest ${rows.length}` : ""}
        </span>
      </CardHead>
      <DataTable<MyReview>
        caption="My reviews"
        rows={rows}
        rowKey={(r) => String(r.validation_id)}
        empty="No decisions yet. They appear here as you review reference forms."
        columns={[
          {
            key: "form",
            header: "Form",
            render: (r) => (r.form ? <CopperTile form={r.form} size="md" /> : <span className="kq-muted">—</span>),
          },
          {
            key: "what",
            header: "Character",
            render: (r) => (
              <>
                <strong>{r.label}</strong>
                <div className="kq-mono kq-muted" style={{ fontSize: 11 }}>
                  #{r.character_id}
                </div>
              </>
            ),
          },
          {
            key: "decision",
            header: "Decision",
            render: (r) => (
              <span className="kq-stack" style={{ gap: 2, alignItems: "flex-start" }}>
                <StatusBadge status={r.status} />
                {r.superseded && <small className="kq-muted">Reviewed again since</small>}
              </span>
            ),
          },
          { key: "remarks", header: "Remarks", render: (r) => r.remarks ?? <span className="kq-muted">—</span> },
          { key: "at", header: "When", render: (r) => r.at },
        ]}
      />
    </Card>
  );
}

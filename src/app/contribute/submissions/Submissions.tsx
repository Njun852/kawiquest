"use client";

import { useActionState, useState } from "react";
import { Banner, Button, Card, CardBody, CardHead, Segmented } from "@/components/ui";
import type { ActionResult } from "@/lib/server-actions";
import { deleteOwnSample } from "../actions";

export type SubmissionRow = { sample_id: number; image_path: string; label: string; category: string; is_non_character: boolean };

export function Submissions({ rows, total, shown }: { rows: SubmissionRow[]; total: number; shown: number }) {
  const [filter, setFilter] = useState("all");
  const [result, setResult] = useState<ActionResult>({});
  const visible = rows.filter((r) => filter === "all" || (filter === "non" ? r.is_non_character : !r.is_non_character));

  return (
    <Card>
      <CardHead title={`${total} sample${total === 1 ? "" : "s"}`}>
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "All" },
            { value: "char", label: "Characters" },
            { value: "non", label: "Non-characters" },
          ]}
        />
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 12 }}>
        {total > shown && (
          <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
            Showing your latest {shown}.
          </p>
        )}
        {result.error && <Banner tone="bad" title={result.error} />}
        {result.success && <Banner tone="ok" title={result.success} />}
        {visible.length === 0 ? (
          <p className="kq-muted" style={{ margin: 0 }}>
            {total ? "Nothing in this view." : "No samples yet. Write your first one on the Writing canvas."}
          </p>
        ) : (
          <div className="kq-samples">
            {visible.map((r) => (
              <SampleCard key={r.sample_id} row={r} onResult={setResult} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SampleCard({ row, onResult }: { row: SubmissionRow; onResult: (r: ActionResult) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [, remove, removing] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await deleteOwnSample(prev, fd);
    onResult(r);
    return r;
  }, {});
  return (
    <div className="kq-sample">
      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth */}
      <img src={`/files/${row.image_path}`} alt={`Sample #${row.sample_id}: ${row.label}`} />
      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</strong>
      <span className="kq-muted">
        #{row.sample_id} · {row.category}
      </span>
      {confirming ? (
        <form action={remove} className="kq-row" style={{ gap: 4 }}>
          <input type="hidden" name="sample_id" value={row.sample_id} />
          <Button type="submit" variant="danger" size="sm" pending={removing}>
            Remove
          </Button>
          <Button size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" icon="trash" onClick={() => setConfirming(true)} style={{ alignSelf: "flex-start" }}>
          Remove…
        </Button>
      )}
    </div>
  );
}

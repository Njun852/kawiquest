"use client";

import { useActionState } from "react";
import { Banner, Button, Card, CardBody, CardHead } from "@/components/ui";
import type { ActionResult } from "@/lib/server-actions";
import { importCharacters } from "./actions";

const EXAMPLE = `unicode_codepoint,name,transliteration,category,base_letter
U+11F12,KA,ka,Consonants,
U+11F36,VOWEL SIGN I,ki,Marked forms,KA
11F12 11F42 11F31,KSA,ksa,Ligatures,`;

export function ImportPanel({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(importCharacters, {});
  return (
    <Card>
      <CardHead title="Import characters from CSV">
        <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose}>
          Close
        </Button>
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 12 }}>
        <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
          Rows that match an existing code point update that character; the rest are added. Nothing is saved unless every
          row is valid. <code>category</code> takes the category name or its id; <code>base_letter</code> is only for
          marked forms.
        </p>
        <pre className="kq-mono" style={{ margin: 0, padding: 12, background: "var(--surface-2)", borderRadius: "var(--radius-md)", overflowX: "auto" }}>
          {EXAMPLE}
        </pre>
        <form action={action} className="kq-row" style={{ gap: 10 }}>
          <input type="file" name="csv" accept=".csv,text/csv" aria-label="CSV file" required />
          <Button type="submit" variant="primary" icon="upload" pending={pending}>
            {pending ? "Importing…" : "Import"}
          </Button>
        </form>
        {state.error && <Banner tone="bad" title={state.error} />}
        {state.success && <Banner tone="ok" title={state.success} />}
      </CardBody>
    </Card>
  );
}

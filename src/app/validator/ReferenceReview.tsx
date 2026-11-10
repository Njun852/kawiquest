"use client";

import { usePathname } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Banner, Button, CopperTile, Icon, PageHead, Segmented, StatusBadge, Tabs, TextAreaField } from "@/components/ui";
import type { ValidationStatus } from "@/lib/models";
import type { ActionResult } from "@/lib/server-actions";
import type { ReviewData, ReviewItem } from "@/lib/validation/queries";
import { decide } from "./actions";

type Params = { status: string; category: string };
const nf = new Intl.NumberFormat("en");

/** FR4: the Expert Validator approves each reference form, or marks it corrected with remarks. */
export function ReferenceReview({ data, params }: { data: ReviewData; params: Params }) {
  const pathname = usePathname();
  const [selectedId, setSelectedId] = useState<number | null>(data.items[0]?.character_id ?? null);
  const [remarks, setRemarks] = useState("");
  const [result, setResult] = useState<ActionResult>({});
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const index = Math.max(0, data.items.findIndex((i) => i.character_id === selectedId));
  const current: ReviewItem | undefined = data.items.find((i) => i.character_id === selectedId) ?? data.items[0];

  const [, submit, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await decide(prev, fd);
    setResult(r);
    return r;
  }, {});

  const clearInputs = () => {
    setRemarks("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const decideNow = (status: ValidationStatus) => {
    if (!current || pending) return;
    if (status === "corrected" && !remarks.trim()) {
      setResult({ fieldErrors: { remarks: "Describe the correction in the remarks." } });
      remarksRef.current?.focus();
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (file && status !== "corrected") {
      setResult({ error: "Attach a corrected image only when marking the form corrected." });
      return;
    }
    const fd = new FormData();
    fd.set("character_id", String(current.character_id));
    fd.set("status", status);
    fd.set("remarks", remarks);
    if (file) fd.set("glyph", file);
    // In the pending view the decided form leaves the list; elsewhere it stays, so move on either way.
    const next = data.items[index + 1] ?? data.items[index - 1];
    setSelectedId(next?.character_id ?? null);
    clearInputs();
    startTransition(() => submit(fd));
  };

  const skip = () => {
    const next = data.items[index + 1] ?? data.items[0];
    setSelectedId(next?.character_id ?? null);
    clearInputs();
    setResult({});
  };

  // Keyboard: A approve, C corrected, S skip — not while typing a remark.
  const keys = useRef({ decideNow, skip });
  useEffect(() => {
    keys.current = { decideNow, skip };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (e.ctrlKey || e.metaKey || e.altKey || (t instanceof Element && t.closest("textarea, input, select"))) return;
      const k = e.key.toLowerCase();
      if (k === "a") keys.current.decideNow("approved");
      else if (k === "c") keys.current.decideNow("corrected");
      else if (k === "s") keys.current.skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusWord = { pending: "pending", approved: "approved", corrected: "corrected", all: "" }[data.filter];
  const validated = data.counts.approved + data.counts.corrected;

  return (
    <>
      <PageHead
        eyebrow="Expert validation"
        title="Reference forms"
        actions={
          <div className="kq-row" style={{ gap: 16, fontSize: 13 }}>
            <span>
              <b className="kq-mono">
                {nf.format(validated)} / {nf.format(data.total)}
              </b>{" "}
              <span className="kq-muted">validated</span>
            </span>
            <span>
              <b className="kq-mono">{nf.format(data.reviewedToday)}</b> <span className="kq-muted">reviewed today</span>
            </span>
          </div>
        }
      />

      <div className="kq-rf__bar">
        <Tabs
          label="Category"
          value={params.category || "all"}
          items={[
            { value: "all", label: "All", count: Object.values(data.byCategory).reduce((a, b) => a + b, 0), href: href(pathname, params, { category: "" }) },
            ...data.categories.map((c) => ({
              value: String(c.category_id),
              label: c.category_name,
              count: data.byCategory[c.category_id] ?? 0,
              href: href(pathname, params, { category: String(c.category_id) }),
            })),
          ]}
        />
        <Segmented
          label="Status"
          value={params.status}
          items={[
            { value: "pending", label: `Pending ${data.counts.pending}`, href: href(pathname, params, { status: "pending" }) },
            { value: "approved", label: `Approved ${data.counts.approved}`, href: href(pathname, params, { status: "approved" }) },
            { value: "corrected", label: `Corrected ${data.counts.corrected}`, href: href(pathname, params, { status: "corrected" }) },
            { value: "all", label: "All", href: href(pathname, params, { status: "all" }) },
          ]}
        />
      </div>

      <div className="kq-vq kq-rf">
        <section className="kq-card" style={{ overflow: "hidden" }}>
          <div className="kq-card__head">
            <h2 className="kq-h-card">Characters</h2>
            <span className="kq-mono kq-muted" style={{ fontSize: 12 }}>
              inventory order · {nf.format(data.items.length)}
            </span>
          </div>
          {data.items.length === 0 ? (
            <p className="kq-muted" style={{ padding: "16px 20px", margin: 0 }}>
              No {statusWord} forms here.{data.filter === "pending" ? " Every reference form in this view has been validated." : ""}
            </p>
          ) : (
            <ul className="kq-vq__list" aria-label="Reference forms">
              {data.items.map((item) => (
                <li key={item.character_id}>
                  <button
                    type="button"
                    aria-current={item.character_id === current?.character_id ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(item.character_id);
                      clearInputs();
                      setResult({});
                    }}
                  >
                    <CopperTile form={item.form} size="md" />
                    <span className="kq-vq__who">
                      <b>{item.transliteration}</b>
                      <small>
                        {item.name} · {item.unicode_codepoint}
                      </small>
                    </span>
                    <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="kq-panel" style={{ padding: 0 }}>
          {!current ? (
            <div style={{ padding: 24 }}>
              <h2 className="kq-ribbon">Check the reference form</h2>
              {result.success && <Banner tone="ok" title={result.success} />}
              <p className="kq-muted">No character selected.</p>
            </div>
          ) : (
            <Review
              key={current.character_id}
              item={current}
              position={`${index + 1} of ${nf.format(data.items.length)}`}
              remarks={remarks}
              onRemarks={setRemarks}
              remarksRef={remarksRef}
              fileRef={fileRef}
              result={result}
              pending={pending}
              onDecide={decideNow}
              onSkip={skip}
            />
          )}
        </section>
      </div>
    </>
  );
}

function href(pathname: string, params: Params, next: Partial<Params>) {
  const p = new URLSearchParams({ ...params, ...next });
  for (const [k, v] of [...p.entries()]) if (!v || (k === "status" && v === "pending")) p.delete(k);
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function Kbd({ children }: { children: string }) {
  return <kbd className="kq-kbd">{children}</kbd>;
}

function Review({
  item,
  position,
  remarks,
  onRemarks,
  remarksRef,
  fileRef,
  result,
  pending,
  onDecide,
  onSkip,
}: {
  item: ReviewItem;
  position: string;
  remarks: string;
  onRemarks: (v: string) => void;
  remarksRef: React.RefObject<HTMLTextAreaElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  result: ActionResult;
  pending: boolean;
  onDecide: (s: ValidationStatus) => void;
  onSkip: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <>
      <div className="kq-rf__head">
        <div className="kq-rf__title">
          <h2 className="kq-h-card">
            {item.name} <span className="kq-rf__tr">{item.transliteration}</span>
          </h2>
          <span className="kq-rf__meta">
            #{item.character_id}, {item.unicode_codepoint}, {item.category} ({position})
          </span>
        </div>
        <StatusBadge status={item.status} />
        <Button size="sm" onClick={onSkip}>
          Skip <Kbd>S</Kbd>
        </Button>
      </div>

      <div className="kq-rf__body">
        <figure className="kq-rf__form">
          {item.reference_glyph ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth
            <img src={`/files/${item.reference_glyph}`} alt={`Reference form of ${item.transliteration}`} />
          ) : (
            <CopperTile form={item.form} size="lg" large label={`Reference form of ${item.transliteration}`} />
          )}
          <figcaption>
            {item.reference_glyph ? "Corrected image" : "Noto Sans Kawi"}
            {item.base_letter && <>, on {item.base_letter}</>}
          </figcaption>
        </figure>
        <div className="kq-rf__history">
          <span className="kq-label">Decisions</span>
          {item.history.length === 0 ? (
            <p className="kq-muted">None yet. Is this the correct form of {item.name}?</p>
          ) : (
            <ul>
              {item.history.map((d) => (
                <li key={d.validation_id}>
                  <StatusBadge status={d.status} />
                  <span>
                    <span className="kq-muted">
                      #{d.by}, {d.at}
                    </span>
                    {d.remarks && <span className="kq-rf__remark">{d.remarks}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="kq-rf__foot">
        <TextAreaField
          ref={remarksRef}
          label="Remarks (required for Corrected)"
          name="remarks"
          rows={2}
          value={remarks}
          onChange={(e) => onRemarks(e.target.value)}
          maxLength={255}
          placeholder="E.g. the descender should curve left"
          error={result.fieldErrors?.remarks}
        />
        <div className="kq-rf__actions">
          <label className="kq-rf__file">
            <Icon name="upload" />
            {fileName ?? "Attach corrected image"}
            <input
              ref={fileRef}
              type="file"
              name="glyph"
              className="kq-sr-only"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          {fileName && (
            <button
              type="button"
              className="kq-rf__clear"
              onClick={() => {
                if (fileRef.current) fileRef.current.value = "";
                setFileName(null);
              }}
            >
              Remove
            </button>
          )}
          <span className="kq-rf__spacer" />
          <Button variant="primary" icon="check" onClick={() => onDecide("approved")} pending={pending}>
            Approve <Kbd>A</Kbd>
          </Button>
          <Button icon="pen" onClick={() => onDecide("corrected")} pending={pending}>
            Corrected <Kbd>C</Kbd>
          </Button>
        </div>
        {result.fieldErrors?.glyph && <small className="kq-field__error">{result.fieldErrors.glyph}</small>}
        {result.error && <Banner tone="bad" title={result.error} />}
        {result.success && !result.fieldErrors && <Banner tone="ok" title={result.success} />}
      </div>
    </>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Banner, Button, CopperTile, FilterBar, Icon, PageHead, Segmented, SelectField, StatusBadge, Tabs, TextAreaField } from "@/components/ui";
import type { ValidationStatus } from "@/lib/models";
import type { ActionResult } from "@/lib/server-actions";
import type { QueueData, QueueItem } from "@/lib/validation/queries";
import { decide } from "./actions";

type Params = { status: string; character: string; category: string };
const nf = new Intl.NumberFormat("en");

export function ValidationQueue({ data, params }: { data: QueueData; params: Params }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedId, setSelectedId] = useState<number | null>(data.items[0]?.sample_id ?? null);
  const [remarks, setRemarks] = useState("");
  const [result, setResult] = useState<ActionResult>({});
  const remarksRef = useRef<HTMLTextAreaElement>(null);

  const index = Math.max(0, data.items.findIndex((i) => i.sample_id === selectedId));
  const current: QueueItem | undefined = data.items.find((i) => i.sample_id === selectedId) ?? data.items[0];

  const go = (next: Partial<Params>) => {
    const p = new URLSearchParams({ ...params, ...next });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "status" && v === "pending")) p.delete(k);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  const [, submit, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await decide(prev, fd);
    setResult(r);
    return r;
  }, {});

  const decideNow = (status: ValidationStatus) => {
    if (!current || pending) return;
    if (status !== "approved" && !remarks.trim()) {
      setResult({ fieldErrors: { remarks: "Add a remark to reject or flag this sample." } });
      remarksRef.current?.focus();
      return;
    }
    // Move on to the next sample now; the decided one leaves the list when the page refreshes.
    const next = data.items[index + 1] ?? data.items[index - 1];
    const fd = new FormData();
    fd.set("sample_id", String(current.sample_id));
    fd.set("status", status);
    fd.set("remarks", remarks);
    setSelectedId(next?.sample_id ?? null);
    setRemarks(""); // the remark belongs to the sample just decided, not the next one
    startTransition(() => submit(fd));
  };

  const skip = () => {
    const next = data.items[index + 1] ?? data.items[0];
    setSelectedId(next?.sample_id ?? null);
    setRemarks("");
    setResult({});
  };

  // Keyboard: A approve, R reject, F flag, S skip — not while typing a remark.
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
      else if (k === "r") keys.current.decideNow("rejected");
      else if (k === "f") keys.current.decideNow("flagged");
      else if (k === "s") keys.current.skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusWord = { pending: "pending", flagged: "flagged", mine: "reviewed by you" }[data.filter];
  const visibleCharacters = data.characters.filter((c) => !params.category || c.category_id === Number(params.category));

  return (
    <>
      <PageHead
        eyebrow="Dataset quality"
        title="Validation queue"
        actions={
          <div className="kq-row" style={{ gap: 16, fontSize: 13 }}>
            <span>
              <b className="kq-mono">{nf.format(data.reviewedToday)}</b> <span className="kq-muted">reviewed today</span>
            </span>
            <span>
              <b className="kq-mono">{nf.format(data.pendingTotal)}</b> <span className="kq-muted">pending</span>
            </span>
          </div>
        }
      />

      <Tabs
        label="Category"
        value={params.character === "non" ? "non" : params.category || "all"}
        items={[
          { value: "all", label: "All", count: Object.values(data.byCategory).reduce((a, b) => a + b, 0) + data.nonCharacters, href: href(pathname, params, { category: "", character: "" }) },
          ...data.categories.map((c) => ({
            value: String(c.category_id),
            label: c.category_name,
            count: data.byCategory[c.category_id] ?? 0,
            href: href(pathname, params, { category: String(c.category_id), character: "" }),
          })),
          { value: "non", label: "Non-characters", count: data.nonCharacters, href: href(pathname, params, { category: "", character: "non" }) },
        ]}
      />

      <FilterBar>
        <SelectField
          compact
          grow
          label="Character"
          value={params.character === "non" ? "" : params.character}
          onChange={(e) => go({ character: e.target.value })}
          disabled={params.character === "non"}
          options={[{ value: "", label: params.category ? "All in this category" : "All characters" }, ...visibleCharacters.map((c) => ({ value: String(c.character_id), label: c.label }))]}
        />
        <div className="kq-field">
          <span className="kq-label">Status</span>
          <Segmented
            label="Status"
            value={params.status}
            items={[
              { value: "pending", label: "Pending", href: href(pathname, params, { status: "pending" }) },
              { value: "flagged", label: "Flagged", href: href(pathname, params, { status: "flagged" }) },
              { value: "mine", label: "Mine", href: href(pathname, params, { status: "mine" }) },
            ]}
          />
        </div>
      </FilterBar>

      <div className="kq-vq">
        <section className="kq-card" style={{ overflow: "hidden" }}>
          <div className="kq-card__head">
            <h2 className="kq-h-card">Queue</h2>
            <span className="kq-mono kq-muted" style={{ fontSize: 12 }}>
              {data.filter === "mine" ? "newest first" : "oldest first"} · {nf.format(data.matching)}
            </span>
          </div>
          {data.items.length === 0 ? (
            <p className="kq-muted" style={{ padding: "16px 20px", margin: 0 }}>
              Nothing {statusWord} here. {data.filter === "pending" ? "Every sample in this view has been reviewed." : ""}
            </p>
          ) : (
            <ul className="kq-vq__list" aria-label="Samples">
              {data.items.map((item) => (
                <li key={item.sample_id}>
                  <button
                    type="button"
                    aria-current={item.sample_id === current?.sample_id ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(item.sample_id);
                      setRemarks("");
                      setResult({});
                    }}
                  >
                    {item.character ? (
                      <CopperTile form={item.character.form} size="md" />
                    ) : (
                      <span className="kq-tile kq-tile--md kq-tile--locked">~</span>
                    )}
                    <span className="kq-vq__who">
                      <b>{item.character?.transliteration ?? "non-character"}</b>
                      <small>
                        Account #{item.account_id} · sample #{item.sample_id}
                      </small>
                    </span>
                    {item.latest && <StatusBadge status={item.latest.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.matching > data.items.length && (
            <p className="kq-muted" style={{ margin: 0, padding: "10px 16px", fontSize: 12, borderTop: "1px solid var(--line)" }}>
              Showing the first {data.items.length}. Decide these to load more.
            </p>
          )}
        </section>

        <section className="kq-panel" style={{ padding: 0 }}>
          {!current ? (
            <div style={{ padding: 24 }}>
              <h2 className="kq-ribbon">Check the sample</h2>
              {result.success && <Banner tone="ok" title={result.success} />}
              <p className="kq-muted">No sample selected.</p>
            </div>
          ) : (
            <Review
              item={current}
              position={`${index + 1} of ${nf.format(data.matching)}`}
              remarks={remarks}
              onRemarks={setRemarks}
              remarksRef={remarksRef}
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
  result,
  pending,
  onDecide,
  onSkip,
}: {
  item: QueueItem;
  position: string;
  remarks: string;
  onRemarks: (v: string) => void;
  remarksRef: React.RefObject<HTMLTextAreaElement | null>;
  result: ActionResult;
  pending: boolean;
  onDecide: (s: ValidationStatus) => void;
  onSkip: () => void;
}) {
  const c = item.character;
  return (
    <>
      <div className="kq-card__head">
        <div className="kq-row" style={{ gap: 12, flexWrap: "nowrap", minWidth: 0 }}>
          <span className="kq-goldpill" style={{ minWidth: 72 }}>
            {c?.transliteration ?? "~"}
          </span>
          <div style={{ minWidth: 0 }}>
            <span className="kq-label">
              Sample #{item.sample_id} · {position}
            </span>
            <h2 className="kq-h-title">{c ? `Does this match ${c.name}?` : "Is this a clear non-character?"}</h2>
          </div>
        </div>
        <Button size="sm" onClick={onSkip}>
          Skip <Kbd>S</Kbd>
        </Button>
      </div>

      <div className="kq-card__body kq-stack" style={{ gap: 16 }}>
        <div className="kq-grid kq-g2" style={{ gap: 20 }}>
          <div className="kq-stack" style={{ gap: 8 }}>
            <span className="kq-label">Reference glyph</span>
            {c?.reference_glyph ? (
              // eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth
              <img className="kq-vq__img" src={`/files/${c.reference_glyph}`} alt={`Reference form of ${c.transliteration}`} />
            ) : c ? (
              <CopperTile form={c.form} size="xl" large label={c.transliteration} className="kq-vq__tile" />
            ) : (
              <div className="kq-vq__img kq-vq__none">Not a Kawi character: approve if it clearly isn&apos;t one.</div>
            )}
          </div>
          <div className="kq-stack" style={{ gap: 8 }}>
            <span className="kq-label">Submitted sample</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth */}
            <img className="kq-vq__img kq-vq__sample" src={`/files/${item.image_path}`} alt={`Sample #${item.sample_id}`} />
          </div>
        </div>

        <dl className="kq-facts">
          <dt>Character</dt>
          <dd>
            {c ? (
              <>
                <b>{c.name}</b> · {c.transliteration} · <span className="kq-mono">{c.unicode_codepoint}</span> · {c.category}
              </>
            ) : (
              "Non-character (reject class)"
            )}
          </dd>
          <dt>Contributor</dt>
          <dd className="kq-mono">Account #{item.account_id}</dd>
          <dt>Image</dt>
          <dd className="kq-mono" style={{ overflowWrap: "anywhere" }}>
            {item.image_path}
          </dd>
          {item.latest && (
            <>
              <dt>Last decision</dt>
              <dd>
                <StatusBadge status={item.latest.status} /> by account #{item.latest.by}
                {item.latest.remarks && <> · “{item.latest.remarks}”</>}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="kq-stack" style={{ gap: 12, borderTop: "1px solid var(--line)", padding: "20px 24px" }}>
        <TextAreaField
          ref={remarksRef}
          label="Remarks (required to reject or flag)"
          name="remarks"
          value={remarks}
          onChange={(e) => onRemarks(e.target.value)}
          maxLength={255}
          placeholder="E.g. top bar missing, looks like GA, too small"
          error={result.fieldErrors?.remarks}
        />
        {result.error && <Banner tone="bad" title={result.error} />}
        {result.success && !result.fieldErrors && <Banner tone="ok" title={result.success} />}
        <div className="kq-row" style={{ gap: 8 }}>
          <Button variant="primary" size="lg" icon="check" onClick={() => onDecide("approved")} pending={pending}>
            Approve <Kbd>A</Kbd>
          </Button>
          <Button variant="danger" size="lg" icon="x" onClick={() => onDecide("rejected")} pending={pending}>
            Reject <Kbd>R</Kbd>
          </Button>
          <Button size="lg" icon="flag" onClick={() => onDecide("flagged")} pending={pending}>
            Flag <Kbd>F</Kbd>
          </Button>
          <span className="kq-muted" style={{ fontSize: 13, marginLeft: "auto" }}>
            <Icon name="clock" /> The next sample opens automatically.
          </span>
        </div>
      </div>
    </>
  );
}

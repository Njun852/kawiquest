"use client";

import { startTransition, useActionState, useState } from "react";
import { rasterize, usabilityCheck, WritingCanvas, type Device, type Stroke } from "@/components/canvas/WritingCanvas";
import { Badge, Banner, Button, Card, CardBody, CardHead, CopperTile, Icon, IconButton, PageHead, ProgressBar, Segmented, StatusBadge } from "@/components/ui";
import type { ContributorState } from "@/lib/contribute/queries";
import type { ActionResult } from "@/lib/server-actions";
import { submitSample } from "./actions";

const DEVICE_WORD: Record<Device, string> = { mouse: "Mouse", stylus: "Stylus", finger: "Finger" };

export function ContributeCanvas({ state }: { state: ContributorState }) {
  const [mode, setMode] = useState<"character" | "non-character">("character");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  // The last result shows only until the contributor moves on (draws, skips or switches mode).
  const [showResult, setShowResult] = useState(false);
  const nonCharacter = mode === "non-character";

  // The next character in this pass, passing over any the contributor chose to skip for now.
  const target = state.queue.find((c) => !skipped.includes(c.character_id)) ?? state.queue[0] ?? null;

  const [result, submit, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await submitSample(prev, fd);
    if (r.done === "saved") setStrokes([]);
    return r;
  }, {});

  const onSubmit = () => {
    const problem = usabilityCheck(strokes, nonCharacter);
    setHint(problem);
    if (problem) return;
    const fd = new FormData();
    fd.set("mode", mode);
    if (!nonCharacter && target) fd.set("character_id", String(target.character_id));
    fd.set("pixels", new Blob([rasterize(strokes) as BlobPart], { type: "application/octet-stream" }));
    setShowResult(true);
    startTransition(() => submit(fd));
  };

  const finishedStudy = state.pass > state.passesTarget;

  return (
    <>
      <PageHead
        eyebrow="Dataset contribution"
        title="Writing canvas"
        actions={
          <Segmented
            label="Mode"
            value={mode}
            onChange={(v) => {
              setMode(v as typeof mode);
              setStrokes([]);
              setHint(null);
              setShowResult(false);
            }}
            items={[
              { value: "character", label: "Kawi characters" },
              { value: "non-character", label: "Non-characters" },
            ]}
          />
        }
      />

      <div className="kq-contrib">
        <section className="kq-panel">
          <h2 className="kq-ribbon">{nonCharacter ? "Draw a non-character" : "Copy the mark"}</h2>
          <div className="kq-row" style={{ justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
            <div className="kq-row" style={{ gap: 8 }}>
              {!nonCharacter && (
                <Badge tone="brand">{finishedStudy ? `Extra pass ${state.pass}` : `Pass ${state.pass} of ${state.passesTarget}`}</Badge>
              )}
              <Badge>{device ? `${DEVICE_WORD[device]} (detected)` : "Device: start drawing"}</Badge>
            </div>
            {!nonCharacter && (
              <div className="kq-stack" style={{ width: 220, gap: 4 }}>
                <div className="kq-row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <span>This pass</span>
                  <span className="kq-mono">
                    {state.done} / {state.total}
                  </span>
                </div>
                <ProgressBar percent={(state.done / Math.max(1, state.total)) * 100} label="Progress through this pass" />
              </div>
            )}
          </div>

          <div className="kq-contrib__work">
            <div className="kq-contrib__ref">
              {nonCharacter ? (
                <div className="kq-stack" style={{ gap: 8, fontSize: 14 }}>
                  <span className="kq-label">What to draw</span>
                  <p style={{ margin: 0 }}>
                    Anything that is <strong>not</strong> a Kawi character: a scribble, a letter from another script, an
                    unfinished shape. These teach the recognizer what to reject.
                  </p>
                </div>
              ) : target ? (
                <>
                  <span className="kq-label">Reference</span>
                  {target.reference_glyph ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth
                    <img className="kq-contrib__refimg" src={`/files/${target.reference_glyph}`} alt={`Reference form of ${target.transliteration}`} />
                  ) : (
                    <CopperTile form={target.form} size="xl" large label={target.transliteration} className="kq-contrib__tile" />
                  )}
                  <span className="kq-goldpill">
                    <Icon name="pen" />
                    {target.transliteration}
                  </span>
                  <div className="kq-mono kq-muted" style={{ textAlign: "center" }}>
                    {target.name} · {target.unicode_codepoint} · {target.category}
                  </div>
                  {state.queue.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSkipped((s) => [...s, target.character_id]);
                        setStrokes([]);
                        setHint(null);
                        setShowResult(false);
                      }}
                    >
                      Skip for now
                    </Button>
                  )}
                </>
              ) : (
                <p className="kq-muted">No characters in the inventory yet.</p>
              )}
            </div>

            <div className="kq-stack" style={{ gap: 12, minWidth: 0 }}>
              <div className="kq-canvas" style={{ aspectRatio: "1", width: "100%" }}>
                <WritingCanvas
                  strokes={strokes}
                  onChange={(s) => {
                    setStrokes(s);
                    setHint(null);
                    setShowResult(false);
                  }}
                  onDevice={setDevice}
                  label={nonCharacter ? "Canvas for a non-character" : `Canvas: write ${target?.transliteration ?? ""}`}
                />
                {strokes.length === 0 && <div className="kq-canvas__hint">Draw here</div>}
              </div>
              {hint && <Banner tone="wait" title={hint} />}
              {!hint && showResult && !pending && result.error && <Banner tone="bad" title={result.error} />}
              {!hint && showResult && !pending && result.success && <Banner tone="ok" title={result.success} />}
              <div className="kq-row" style={{ flexWrap: "nowrap", gap: 12, alignItems: "flex-start" }}>
                <IconButton icon="undo" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>
                  Undo
                </IconButton>
                <IconButton icon="trash" onClick={() => setStrokes([])} disabled={!strokes.length}>
                  Clear
                </IconButton>
                <Button
                  variant="primary"
                  size="lg"
                  icon="check"
                  pending={pending}
                  disabled={!nonCharacter && !target}
                  onClick={onSubmit}
                  style={{ marginLeft: "auto", minWidth: 160 }}
                >
                  {pending ? "Saving…" : "Submit"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="kq-stack" style={{ gap: 16 }}>
          <Card>
            <CardHead title="Your contribution">
              <span className="kq-mono kq-muted">{state.totals.characters + state.totals.nonCharacters}</span>
            </CardHead>
            <CardBody className="kq-stack" style={{ gap: 10, fontSize: 14 }}>
              <div className="kq-row" style={{ justifyContent: "space-between" }}>
                <span>Character samples</span>
                <span className="kq-mono">{state.totals.characters}</span>
              </div>
              <div className="kq-row" style={{ justifyContent: "space-between" }}>
                <span>Non-characters</span>
                <span className="kq-mono">{state.totals.nonCharacters}</span>
              </div>
              <div className="kq-stack" style={{ gap: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                {(["approved", "pending", "flagged", "rejected"] as const).map((st) => (
                  <div key={st} className="kq-row" style={{ justifyContent: "space-between" }}>
                    <StatusBadge status={st} />
                    <span className="kq-mono">{state.statuses[st]}</span>
                  </div>
                ))}
              </div>
              <div className="kq-row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <span>Passes completed</span>
                <span className="kq-mono">
                  {Math.min(state.pass - 1, state.passesTarget)} / {state.passesTarget}
                </span>
              </div>
              {finishedStudy && <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>You&apos;ve finished both passes — thank you. Extra samples still help.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Just submitted" />
            <CardBody className="kq-stack" style={{ gap: 0 }}>
              {state.recent.length === 0 && <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>Nothing yet. Your samples appear here.</p>}
              {state.recent.map((s) => (
                <div key={s.sample_id} className="kq-row kq-recent">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth */}
                  <img src={`/files/${s.image_path}`} alt="" width={40} height={40} />
                  <span>{s.label}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

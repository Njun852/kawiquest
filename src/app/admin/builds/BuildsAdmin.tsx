"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHead,
  Checkbox,
  DataTable,
  PageHead,
  ProgressBar,
  TextAreaField,
  TextField,
  type Column,
} from "@/components/ui";
import type { BuildRow } from "@/lib/builds/queries";
import type { ActionResult } from "@/lib/server-actions";
import { deleteBuild, makeActive } from "./actions";

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

type Meta = { version: string; model_version: string; notes: string; make_active: boolean };
type Progress = { sent: number; total: number };
class UploadFailed extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

/**
 * Send an APK in the pieces the server asks for. Each piece is retried up to three times on network or server
 * errors, so a dropped connection doesn't restart a 100 MB upload.
 */
async function uploadApk(file: File, meta: Meta, onProgress: (p: Progress) => void, signal: AbortSignal) {
  const start = await fetch("/api/admin/builds/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size, ...meta }),
    signal,
  });
  const s = await start.json().catch(() => ({}));
  if (!start.ok) throw new UploadFailed(s.error ?? "Couldn't start the upload.", s.fieldErrors);
  const { uploadId, chunkSize, chunks } = s as { uploadId: string; chunkSize: number; chunks: number };

  try {
    for (let i = 0; i < chunks; i++) {
      const piece = file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize));
      for (let attempt = 1; ; attempt++) {
        const res = await fetch(`/api/admin/builds/uploads/${uploadId}?index=${i}`, { method: "PUT", body: piece, signal }).catch((e) => {
          if (signal.aborted) throw e;
          return null;
        });
        if (res?.ok) break;
        const retryable = !res || res.status >= 500;
        if (!retryable || attempt === 3) {
          const body = res ? await res.json().catch(() => ({})) : {};
          throw new UploadFailed(body.error ?? "The connection dropped during the upload. Try again.");
        }
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
      onProgress({ sent: Math.min(file.size, (i + 1) * chunkSize), total: file.size });
    }
    const done = await fetch(`/api/admin/builds/uploads/${uploadId}`, { method: "POST", signal });
    const d = await done.json().catch(() => ({}));
    if (!done.ok) throw new UploadFailed(d.error ?? "Couldn't finish the upload.");
    return d as { version: string; is_active: boolean };
  } catch (err) {
    // Leave nothing half-written behind.
    void fetch(`/api/admin/builds/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
    throw err;
  }
}

export function BuildsAdmin({ builds, maxBytes }: { builds: BuildRow[]; maxBytes: number }) {
  const [uploading, setUploading] = useState(builds.length === 0);
  const [notice, setNotice] = useState<string | null>(null);
  const active = builds.find((b) => b.is_active);

  const columns: Column<BuildRow>[] = [
    {
      key: "version",
      header: "Version",
      render: (b) => (
        <span className="kq-stack" style={{ gap: 4, alignItems: "flex-start" }}>
          <strong className="kq-mono">{b.version}</strong>
          {b.is_active && (
            <Badge tone="ok" icon="check">
              Players download this
            </Badge>
          )}
        </span>
      ),
    },
    { key: "model", header: "Model", render: (b) => (b.model_version ? <span className="kq-mono">{b.model_version}</span> : <span className="kq-muted">—</span>) },
    { key: "size", header: "Size", render: (b) => mb(b.size) },
    {
      key: "uploaded",
      header: "Uploaded",
      render: (b) => (
        <>
          {b.uploaded}
          <div className="kq-muted" style={{ fontSize: 12 }}>
            by {b.uploaded_by}
          </div>
        </>
      ),
    },
    { key: "notes", header: "Notes", render: (b) => b.notes ?? <span className="kq-muted">—</span> },
    { key: "actions", header: "", render: (b) => <BuildActions build={b} onDone={setNotice} /> },
  ];

  return (
    <>
      <PageHead
        eyebrow="Game"
        title="Game builds"
        actions={
          <Button variant="primary" icon="upload" onClick={() => setUploading((v) => !v)} aria-expanded={uploading}>
            Upload build
          </Button>
        }
      />
      <p className="kq-muted" style={{ margin: 0 }}>
        {active ? (
          <>
            Players download version <strong className="kq-mono">{active.version}</strong> from{" "}
            <a href="/downloads/kawiquest.apk">/downloads/kawiquest.apk</a>. The game can check{" "}
            <a href="/api/builds/latest">/api/builds/latest</a> for updates.
          </>
        ) : (
          "No build is published yet. The first build you upload becomes the download for players."
        )}
      </p>
      {notice && <Banner tone="ok" title={notice} />}
      {uploading && (
        <UploadPanel
          maxBytes={maxBytes}
          onClose={() => setUploading(false)}
          onUploaded={(m) => {
            setUploading(false);
            setNotice(m);
          }}
        />
      )}
      <Card style={{ overflow: "hidden" }}>
        <CardHead title={`${builds.length} build${builds.length === 1 ? "" : "s"}`}>
          <span className="kq-muted" style={{ fontSize: 13 }}>
            Android · newest first
          </span>
        </CardHead>
        <DataTable caption="Game builds" columns={columns} rows={builds} rowKey={(b) => String(b.build_id)} empty="No builds uploaded yet." />
      </Card>
    </>
  );
}

function BuildActions({ build, onDone }: { build: BuildRow; onDone: (m: string | null) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<ActionResult>({});
  const wrap = (fn: (p: ActionResult, fd: FormData) => Promise<ActionResult>) => async (p: ActionResult, fd: FormData) => {
    const r = await fn(p, fd);
    setState(r);
    if (r.success) onDone(r.success);
    return r;
  };
  const [, activate, activating] = useActionState(wrap(makeActive), {});
  const [, remove, removing] = useActionState(wrap(deleteBuild), {});
  const id = <input type="hidden" name="build_id" value={build.build_id} />;
  return (
    <div className="kq-stack" style={{ gap: 6, alignItems: "flex-end" }}>
      <div className="kq-row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
        <ButtonLink href={`/api/admin/builds/${build.build_id}/file`} size="sm" icon="download">
          Download
        </ButtonLink>
        {!build.is_active && (
          <form action={activate}>
            {id}
            <Button type="submit" size="sm" icon="check" pending={activating}>
              Make active
            </Button>
          </form>
        )}
        {!build.is_active && !confirming && (
          <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirming(true)}>
            Delete…
          </Button>
        )}
      </div>
      {confirming && (
        <form action={remove} className="kq-row" style={{ gap: 6 }}>
          {id}
          <span style={{ fontSize: 13 }}>Delete {build.version}?</span>
          <Button type="submit" size="sm" variant="danger" pending={removing}>
            Delete
          </Button>
          <Button size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </form>
      )}
      {state.error && <small style={{ color: "var(--bad)", fontWeight: 600 }}>{state.error}</small>}
    </div>
  );
}

function UploadPanel({ maxBytes, onClose, onUploaded }: { maxBytes: number; onClose: () => void; onUploaded: (m: string) => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const busy = progress != null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setFieldErrors({});
    if (!file) return setFieldErrors({ file: "Choose the .apk file." });
    if (!/\.apk$/i.test(file.name)) return setFieldErrors({ file: "Choose an Android build: an .apk file." });
    if (file.size > maxBytes) return setFieldErrors({ file: `Builds can be up to ${mb(maxBytes)}.` });
    const meta: Meta = {
      version: String(fd.get("version") ?? "").trim(),
      model_version: String(fd.get("model_version") ?? "").trim(),
      notes: String(fd.get("notes") ?? "").trim(),
      make_active: fd.get("make_active") === "on",
    };
    if (!meta.version) return setFieldErrors({ version: "Enter the version, e.g. 0.4.2." });

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ sent: 0, total: file.size });
    try {
      const build = await uploadApk(file, meta, setProgress, controller.signal);
      onUploaded(`Uploaded version ${build.version}${build.is_active ? "; players now download it" : ""}.`);
      router.refresh();
    } catch (err) {
      if (controller.signal.aborted) setError("Upload cancelled.");
      else if (err instanceof UploadFailed) {
        setError(err.message);
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else setError("The upload failed. Check your connection and try again.");
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const pct = progress ? (progress.sent / progress.total) * 100 : 0;
  return (
    <Card>
      <CardHead title="Upload a build">
        {!busy && (
          <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose}>
            Close
          </Button>
        )}
      </CardHead>
      <CardBody>
        <form onSubmit={submit} className="kq-stack" style={{ gap: 14 }} noValidate>
          <div className="kq-field">
            <label htmlFor="build-file">
              <span>Android build (.apk)</span>
            </label>
            <input
              id="build-file"
              ref={fileRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {fieldErrors.file ? (
              <small className="kq-field__error">{fieldErrors.file}</small>
            ) : (
              <small>{file ? `${file.name} · ${mb(file.size)}` : `Up to ${mb(maxBytes)}. Large files upload in 4 MB pieces.`}</small>
            )}
          </div>
          <div className="kq-grid kq-g2">
            <TextField label="Version" name="version" placeholder="0.4.2" disabled={busy} error={fieldErrors.version} />
            <TextField label="Model version (optional)" name="model_version" placeholder="cnn-2027-03-01" disabled={busy} error={fieldErrors.model_version} />
          </div>
          <TextAreaField label="Release notes (optional)" name="notes" maxLength={500} disabled={busy} error={fieldErrors.notes} />
          <Checkbox label="Make this the build players download" name="make_active" disabled={busy} />
          {progress && (
            <div className="kq-stack" style={{ gap: 6 }}>
              <ProgressBar percent={pct} label="Upload progress" />
              <span className="kq-muted" style={{ fontSize: 13 }}>
                {mb(progress.sent)} of {mb(progress.total)} sent
              </span>
            </div>
          )}
          {error && <Banner tone="bad" title={error} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            {busy ? (
              <Button onClick={() => abortRef.current?.abort()}>Cancel upload</Button>
            ) : (
              <Button onClick={onClose}>Close</Button>
            )}
            <Button type="submit" variant="primary" icon="upload" pending={busy}>
              {busy ? `Uploading… ${Math.floor(pct)}%` : "Upload"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

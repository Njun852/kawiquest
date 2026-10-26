"use client";

import { useActionState, useCallback, useId, useState } from "react";
import { Banner, Button, Card, CardHead, DataTable, Drawer, PageHead, SplitLayout, TextField, type Column } from "@/components/ui";
import type { ActionResult } from "@/lib/server-actions";
import type { Curriculum, LevelRow } from "@/lib/curriculum/queries";
import { deleteLevel, saveLevel } from "./actions";

export function LevelsAdmin({ data }: { data: Curriculum }) {
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const questsOf = (levelId: number) => data.quests.filter((q) => q.level_id === levelId);
  const charactersOf = (levelId: number) => {
    const ids = new Set(questsOf(levelId).map((q) => q.quest_id));
    return new Set(data.tasks.filter((t) => ids.has(t.quest_id)).map((t) => t.character_id)).size;
  };

  const columns: Column<LevelRow>[] = [
    { key: "order", header: "Order", kind: "num", render: (l) => l.level_order },
    { key: "id", header: "ID", kind: "mono", render: (l) => l.level_id },
    { key: "name", header: "Area name", render: (l) => <strong>{l.area_name}</strong> },
    {
      key: "quests",
      header: "Quests",
      render: (l) => questsOf(l.level_id).map((q) => q.quest_name).join(", ") || <span className="kq-muted">None</span>,
    },
    { key: "chars", header: "Characters", kind: "num", render: (l) => charactersOf(l.level_id) },
  ];

  const current = typeof selected === "number" ? data.levels.find((l) => l.level_id === selected) ?? null : null;

  return (
    <>
      <PageHead
        eyebrow="Curriculum"
        title="Game levels"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setSelected("new")}>
            Add level
          </Button>
        }
      />
      {notice && <Banner tone="ok" title={notice} />}
      <SplitLayout open={selected != null}>
        <Card style={{ overflow: "hidden" }}>
          <CardHead title={`${data.levels.length} levels`}>
            <span className="kq-muted" style={{ fontSize: 13 }}>
              In play order · characters come from each level&apos;s quests
            </span>
          </CardHead>
          <DataTable
            caption="Game levels"
            columns={columns}
            rows={data.levels}
            rowKey={(l) => String(l.level_id)}
            selectedKey={typeof selected === "number" ? String(selected) : null}
            onRowClick={(l) => {
              setNotice(null);
              setSelected(l.level_id);
            }}
            empty="No levels yet."
          />
        </Card>
        {selected != null && (selected === "new" || current) && (
          <LevelDrawer
            key={selected}
            level={current}
            nextOrder={Math.max(0, ...data.levels.map((l) => l.level_order)) + 1}
            onClose={close}
            onSaved={(id, message) => {
              if (selected === "new") setNotice(message);
              setSelected(id);
            }}
            onDeleted={(m) => {
              setSelected(null);
              setNotice(m);
            }}
          />
        )}
      </SplitLayout>
    </>
  );
}

function LevelDrawer({
  level,
  nextOrder,
  onClose,
  onSaved,
  onDeleted,
}: {
  level: LevelRow | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: (id: number, message: string) => void;
  onDeleted: (message: string) => void;
}) {
  const formId = useId();
  const [state, save, saving] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await saveLevel(prev, fd);
    if (r.done === "saved" && r.id) onSaved(r.id, r.success!);
    return r;
  }, {});
  const [del, remove, deleting] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await deleteLevel(prev, fd);
    if (r.done === "deleted") onDeleted(r.success!);
    return r;
  }, {});
  const [confirming, setConfirming] = useState(false);
  const err = state.fieldErrors ?? {};

  return (
    <Drawer
      title={level ? `Edit level #${level.level_id}` : "Add level"}
      onClose={onClose}
      footer={
        <>
          {level && (
            <Button variant="danger" icon="trash" iconOnly onClick={() => setConfirming(true)} disabled={confirming}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" icon="save" pending={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id={formId} action={save} className="kq-stack" style={{ gap: 14 }} noValidate>
        <input type="hidden" name="level_id" value={level?.level_id ?? ""} />
        <TextField label="Area name" name="area_name" defaultValue={state.values?.area_name ?? level?.area_name} error={err.area_name} />
        <TextField
          label="Level order"
          name="level_order"
          type="number"
          min={1}
          defaultValue={state.values?.level_order ?? level?.level_order ?? nextOrder}
          error={err.level_order}
          hint="Position in play order; lower comes first."
        />
        {state.error && <Banner tone="bad" title={state.error} />}
        {state.success && <Banner tone="ok" title={state.success} />}
      </form>
      {confirming && level && (
        <form action={remove} className="kq-stack" style={{ gap: 10 }}>
          <input type="hidden" name="level_id" value={level.level_id} />
          <Banner tone="bad" title={`Delete ${level.area_name}?`}>
            This can&apos;t be undone.
          </Banner>
          {del.error && <Banner tone="bad" title={del.error} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            <Button onClick={() => setConfirming(false)}>Keep it</Button>
            <Button type="submit" variant="danger" icon="trash" pending={deleting}>
              {deleting ? "Deleting…" : "Delete level"}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

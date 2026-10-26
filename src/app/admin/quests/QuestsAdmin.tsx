"use client";

import { useActionState, useCallback, useId, useMemo, useState } from "react";
import {
  Banner,
  Button,
  Card,
  CardHead,
  CopperTile,
  DataTable,
  Drawer,
  Icon,
  PageHead,
  SelectField,
  SplitLayout,
  TextField,
  type Column,
} from "@/components/ui";
import type { ActionResult } from "@/lib/server-actions";
import type { Curriculum, QuestRow } from "@/lib/curriculum/queries";
import { deleteQuest, saveQuest } from "./actions";

/** Quests in tree order: each top-level quest followed by its sub-quests, by quest_order. */
function treeOrder(quests: QuestRow[]) {
  const byParent = new Map<number | null, QuestRow[]>();
  for (const q of quests) {
    const key = q.parent_quest_id != null && quests.some((p) => p.quest_id === q.parent_quest_id) ? q.parent_quest_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), q]);
  }
  const out: { quest: QuestRow; depth: number }[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const q of (byParent.get(parent) ?? []).sort((a, b) => a.quest_order - b.quest_order || a.quest_id - b.quest_id)) {
      out.push({ quest: q, depth });
      if (depth < 20) walk(q.quest_id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function QuestsAdmin({ data }: { data: Curriculum }) {
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const levelName = new Map(data.levels.map((l) => [l.level_id, `${l.level_order} · ${l.area_name}`]));
  const questName = new Map(data.quests.map((q) => [q.quest_id, q.quest_name]));
  const taskCount = (id: number) => data.tasks.filter((t) => t.quest_id === id).length;
  const rows = useMemo(() => treeOrder(data.quests), [data.quests]);

  const columns: Column<{ quest: QuestRow; depth: number }>[] = [
    { key: "order", header: "Order", kind: "num", render: ({ quest }) => quest.quest_order },
    { key: "id", header: "ID", kind: "mono", render: ({ quest }) => quest.quest_id },
    {
      key: "name",
      header: "Quest",
      render: ({ quest, depth }) => (
        <span style={{ paddingLeft: depth * 18, fontWeight: 600, display: "inline-flex", gap: 6, alignItems: "center" }}>
          {depth > 0 && <span className="kq-muted" aria-hidden>↳</span>}
          {quest.quest_name}
        </span>
      ),
    },
    { key: "level", header: "Level", render: ({ quest }) => levelName.get(quest.level_id) ?? "—" },
    {
      key: "parent",
      header: "Part of",
      render: ({ quest }) => (quest.parent_quest_id ? questName.get(quest.parent_quest_id) : <span className="kq-muted">—</span>),
    },
    { key: "tasks", header: "Tasks", kind: "num", render: ({ quest }) => taskCount(quest.quest_id) },
  ];

  const current = typeof selected === "number" ? data.quests.find((q) => q.quest_id === selected) ?? null : null;

  return (
    <>
      <PageHead
        eyebrow="Curriculum"
        title="Quests"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setSelected("new")}>
            Add quest
          </Button>
        }
      />
      {notice && <Banner tone="ok" title={notice} />}
      <SplitLayout open={selected != null}>
        <Card style={{ overflow: "hidden" }}>
          <CardHead title={`${data.quests.length} quests`}>
            <span className="kq-muted" style={{ fontSize: 13 }}>
              Sub-quests are listed under the quest they are part of
            </span>
          </CardHead>
          <DataTable
            caption="Quests"
            columns={columns}
            rows={rows}
            rowKey={({ quest }) => String(quest.quest_id)}
            selectedKey={typeof selected === "number" ? String(selected) : null}
            onRowClick={({ quest }) => {
              setNotice(null);
              setSelected(quest.quest_id);
            }}
            empty="No quests yet."
          />
        </Card>
        {selected != null && (selected === "new" || current) && (
          <QuestDrawer
            key={selected}
            quest={current}
            data={data}
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

function QuestDrawer({
  quest,
  data,
  onClose,
  onSaved,
  onDeleted,
}: {
  quest: QuestRow | null;
  data: Curriculum;
  onClose: () => void;
  onSaved: (id: number, message: string) => void;
  onDeleted: (message: string) => void;
}) {
  const formId = useId();
  const [state, save, saving] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await saveQuest(prev, fd);
    if (r.done === "saved" && r.id) onSaved(r.id, r.success!);
    return r;
  }, {});
  const [del, remove, deleting] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await deleteQuest(prev, fd);
    if (r.done === "deleted") onDeleted(r.success!);
    return r;
  }, {});
  const [confirming, setConfirming] = useState(false);
  const [tasks, setTasks] = useState<number[]>(() =>
    quest ? data.tasks.filter((t) => t.quest_id === quest.quest_id).map((t) => t.character_id) : [],
  );
  const err = state.fieldErrors ?? {};
  const v = (key: string, fallback: string) => state.values?.[key] ?? fallback;

  // A quest can't be placed under itself or anything below it.
  const blocked = useMemo(() => {
    const out = new Set<number>();
    if (!quest) return out;
    const stack = [quest.quest_id];
    while (stack.length) {
      const id = stack.pop()!;
      out.add(id);
      for (const q of data.quests) if (q.parent_quest_id === id && !out.has(q.quest_id)) stack.push(q.quest_id);
    }
    return out;
  }, [quest, data.quests]);

  return (
    <Drawer
      title={quest ? `Edit quest #${quest.quest_id}` : "Add quest"}
      onClose={onClose}
      footer={
        <>
          {quest && (
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
        <input type="hidden" name="quest_id" value={quest?.quest_id ?? ""} />
        <input type="hidden" name="tasks" value={JSON.stringify(tasks)} />
        <TextField label="Quest name" name="quest_name" defaultValue={v("quest_name", quest?.quest_name ?? "")} error={err.quest_name} />
        <div className="kq-grid kq-g2">
          <SelectField
            label="Game level"
            name="level_id"
            defaultValue={v("level_id", String(quest?.level_id ?? data.levels[0]?.level_id ?? ""))}
            error={err.level_id}
            options={data.levels.map((l) => ({ value: String(l.level_id), label: `${l.level_order} · ${l.area_name}` }))}
          />
          <TextField
            label="Quest order"
            name="quest_order"
            type="number"
            min={1}
            defaultValue={v("quest_order", String(quest?.quest_order ?? Math.max(0, ...data.quests.map((q) => q.quest_order)) + 1))}
            error={err.quest_order}
          />
        </div>
        <SelectField
          label="Part of"
          name="parent_quest_id"
          defaultValue={v("parent_quest_id", quest?.parent_quest_id ? String(quest.parent_quest_id) : "")}
          error={err.parent_quest_id}
          hint="Leave empty for a top-level quest."
          options={[
            { value: "", label: "— Top-level quest" },
            ...data.quests.filter((q) => !blocked.has(q.quest_id)).map((q) => ({ value: String(q.quest_id), label: q.quest_name })),
          ]}
        />
        <TaskEditor data={data} tasks={tasks} onChange={setTasks} error={err.tasks} />
        {state.error && <Banner tone="bad" title={state.error} />}
        {state.success && <Banner tone="ok" title={state.success} />}
      </form>
      {confirming && quest && (
        <form action={remove} className="kq-stack" style={{ gap: 10 }}>
          <input type="hidden" name="quest_id" value={quest.quest_id} />
          <Banner tone="bad" title={`Delete ${quest.quest_name}?`}>
            Its task list is deleted too. This can&apos;t be undone.
          </Banner>
          {del.error && <Banner tone="bad" title={del.error} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            <Button onClick={() => setConfirming(false)}>Keep it</Button>
            <Button type="submit" variant="danger" icon="trash" pending={deleting}>
              {deleting ? "Deleting…" : "Delete quest"}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

/** quest_tasks: the characters this quest asks for, in task_order. */
function TaskEditor({
  data,
  tasks,
  onChange,
  error,
}: {
  data: Curriculum;
  tasks: number[];
  onChange: (next: number[]) => void;
  error?: string;
}) {
  const [adding, setAdding] = useState("");
  const byId = new Map(data.characters.map((c) => [c.character_id, c]));
  const move = (i: number, by: number) => {
    const next = [...tasks];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    onChange(next);
  };
  const available = data.characters.filter((c) => !tasks.includes(c.character_id));

  return (
    <div className="kq-stack" style={{ gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>Tasks · {tasks.length} character(s), in order</span>
      {tasks.length > 0 ? (
        <ol className="kq-tasklist" aria-label="Tasks">
          {tasks.map((id, i) => {
            const c = byId.get(id);
            return (
              <li key={id}>
                <span className="kq-mono">{i + 1}</span>
                {c ? <CopperTile form={c.form} size="sm" /> : null}
                <span>
                  {c ? `${c.transliteration} · ${c.name}` : `#${id} (deleted)`}
                </span>
                <Button variant="ghost" size="sm" icon="up" iconOnly disabled={i === 0} onClick={() => move(i, -1)}>
                  Move up
                </Button>
                <Button variant="ghost" size="sm" iconOnly icon="down" disabled={i === tasks.length - 1} onClick={() => move(i, 1)}>
                  Move down
                </Button>
                <Button variant="ghost" size="sm" icon="x" iconOnly onClick={() => onChange(tasks.filter((t) => t !== id))}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
          No characters yet. A quest with no tasks is a story step (like the tutorial or the finale).
        </p>
      )}
      <div className="kq-row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <select className="kq-input" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Character to add" style={{ flex: 1, minWidth: 0 }}>
          <option value="">Choose a character to add…</option>
          {data.categories.map((cat) => (
            <optgroup key={cat.category_id} label={cat.category_name}>
              {available
                .filter((c) => c.category_id === cat.category_id)
                .map((c) => (
                  <option key={c.character_id} value={c.character_id}>
                    {c.transliteration} · {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <Button
          size="sm"
          icon="plus"
          disabled={!adding}
          onClick={() => {
            onChange([...tasks, Number(adding)]);
            setAdding("");
          }}
        >
          Add
        </Button>
      </div>
      {error && (
        <small className="kq-field__error">
          <Icon name="alert" />
          {error}
        </small>
      )}
    </div>
  );
}

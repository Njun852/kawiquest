"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHead,
  CopperTile,
  DataTable,
  FilterBar,
  PageHead,
  SelectField,
  SplitLayout,
  Tabs,
  TextField,
  type Column,
} from "@/components/ui";
import type { CharacterRow, Curriculum } from "@/lib/curriculum/queries";
import { CharacterDrawer } from "./CharacterDrawer";
import { ImportPanel } from "./ImportPanel";

/** Where each character is taught: the levels of the quests it is a task of. */
function useTaughtIn(data: Curriculum) {
  return useMemo(() => {
    const levelOfQuest = new Map(data.quests.map((q) => [q.quest_id, q.level_id]));
    const levelName = new Map(data.levels.map((l) => [l.level_id, l.area_name]));
    const map = new Map<number, { levelIds: number[]; label: string }>();
    for (const t of data.tasks) {
      const levelId = levelOfQuest.get(t.quest_id);
      if (levelId == null) continue;
      const entry = map.get(t.character_id) ?? { levelIds: [], label: "" };
      if (!entry.levelIds.includes(levelId)) entry.levelIds.push(levelId);
      entry.label = entry.levelIds.map((id) => levelName.get(id)).join(", ");
      map.set(t.character_id, entry);
    }
    return map;
  }, [data]);
}

export function CharactersAdmin({ data }: { data: Curriculum }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const taughtIn = useTaughtIn(data);
  const categoryName = new Map(data.categories.map((c) => [c.category_id, c.category_name]));

  const q = query.trim().toLowerCase();
  const visible = data.characters.filter((c) => {
    if (tab !== "all" && c.category_id !== Number(tab)) return false;
    if (level === "none" && taughtIn.has(c.character_id)) return false;
    if (level && level !== "none" && !taughtIn.get(c.character_id)?.levelIds.includes(Number(level))) return false;
    if (!q) return true;
    return [c.name, c.transliteration, c.unicode_codepoint, `#${c.character_id}`, c.form].some((s) => s.toLowerCase().includes(q));
  });

  const columns: Column<CharacterRow>[] = [
    { key: "form", header: "Form", render: (c) => <CopperTile form={c.form} size="md" label={c.transliteration} /> },
    {
      key: "name",
      header: "Name · code point",
      render: (c) => (
        <>
          <strong>{c.name}</strong>
          <div className="kq-mono kq-muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
            #{c.character_id} · {c.unicode_codepoint}
          </div>
        </>
      ),
    },
    { key: "translit", header: "Translit.", render: (c) => c.transliteration },
    { key: "category", header: "Category", render: (c) => categoryName.get(c.category_id) ?? "—" },
    {
      key: "flags",
      header: "Flags",
      render: (c) =>
        c.base_letter ? (
          <Badge tone="wait" icon="clock">
            Combining · on {c.base_letter}
          </Badge>
        ) : categoryName.get(c.category_id) === "Ligatures" ? (
          <Badge>Ligature</Badge>
        ) : (
          <span className="kq-muted">—</span>
        ),
    },
    {
      key: "level",
      header: "Taught in",
      render: (c) => taughtIn.get(c.character_id)?.label ?? <span className="kq-muted">Not in a quest</span>,
    },
  ];

  const current = typeof selected === "number" ? data.characters.find((c) => c.character_id === selected) ?? null : null;

  return (
    <>
      <PageHead
        eyebrow="Curriculum"
        title="Kawi characters"
        actions={
          <>
            <Button icon="upload" onClick={() => setImporting((v) => !v)} aria-expanded={importing}>
              Import CSV
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setSelected("new")}>
              Add character
            </Button>
          </>
        }
      />

      {notice && <Banner tone="ok" title={notice} />}
      {importing && <ImportPanel onClose={() => setImporting(false)} />}

      <Tabs
        label="Category"
        value={tab}
        onChange={setTab}
        items={[
          { value: "all", label: "All", count: data.characters.length },
          ...data.categories.map((c) => ({
            value: String(c.category_id),
            label: c.category_name,
            count: data.characters.filter((ch) => ch.category_id === c.category_id).length,
          })),
        ]}
      />

      <FilterBar>
        <TextField
          compact
          grow
          label="Search"
          placeholder="Name, transliteration, code point or #id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectField
          compact
          label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          options={[
            { value: "", label: "All levels" },
            ...data.levels.map((l) => ({ value: String(l.level_id), label: `${l.level_order} · ${l.area_name}` })),
            { value: "none", label: "Not in a quest" },
          ]}
        />
      </FilterBar>

      <SplitLayout open={selected != null}>
        <Card style={{ overflow: "hidden" }}>
          <CardHead title={`${data.characters.length} characters`}>
            <span className="kq-muted" style={{ fontSize: 13 }}>
              Click a row to edit · {visible.length} of {data.characters.length}
            </span>
          </CardHead>
          <DataTable
            caption="Kawi characters"
            columns={columns}
            rows={visible}
            rowKey={(c) => String(c.character_id)}
            selectedKey={typeof selected === "number" ? String(selected) : null}
            onRowClick={(c) => {
              setNotice(null);
              setSelected(c.character_id);
            }}
            empty="No characters match these filters."
          />
        </Card>

        {selected != null && (selected === "new" || current) && (
          <CharacterDrawer
            key={selected}
            character={current}
            categories={data.categories}
            taughtIn={current ? taughtIn.get(current.character_id)?.label ?? null : null}
            onClose={close}
            onSaved={(id, message) => {
              if (selected === "new") setNotice(message);
              setSelected(id);
            }}
            onDeleted={(message) => {
              setSelected(null);
              setNotice(message);
            }}
          />
        )}
      </SplitLayout>
    </>
  );
}

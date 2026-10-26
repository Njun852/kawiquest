"use client";

import { useCallback, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHead,
  Checkbox,
  CopperTile,
  DataTable,
  Drawer,
  FilterBar,
  Segmented,
  SelectField,
  SplitLayout,
  Tabs,
  TextAreaField,
  TextField,
  codePoints,
  type Column,
} from "@/components/ui";

// Sample rows from the AdminCharacters preview; module 2 replaces them with kawi_characters.
type Row = { id: number; form: string; name: string; translit: string; category: string; flag?: "ligature" | "combining" };

const rows: Row[] = [
  { id: 1, form: "𑼄", name: "A", translit: "a", category: "Vowels" },
  { id: 14, form: "𑼒", name: "KA", translit: "ka", category: "Consonants" },
  { id: 48, form: "𑽑", name: "DIGIT ONE", translit: "1", category: "Digits" },
  { id: 62, form: "𑼒𑼶", name: "VOWEL SIGN I", translit: "i", category: "Marked forms", flag: "combining" },
  { id: 72, form: "𑼒𑽁", name: "SIGN KILLER", translit: "(killer)", category: "Marked forms", flag: "combining" },
  { id: 88, form: "𑼒𑽂𑼱", name: "KSA", translit: "ksa", category: "Ligatures", flag: "ligature" },
  { id: 101, form: "𑽃", name: "DANDA", translit: "(danda)", category: "Punctuation" },
];

const categories = ["Vowels", "Consonants", "Digits", "Marked forms", "Punctuation", "Ligatures"];

const columns: Column<Row>[] = [
  { key: "form", header: "Form", render: (r) => <CopperTile form={r.form} size="md" /> },
  {
    key: "name",
    header: "Name · code point",
    render: (r) => (
      <>
        <strong>{r.name}</strong>
        <div className="kq-mono kq-muted" style={{ fontSize: 11 }}>
          #{r.id} · {codePoints(r.form)}
        </div>
      </>
    ),
  },
  { key: "translit", header: "Translit.", render: (r) => r.translit },
  { key: "category", header: "Category", render: (r) => r.category },
  {
    key: "flags",
    header: "Flags",
    render: (r) =>
      r.flag === "ligature" ? (
        <Badge>Ligature</Badge>
      ) : r.flag === "combining" ? (
        <Badge tone="wait" icon="clock">
          Combining · on KA
        </Badge>
      ) : (
        <span className="kq-muted">—</span>
      ),
  },
];

export function InteractiveDemo() {
  const [tab, setTab] = useState("all");
  const [seg, setSeg] = useState("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const visible = rows.filter(
    (r) =>
      (tab === "all" || r.category === tab) &&
      (!query || `${r.name} ${r.translit} ${codePoints(r.form)}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      <div className="kq-row" style={{ justifyContent: "space-between" }}>
        <h2 className="kq-h-title">CRUD pattern: tabs → filter card → table → drawer</h2>
        <Segmented
          label="Status"
          value={seg}
          onChange={setSeg}
          items={[
            { value: "pending", label: "Pending" },
            { value: "flagged", label: "Flagged" },
            { value: "mine", label: "Mine" },
          ]}
        />
      </div>

      <Tabs
        label="Category"
        value={tab}
        onChange={setTab}
        items={[
          { value: "all", label: "All", count: rows.length },
          ...categories.map((c) => ({ value: c, label: c, count: rows.filter((r) => r.category === c).length })),
        ]}
      />

      <FilterBar>
        <TextField
          compact
          grow
          label="Search"
          placeholder="Name, transliteration or code point"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectField
          compact
          label="Level"
          options={[
            { value: "", label: "All levels" },
            { value: "1", label: "1 · Lost Temple" },
            { value: "2", label: "2 · Lantern Spirits" },
            { value: "3", label: "3 · Playground" },
            { value: "4", label: "4 · Industrials" },
            { value: "5", label: "5 · School" },
          ]}
        />
      </FilterBar>

      <SplitLayout open={selected != null}>
        <Card style={{ overflow: "hidden" }}>
          <CardHead title={`${rows.length} characters`}>
            <span className="kq-muted" style={{ fontSize: 13 }}>
              Click a row to edit · {visible.length} of {rows.length}
            </span>
          </CardHead>
          <DataTable
            caption="Kawi characters"
            columns={columns}
            rows={visible}
            rowKey={(r) => String(r.id)}
            selectedKey={selected ? String(selected.id) : null}
            onRowClick={setSelected}
            empty="No characters match that search."
          />
        </Card>

        {selected && (
          <Drawer
            key={selected.id}
            title={`Edit character #${selected.id}`}
            onClose={close}
            footer={
              <>
                <Button variant="danger" icon="trash" iconOnly>
                  Delete
                </Button>
                <Button onClick={close}>Cancel</Button>
                <Button variant="primary" icon="save">
                  Save
                </Button>
              </>
            }
          >
            <div className="kq-row" style={{ gap: 16, flexWrap: "nowrap" }}>
              <CopperTile form={selected.form} size="lg" large />
              <div className="kq-stack" style={{ gap: 6 }}>
                <strong style={{ fontSize: 13 }}>Reference glyph</strong>
                <span className="kq-mono kq-muted" style={{ fontSize: 12 }}>
                  glyphs/{selected.translit}.svg
                </span>
                <Button size="sm" icon="upload">
                  Replace image
                </Button>
              </div>
            </div>
            <div className="kq-grid kq-g2">
              <TextField label="Name" defaultValue={selected.name} />
              <TextField label="Transliteration" defaultValue={selected.translit} />
            </div>
            <TextField
              label="Unicode code points"
              mono
              defaultValue={codePoints(selected.form)}
              hint={selected.flag === "ligature" ? "Ligatures: consonant + conjoiner + consonant" : undefined}
            />
            <SelectField
              label="Category"
              defaultValue={selected.category}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
            <div className="kq-row" style={{ gap: 20 }}>
              <Checkbox label="Is ligature" defaultChecked={selected.flag === "ligature"} />
              <Checkbox label="Is combining mark" defaultChecked={selected.flag === "combining"} />
            </div>
            <TextAreaField label="Remarks" placeholder="Required to reject or flag" error="Add a remark to flag this sample." />
          </Drawer>
        )}
      </SplitLayout>
    </>
  );
}

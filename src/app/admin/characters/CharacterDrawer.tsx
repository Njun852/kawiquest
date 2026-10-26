"use client";

import { useActionState, useId, useState } from "react";
import { Banner, Button, CopperTile, Drawer, SelectField, TextField } from "@/components/ui";
import type { ActionResult } from "@/lib/server-actions";
import { CATEGORY_ID } from "@/lib/constants";
import { CONSONANTS } from "@/lib/curriculum/forms";
import type { CategoryRow, CharacterRow } from "@/lib/curriculum/queries";
import { deleteCharacter, removeGlyph, saveCharacter, uploadGlyph } from "./actions";

export function CharacterDrawer({
  character,
  categories,
  taughtIn,
  onClose,
  onSaved,
  onDeleted,
}: {
  character: CharacterRow | null;
  categories: CategoryRow[];
  taughtIn: string | null;
  onClose: () => void;
  onSaved: (id: number, message: string) => void;
  onDeleted: (message: string) => void;
}) {
  const formId = useId();
  const [category, setCategory] = useState(String(character?.category_id ?? CATEGORY_ID.vowels));
  const isMarked = Number(category) === CATEGORY_ID.marked;

  const [state, save, saving] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await saveCharacter(prev, fd);
    if (r.done === "saved" && r.id) onSaved(r.id, r.success!);
    return r;
  }, {});
  const [del, remove, deleting] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await deleteCharacter(prev, fd);
    if (r.done === "deleted") onDeleted(r.success!);
    return r;
  }, {});
  const [confirming, setConfirming] = useState(false);

  const err = state.fieldErrors ?? {};
  const v = (key: keyof CharacterRow) => state.values?.[key] ?? (character ? String(character[key] ?? "") : "");

  return (
    <Drawer
      title={character ? `Edit character #${character.character_id}` : "Add character"}
      onClose={onClose}
      footer={
        <>
          {character && (
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
      {character ? <GlyphEditor character={character} /> : null}

      {/* Keyed on the stored row: after a save the refreshed data remounts the form with fresh values.
          Fields are uncontrolled because React resets a form after its action, which would desync controlled ones. */}
      <form key={character ? JSON.stringify(character) : "new"} id={formId} action={save} className="kq-stack" style={{ gap: 14 }} noValidate>
        <input type="hidden" name="character_id" value={character?.character_id ?? ""} />
        <div className="kq-grid kq-g2">
          <TextField label="Name" name="name" defaultValue={v("name")} error={err.name} placeholder="KA" />
          <TextField label="Transliteration" name="transliteration" defaultValue={v("transliteration")} error={err.transliteration} placeholder="ka" />
        </div>
        <TextField
          label="Unicode code points"
          name="unicode_codepoint"
          mono
          defaultValue={v("unicode_codepoint")}
          error={err.unicode_codepoint}
          placeholder="U+11F12"
          hint={
            Number(category) === CATEGORY_ID.ligatures
              ? "Ligatures: consonant + conjoiner + consonant, e.g. 11F12 11F42 11F31"
              : isMarked
                ? "The mark's own code point; it is shown on the base letter."
                : "One code point, e.g. U+11F12. You can also paste the Kawi character."
          }
        />
        <SelectField
          label="Category"
          name="category_id"
          defaultValue={v("category_id") || category}
          onChange={(e) => setCategory(e.target.value)}
          error={err.category_id}
          options={categories.map((c) => ({ value: String(c.category_id), label: c.category_name }))}
        />
        <SelectField
          key={isMarked ? "marked" : "other"}
          label="Base letter"
          name="base_letter"
          disabled={!isMarked}
          defaultValue={isMarked ? v("base_letter") || "KA" : ""}
          error={err.base_letter}
          hint="Only for marked forms, which are written on a base letter."
          options={[{ value: "", label: "—" }, ...CONSONANTS.map(([n, tr]) => ({ value: n, label: `${n} · ${tr}` }))]}
        />
        {character && (
          <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>
            Taught in: {taughtIn ?? "not in any quest yet — add it on the Quests page."}
          </p>
        )}
        {state.error && <Banner tone="bad" title={state.error} />}
        {state.success && <Banner tone="ok" title={state.success} />}
      </form>

      {confirming && character && (
        <form action={remove} className="kq-stack" style={{ gap: 10 }}>
          <input type="hidden" name="character_id" value={character.character_id} />
          <Banner tone="bad" title={`Delete #${character.character_id} ${character.name}?`}>
            It is also removed from every quest. This can&apos;t be undone.
          </Banner>
          {del.error && <Banner tone="bad" title={del.error} />}
          <div className="kq-row" style={{ justifyContent: "flex-end" }}>
            <Button onClick={() => setConfirming(false)}>Keep it</Button>
            <Button type="submit" variant="danger" icon="trash" pending={deleting}>
              {deleting ? "Deleting…" : "Delete character"}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

/** Reference glyph: the uploaded image on paper, or the font rendering on a copper tile until one is uploaded. */
function GlyphEditor({ character }: { character: CharacterRow }) {
  // One result line for both forms: whichever ran last.
  const [result, setResult] = useState<ActionResult>({});
  const [, upload, uploading] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await uploadGlyph(prev, fd);
    setResult(r);
    return r;
  }, {});
  const [, removeAction, removing] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await removeGlyph(prev, fd);
    setResult(r);
    return r;
  }, {});
  const inputId = useId();
  return (
    <div className="kq-stack" style={{ gap: 8 }}>
      <div className="kq-row" style={{ gap: 16, flexWrap: "nowrap", alignItems: "flex-start" }}>
        {character.reference_glyph ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth
          <img className="kq-glyph-ref" src={`/files/${character.reference_glyph}`} alt={`Reference glyph for ${character.transliteration}`} />
        ) : (
          <CopperTile form={character.form} size="lg" large label={character.transliteration} />
        )}
        <div className="kq-stack" style={{ gap: 6, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Reference glyph</span>
          <span className="kq-mono kq-muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>
            {character.reference_glyph ?? "None yet — showing the Noto Sans Kawi form"}
          </span>
          <form action={upload} className="kq-row" style={{ gap: 6 }}>
            <input type="hidden" name="character_id" value={character.character_id} />
            <label htmlFor={inputId} className="kq-sr-only">
              Reference glyph image
            </label>
            <input
              id={inputId}
              type="file"
              name="glyph"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="kq-file"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            <Button size="sm" icon="upload" pending={uploading} onClick={() => document.getElementById(inputId)?.click()}>
              {uploading ? "Uploading…" : character.reference_glyph ? "Replace image" : "Upload image"}
            </Button>
          </form>
          {character.reference_glyph && (
            <form action={removeAction}>
              <input type="hidden" name="character_id" value={character.character_id} />
              <Button type="submit" variant="ghost" size="sm" pending={removing}>
                Remove image
              </Button>
            </form>
          )}
        </div>
      </div>
      {result.error && <Banner tone="bad" title={result.error} />}
      {result.success && <Banner tone="ok" title={result.success} />}
    </div>
  );
}

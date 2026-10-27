import type { Metadata } from "next";
import { Suspense } from "react";
import { CopperTile, PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/auth/session";
import { loadCurriculum } from "@/lib/curriculum/queries";

export const metadata: Metadata = { title: "Reference glyphs" };

/** The validated reference form of every character, by category: what samples are judged against. */
export default function GlyphsPage() {
  return (
    <>
      <PageHead eyebrow="Review" title="Reference glyphs" />
      <Suspense fallback={<div aria-busy />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireAccount(["validator"]);
  const { categories, characters } = await loadCurriculum();
  const withImage = characters.filter((c) => c.reference_glyph).length;
  return (
    <>
      <p className="kq-muted" style={{ margin: 0 }}>
        {withImage} of {characters.length} characters have an uploaded reference image; the rest show the Noto Sans Kawi
        form. Dependent signs are shown on KA.
      </p>
      {categories.map((cat) => {
        const list = characters.filter((c) => c.category_id === cat.category_id);
        if (!list.length) return null;
        return (
          <section key={cat.category_id} className="kq-stack" style={{ gap: 10 }}>
            <h2 className="kq-h-title">
              {cat.category_name} <span className="kq-mono kq-muted" style={{ fontSize: 13 }}>{list.length}</span>
            </h2>
            <div className="kq-glyphgrid">
              {list.map((c) => (
                <div key={c.character_id} className="kq-card kq-glyph">
                  {c.reference_glyph ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served from our own /files route with auth
                    <img src={`/files/${c.reference_glyph}`} alt={`Reference form of ${c.transliteration}`} className="kq-glyph__img" />
                  ) : (
                    <CopperTile form={c.form} size="lg" large label={c.transliteration} />
                  )}
                  <span className="kq-glyph__tr">{c.transliteration}</span>
                  <span className="kq-mono kq-muted" style={{ fontSize: 12 }}>
                    {c.name} · {c.unicode_codepoint}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

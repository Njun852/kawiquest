"use client";

import { useEffect, useRef, useState } from "react";
import { CopperTile } from "@/components/ui";
import type { PlateHandle } from "./plate-scene";

// Letters the plate cycles through: common consonants and vowels, in Unicode order from the Kawi block.
const consonant = (i: number) => String.fromCodePoint(0x11f12 + i);
const LETTERS = [
  { form: consonant(0), tr: "ka", name: "KA" },
  { form: String.fromCodePoint(0x11f04), tr: "a", name: "A" },
  { form: consonant(2), tr: "ga", name: "GA" },
  { form: consonant(4), tr: "ṅa", name: "NGA" },
  { form: consonant(15), tr: "ta", name: "TA" },
  { form: consonant(17), tr: "da", name: "DA" },
  { form: consonant(19), tr: "na", name: "NA" },
  { form: consonant(20), tr: "pa", name: "PA" },
  { form: consonant(22), tr: "ba", name: "BA" },
  { form: consonant(24), tr: "ma", name: "MA" },
  { form: consonant(25), tr: "ya", name: "YA" },
  { form: consonant(26), tr: "ra", name: "RA" },
  { form: consonant(27), tr: "la", name: "LA" },
  { form: consonant(28), tr: "wa", name: "WA" },
  { form: consonant(31), tr: "sa", name: "SA" },
  { form: consonant(32), tr: "ha", name: "HA" },
  { form: String.fromCodePoint(0x11f06), tr: "i", name: "I" },
  { form: String.fromCodePoint(0x11f08), tr: "u", name: "U" },
];

/**
 * The sign-in hero: a 3D copper plate (three.js) with one engraved letter. Moving the pointer rakes the light
 * across the engraving; clicking the plate or the button engraves the next letter. Without WebGL, or until the
 * scene is ready, a flat copper tile shows the same letter.
 */
export function CopperPlate() {
  const stageRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<PlateHandle | null>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const letter = LETTERS[index];
  const next = () => setIndex((i) => (i + 1) % LETTERS.length);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./plate-scene")
      .then(({ mountPlate }) =>
        mountPlate(stage, {
          form: LETTERS[0].form,
          reducedMotion,
          onTap: () => setIndex((i) => (i + 1) % LETTERS.length),
          onReady: () => !cancelled && setReady(true),
        }),
      )
      .then((handle) => {
        if (cancelled) handle?.dispose();
        else plateRef.current = handle;
      })
      .catch(() => {
        // Keep the static tile if three.js fails to load.
      });
    return () => {
      cancelled = true;
      plateRef.current?.dispose();
      plateRef.current = null;
    };
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    plateRef.current?.engrave(letter.form);
  }, [letter.form]);

  return (
    <div className="kq-plate3d">
      <div ref={stageRef} className="kq-plate3d__stage" data-ready={ready}>
        {!ready && <CopperTile form={letter.form} size="xl" large className="kq-plate3d__fallback" />}
      </div>
      <div className="kq-plate3d__caption">
        <p className="kq-plate3d__letter" aria-live="polite">
          <span className="kq-plate3d__tr">{letter.tr}</span>
          <span className="kq-plate3d__name">Kawi letter {letter.name}</span>
        </p>
        {/* Password-manager extensions (Edge) stamp an fdprocessedid attribute on buttons before hydration. */}
        <button type="button" className="kq-plate3d__next" onClick={next} suppressHydrationWarning>
          Engrave another
        </button>
      </div>
      <p className="kq-plate3d__hint">Move across the plate to catch the light.</p>
    </div>
  );
}

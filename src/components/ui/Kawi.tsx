import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type TileSize = "sm" | "md" | "lg" | "xl";

/**
 * Kawi on a copper tile: a flat warm copper square with a dark-brown glyph — the main link to the game.
 * Mastery grid: "learned" = off-white (mastered), default copper = practising, "locked" = sunken with "?".
 */
export function CopperTile({
  form,
  size = "md",
  state = "default",
  large,
  selected,
  label,
  className,
}: {
  form: string;
  size?: TileSize;
  state?: "default" | "learned" | "locked";
  /** 12px radius, for big reference tiles and the logo. */
  large?: boolean;
  selected?: boolean;
  /** Accessible name, e.g. the transliteration; otherwise the form is read as text. */
  label?: string;
  className?: string;
}) {
  // Multi-codepoint forms (sign on KA, ligatures) render a little smaller to fit the tile.
  const multi = [...form].length > 1;
  return (
    <span
      className={cx(
        "kq-tile",
        `kq-tile--${size}`,
        multi && "kq-tile--multi",
        large && "kq-tile--rivets",
        state === "learned" && "kq-tile--learned",
        state === "locked" && "kq-tile--locked",
        selected && "kq-tile--selected",
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      lang={state === "locked" ? undefined : "kaw"}
    >
      {state === "locked" ? "?" : form}
    </span>
  );
}

/**
 * One Kawi character or ligature: form on a copper tile, transliteration, code point or rule, and state.
 * Dependent signs are passed already on the base letter KA.
 */
export function GlyphCard({
  form,
  transliteration,
  detail,
  status,
}: {
  form: string;
  transliteration: string;
  /** Code point ("U+11F12") or rule ("sign I on KA", "ligature"). */
  detail: string;
  status?: ReactNode;
}) {
  return (
    <div className="kq-card kq-glyph">
      <CopperTile form={form} size="lg" large />
      <span className="kq-glyph__tr">{transliteration}</span>
      <span className="kq-mono kq-muted">{detail}</span>
      {status}
    </div>
  );
}

/** The letter KA on a copper plate beside "Kawi" (ink) "Quest" (link copper; copper-on-dark on teal). */
export function Logo() {
  return (
    <span className="kq-logo">
      <span className="kq-tile kq-tile--rivets" lang="kaw" aria-hidden>
        𑼒
      </span>
      <span>
        Kawi<b>Quest</b>
      </span>
    </span>
  );
}

/** Format a form's code points the way the admin panel shows them: "U+11F12" or "11F12 11F42 11F31". */
export function codePoints(form: string) {
  const cps = [...form].map((ch) => ch.codePointAt(0)!.toString(16).toUpperCase());
  return cps.length === 1 ? `U+${cps[0]}` : cps.join(" ");
}

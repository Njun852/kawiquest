"use client";

import { useEffect, useRef, type PointerEvent } from "react";

// The square writing canvas (design system: WritingCanvas). Strokes are point lists in 0–1 coordinates so they
// render at any size; ink width is 1/40 of the side so the drawing downscales cleanly to the 50 × 50 sample.

export type Stroke = [number, number][];
export type Device = "mouse" | "stylus" | "finger";

const INK_RATIO = 1 / 40;
const DEVICE: Record<string, Device> = { mouse: "mouse", pen: "stylus", touch: "finger" };

function draw(ctx: CanvasRenderingContext2D, size: number, strokes: Stroke[], color: string) {
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * INK_RATIO;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const s of strokes) {
    if (s.length === 1) {
      // A tap is a dot.
      ctx.beginPath();
      ctx.arc(s[0]![0] * size, s[0]![1] * size, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    s.forEach(([x, y], i) => (i ? ctx.lineTo(x * size, y * size) : ctx.moveTo(x * size, y * size)));
    ctx.stroke();
  }
}

export function WritingCanvas({
  strokes,
  onChange,
  onDevice,
  label,
}: {
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
  onDevice?: (device: Device) => void;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const strokesRef = useRef(strokes);

  // Size the backing store to the element (and device pixel ratio), and redraw on resize or change.
  useEffect(() => {
    strokesRef.current = strokes; // pointer handlers read the committed strokes from here
    const canvas = canvasRef.current!;
    const ink = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#2a1e16";
    const render = () => {
      const size = Math.round(canvas.clientWidth * window.devicePixelRatio);
      if (canvas.width !== size) canvas.width = canvas.height = size;
      draw(canvas.getContext("2d")!, size, live.current ? [...strokesRef.current, live.current] : strokesRef.current, ink);
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [strokes]);

  const point = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const redrawLive = (canvas: HTMLCanvasElement) => {
    const ink = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#2a1e16";
    draw(canvas.getContext("2d")!, canvas.width, [...strokesRef.current, live.current!], ink);
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId); // keep the stroke if the pointer leaves the square
        } catch {
          /* some pointer sources can't be captured; the stroke still works */
        }
        onDevice?.(DEVICE[e.pointerType] ?? "mouse");
        live.current = [point(e)];
        redrawLive(e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (!live.current) return;
        const p = point(e);
        const last = live.current[live.current.length - 1]!;
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return;
        live.current.push(p);
        redrawLive(e.currentTarget);
      }}
      onPointerUp={() => {
        if (!live.current) return;
        const stroke = live.current;
        live.current = null;
        onChange([...strokesRef.current, stroke]);
      }}
      onPointerCancel={() => {
        live.current = null;
        onChange([...strokesRef.current]);
      }}
    />
  );
}

/** Render strokes to the stored sample: 50 × 50 grayscale, dark ink on white, as raw bytes (row-major). */
export function rasterize(strokes: Stroke[], side = 50): Uint8Array {
  const big = document.createElement("canvas");
  big.width = big.height = side * 8;
  const bctx = big.getContext("2d")!;
  draw(bctx, big.width, strokes, "#000");
  // draw() leaves a transparent ground: paint white underneath the ink.
  bctx.globalCompositeOperation = "destination-over";
  bctx.fillStyle = "#fff";
  bctx.fillRect(0, 0, big.width, big.height);

  const small = document.createElement("canvas");
  small.width = small.height = side;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(big, 0, 0, side, side);
  const rgba = sctx.getImageData(0, 0, side, side).data;
  const gray = new Uint8Array(side * side);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!);
  return gray;
}

/** Usability feedback only — never about correctness (contributors are copying; validators judge later). */
export function usabilityCheck(strokes: Stroke[], nonCharacter: boolean): string | null {
  const pts = strokes.flat();
  if (!pts.length) return nonCharacter ? "Draw something first." : "Draw the character first.";
  if (nonCharacter) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  if (Math.max(w, h) < 0.3) return "Draw a bit larger — use most of the square.";
  if (Math.min(...xs) < 0.02 || Math.min(...ys) < 0.02 || Math.max(...xs) > 0.98 || Math.max(...ys) > 0.98) {
    return "Keep the whole character inside the square.";
  }
  return null;
}

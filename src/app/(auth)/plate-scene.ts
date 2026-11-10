import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// The sign-in plate: a floating copper plate with one engraved Kawi letter, after the Laguna Copperplate.
// The key light follows the pointer and rakes across the engraving, the way conservators read inscriptions.
// Loaded on the client only (dynamic import from CopperPlate.tsx) so three.js stays out of the server bundle.

export type PlateHandle = {
  /** Polish the current letter away and engrave this one. */
  engrave(form: string): void;
  dispose(): void;
};

type Options = { form: string; reducedMotion: boolean; onTap: () => void; onReady: () => void };

const PLATE_W = 3.2;
const PLATE_H = 2.0;
const DEPTH = 0.12;
const RADIUS = 0.06;
const TEX_W = 1024;
const TEX_H = Math.round((TEX_W * (PLATE_H - 2 * RADIUS)) / (PLATE_W - 2 * RADIUS));
const ENGRAVE_MS = 1100;
const POLISH_MS = 220;

// Seeded random so every load draws the same plate.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function canvas(w = TEX_W, h = TEX_H) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** The family next/font registered for Noto Sans Kawi (behind the --font-kawi token). */
function kawiFamily(host: HTMLElement) {
  const probe = document.createElement("span");
  probe.style.fontFamily = "var(--font-kawi)";
  host.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily || "serif";
  probe.remove();
  return family;
}

type Blob = { x: number; y: number; r: number; a: number };

/** Verdigris and tarnish gather at the edges and corners of old copper. */
function patinaBlobs(): Blob[] {
  const r = rng(11);
  const blobs: Blob[] = [];
  for (let i = 0; i < 46; i++) {
    const edge = Math.floor(r() * 4);
    const t = r();
    const inset = Math.pow(r(), 2) * 90;
    const x = edge === 0 ? t * TEX_W : edge === 1 ? TEX_W - inset : edge === 2 ? t * TEX_W : inset;
    const y = edge === 0 ? inset : edge === 1 ? t * TEX_H : edge === 2 ? TEX_H - inset : t * TEX_H;
    blobs.push({ x, y, r: 30 + r() * 90, a: 0.12 + r() * 0.3 });
  }
  return blobs;
}

/** Base layers drawn once: colour, height (bump) and roughness, without the letter. */
function baseLayers() {
  const r = rng(7);
  const blobs = patinaBlobs();
  const color = canvas();
  const bump = canvas();
  const rough = canvas();
  const c = color.getContext("2d")!;
  const b = bump.getContext("2d")!;
  const g = rough.getContext("2d")!;

  const grad = c.createLinearGradient(0, 0, TEX_W, TEX_H);
  grad.addColorStop(0, "#c27443");
  grad.addColorStop(0.55, "#b0602c");
  grad.addColorStop(1, "#8f4b22");
  c.fillStyle = grad;
  c.fillRect(0, 0, TEX_W, TEX_H);
  b.fillStyle = "rgb(150,150,150)";
  b.fillRect(0, 0, TEX_W, TEX_H);
  g.fillStyle = "rgb(105,105,105)";
  g.fillRect(0, 0, TEX_W, TEX_H);

  // Hammered, hand-worked surface: soft dents in the height map, slightly varied tone.
  for (let i = 0; i < 170; i++) {
    const x = r() * TEX_W;
    const y = r() * TEX_H;
    const rad = 24 + r() * 56;
    const dent = b.createRadialGradient(x, y, 0, x, y, rad);
    dent.addColorStop(0, `rgba(0,0,0,${0.025 + r() * 0.03})`);
    dent.addColorStop(1, "rgba(0,0,0,0)");
    b.fillStyle = dent;
    b.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    const tone = c.createRadialGradient(x, y, 0, x, y, rad);
    tone.addColorStop(0, r() > 0.5 ? "rgba(255,214,170,0.06)" : "rgba(90,40,12,0.06)");
    tone.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = tone;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Fine brushing across the plate.
  for (let i = 0; i < 900; i++) {
    const y = r() * TEX_H;
    const x = r() * TEX_W;
    const len = 40 + r() * 220;
    c.strokeStyle = r() > 0.5 ? "rgba(255,226,190,0.05)" : "rgba(70,30,8,0.05)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y + (r() - 0.5) * 3);
    c.stroke();
    g.strokeStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.06)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y);
    g.stroke();
  }
  // Patina: green-blue on the colour, rough and slightly raised.
  for (const p of blobs) {
    const green = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    green.addColorStop(0, `rgba(86,150,132,${p.a})`);
    green.addColorStop(0.6, `rgba(70,120,104,${p.a * 0.45})`);
    green.addColorStop(1, "rgba(70,120,104,0)");
    c.fillStyle = green;
    c.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    const ro = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    ro.addColorStop(0, `rgba(255,255,255,${p.a * 1.6})`);
    ro.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = ro;
    g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }

  // An engraved border, as on the plate's ruled edge.
  const inset = 46;
  c.strokeStyle = "rgba(58,26,8,0.55)";
  c.lineWidth = 5;
  c.strokeRect(inset, inset, TEX_W - inset * 2, TEX_H - inset * 2);
  b.save();
  b.shadowColor = "black";
  b.shadowBlur = 5;
  b.strokeStyle = "rgb(40,40,40)";
  b.lineWidth = 5;
  b.strokeRect(inset, inset, TEX_W - inset * 2, TEX_H - inset * 2);
  b.restore();
  g.strokeStyle = "rgb(200,200,200)";
  g.lineWidth = 6;
  g.strokeRect(inset, inset, TEX_W - inset * 2, TEX_H - inset * 2);

  return { color, bump, rough };
}

type Ink = { x: number; y: number; left: number; width: number; size: number };

/** Font size and position that centre the letter's ink inside the border. */
function placeLetter(ctx: CanvasRenderingContext2D, family: string, form: string): Ink {
  let size = 420;
  ctx.font = `400 ${size}px ${family}`;
  let m = ctx.measureText(form);
  const inkW = () => m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
  const inkH = () => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const scale = Math.min((TEX_W * 0.46) / Math.max(1, inkW()), (TEX_H * 0.62) / Math.max(1, inkH()));
  size = Math.round(size * scale);
  ctx.font = `400 ${size}px ${family}`;
  m = ctx.measureText(form);
  const x = TEX_W / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const y = TEX_H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  return { x, y, left: x - m.actualBoundingBoxLeft, width: inkW(), size };
}

export async function mountPlate(host: HTMLElement, opts: Options): Promise<PlateHandle | null> {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null; // no WebGL: the static copper tile stays
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const family = kawiFamily(host);
  try {
    await Promise.race([document.fonts.load(`400 300px ${family}`, opts.form), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    // draw with whatever font is available
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  scene.environment = env;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  // ---- textures ----
  const base = baseLayers();
  const colorC = canvas();
  const bumpC = canvas();
  const roughC = canvas();
  const glowC = canvas();
  const cc = colorC.getContext("2d")!;
  const bc = bumpC.getContext("2d")!;
  const rc = roughC.getContext("2d")!;
  const gc = glowC.getContext("2d")!;
  const colorT = new THREE.CanvasTexture(colorC);
  colorT.colorSpace = THREE.SRGBColorSpace;
  const bumpT = new THREE.CanvasTexture(bumpC);
  const roughT = new THREE.CanvasTexture(roughC);
  const glowT = new THREE.CanvasTexture(glowC);
  glowT.colorSpace = THREE.SRGBColorSpace;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  for (const t of [colorT, bumpT, roughT, glowT]) t.anisotropy = Math.min(8, aniso);

  type Layers = { ink: Ink; color: HTMLCanvasElement; bump: HTMLCanvasElement; rough: HTMLCanvasElement; glow: HTMLCanvasElement };
  const layerCache = new Map<string, Layers>();

  /** One letter as a cut groove: colour (floor, shadowed upper wall, lit lower lip), height, roughness, glow. */
  function letterLayers(form: string): Layers {
    const hit = layerCache.get(form);
    if (hit) return hit;
    const color = canvas();
    const c = color.getContext("2d")!;
    const ink = placeLetter(c, family, form);
    const font = `400 ${ink.size}px ${family}`;
    const glyph = (ctx: CanvasRenderingContext2D, style: string, dx = 0, dy = 0, blur = 0) => {
      ctx.font = font;
      ctx.fillStyle = style;
      ctx.shadowColor = blur ? style : "transparent";
      ctx.shadowBlur = blur;
      ctx.fillText(form, ink.x + dx, ink.y + dy);
    };
    /** A band along the inside of the groove: the glyph minus itself shifted by (dx, dy). */
    const band = (style: string, dx: number, dy: number) => {
      const m = canvas();
      const mc = m.getContext("2d")!;
      mc.fillStyle = style;
      mc.fillRect(0, 0, TEX_W, TEX_H);
      mc.globalCompositeOperation = "destination-out";
      glyph(mc, "black", dx, dy, 7);
      return m;
    };

    // The cut edge catches light on the plate surface just below and right of the groove.
    glyph(c, "rgba(255,212,168,0.45)", 3, 3, 2);
    const groove = canvas();
    const g = groove.getContext("2d")!;
    glyph(g, "#6a3114");
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = 0.85;
    g.drawImage(band("#240e04", 9, 9), 0, 0); // the upper wall's shadow
    g.globalAlpha = 0.5;
    g.drawImage(band("#d98b55", -5, -5), 0, 0); // the lower wall, lit
    c.drawImage(groove, 0, 0);

    const bump = canvas();
    const b = bump.getContext("2d")!;
    glyph(b, "rgb(0,0,0)", 0, 0, 12);
    glyph(b, "rgb(20,20,20)");

    const rough = canvas();
    glyph(rough.getContext("2d")!, "rgb(210,210,210)");

    const glow = canvas();
    glyph(glow.getContext("2d")!, "rgb(255,160,80)");

    const layers = { ink, color, bump, rough, glow };
    layerCache.set(form, layers);
    return layers;
  }

  /** Redraw the face: `reveal` 0–1 cuts the letter left to right, `alpha` fades it out; the fresh cut glows. */
  function paint(form: string | null, reveal: number, alpha: number) {
    cc.drawImage(base.color, 0, 0);
    bc.drawImage(base.bump, 0, 0);
    rc.drawImage(base.rough, 0, 0);
    gc.clearRect(0, 0, TEX_W, TEX_H);
    if (form && alpha > 0 && reveal > 0) {
      const L = letterLayers(form);
      const front = L.ink.left + L.ink.width * reveal;
      for (const [ctx, layer] of [[cc, L.color], [bc, L.bump], [rc, L.rough]] as const) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, front + 2, TEX_H);
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
      if (reveal < 1) {
        gc.save();
        gc.beginPath();
        gc.rect(front - 120, 0, 122, TEX_H);
        gc.clip();
        gc.drawImage(L.glow, 0, 0);
        gc.globalCompositeOperation = "destination-in";
        const fade = gc.createLinearGradient(front - 120, 0, front + 2, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)");
        fade.addColorStop(1, "rgba(0,0,0,1)");
        gc.fillStyle = fade;
        gc.fillRect(front - 120, 0, 122, TEX_H);
        gc.restore();
      }
    }
    colorT.needsUpdate = bumpT.needsUpdate = roughT.needsUpdate = glowT.needsUpdate = true;
  }

  // ---- the plate ----
  const plate = new THREE.Group();
  const bodyGeo = new RoundedBoxGeometry(PLATE_W, PLATE_H, DEPTH, 5, RADIUS);
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#9e5428", metalness: 1, roughness: 0.4 });
  plate.add(new THREE.Mesh(bodyGeo, bodyMat));

  const faceGeo = new THREE.PlaneGeometry(PLATE_W - 2 * RADIUS, PLATE_H - 2 * RADIUS);
  const faceMat = new THREE.MeshStandardMaterial({
    map: colorT,
    bumpMap: bumpT,
    bumpScale: 9,
    roughnessMap: roughT,
    roughness: 1,
    metalness: 0.92,
    emissive: new THREE.Color("#ff8a3c"),
    emissiveMap: glowT,
    emissiveIntensity: 2.4,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.z = DEPTH / 2 + 0.0015;
  plate.add(face);

  // Rivets in the four corners.
  const rivetGeo = new THREE.SphereGeometry(0.055, 24, 12);
  const rivetMat = new THREE.MeshStandardMaterial({ color: "#b8774a", metalness: 1, roughness: 0.3 });
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const rivet = new THREE.Mesh(rivetGeo, rivetMat);
    rivet.scale.z = 0.45;
    rivet.position.set(sx * (PLATE_W / 2 - 0.12), sy * (PLATE_H / 2 - 0.12), DEPTH / 2 + 0.004);
    plate.add(rivet);
  }
  scene.add(plate);

  // A soft shadow on the panel behind, so the plate floats.
  const shadowC = canvas(256, 256);
  const sctx = shadowC.getContext("2d")!;
  const sg = sctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  sg.addColorStop(0, "rgba(0,10,12,0.55)");
  sg.addColorStop(1, "rgba(0,10,12,0)");
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 256, 256);
  const shadowT = new THREE.CanvasTexture(shadowC);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(PLATE_W * 1.5, PLATE_H * 1.6);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.set(0.12, -0.18, -0.7);
  scene.add(shadow);

  // ---- lights ----
  const key = new THREE.DirectionalLight("#ffd9b3", 2.4);
  const rim = new THREE.DirectionalLight("#86d6c8", 1.1);
  rim.position.set(-3, 2, -2);
  scene.add(key, rim, new THREE.HemisphereLight("#ffe9d6", "#0e2a2e", 0.35));

  // ---- size ----
  function fit() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(PLATE_H / 2 / t, PLATE_W / 2 / (t * camera.aspect)) * 1.28;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  const resize = new ResizeObserver(fit);
  resize.observe(host);
  fit();

  // ---- pointer: tilt the plate, rake the light ----
  const target = { x: 0.55, y: -0.35 };
  const now = { x: 0.55, y: -0.35 };
  let lastPointer = -Infinity;
  let down: { x: number; y: number } | null = null;
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    target.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    target.y = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    lastPointer = performance.now();
  };
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) opts.onTap();
    down = null;
  };
  // The whole panel steers the light, not just the canvas.
  const panel = host.closest<HTMLElement>(".kq-auth__plate") ?? host;
  panel.addEventListener("pointermove", onMove);
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointerup", onUp);

  // ---- engraving ----
  let current: string | null = opts.form;
  let anim: { from: string | null; to: string; start: number } | null = null;
  paint(current, 1, 1);
  if (!opts.reducedMotion) anim = { from: null, to: opts.form, start: performance.now() + 250 };

  function engrave(form: string) {
    if (opts.reducedMotion) {
      current = form;
      paint(form, 1, 1);
      return;
    }
    anim = { from: current, to: form, start: performance.now() };
    current = form;
  }

  // ---- loop, paused when hidden ----
  let visible = true;
  let raf = 0;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(host);
  const onVisibility = () => {
    if (!document.hidden && visible && !raf) raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", onVisibility);

  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  let readySent = false;

  function frame(ts: number) {
    raf = 0;
    if (document.hidden || !visible) return;
    const t = ts / 1000;

    // Idle: the light drifts on its own; after any pointer movement it follows the pointer for a while.
    if (!opts.reducedMotion && ts - lastPointer > 4000) {
      target.x = Math.sin(t * 0.35) * 0.7;
      target.y = Math.cos(t * 0.27) * 0.45 - 0.1;
    }
    const k = opts.reducedMotion ? 1 : 0.06;
    now.x += (target.x - now.x) * k;
    now.y += (target.y - now.y) * k;

    plate.rotation.y = now.x * 0.34;
    plate.rotation.x = now.y * 0.24;
    plate.position.y = opts.reducedMotion ? 0 : Math.sin(t * 0.9) * 0.035;
    shadow.position.x = 0.12 - now.x * 0.18;
    shadow.position.y = -0.18 + now.y * 0.12;
    // Low, raking key light from the pointer's side.
    key.position.set(now.x * 4.2, -now.y * 3.2 + 0.4, 1.5);

    if (anim) {
      const e = ts - anim.start;
      if (e < 0) {
        paint(null, 0, 0);
      } else if (anim.from && e < POLISH_MS) {
        paint(anim.from, 1, 1 - e / POLISH_MS);
      } else {
        const p = Math.min(1, (e - (anim.from ? POLISH_MS : 0)) / ENGRAVE_MS);
        paint(anim.to, ease(p), 1);
        if (p >= 1) anim = null;
      }
    }

    renderer.render(scene, camera);
    if (!readySent) {
      readySent = true;
      opts.onReady();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    engrave,
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      panel.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      for (const g of [bodyGeo, faceGeo, rivetGeo, shadowGeo]) g.dispose();
      for (const m of [bodyMat, faceMat, rivetMat, shadowMat]) m.dispose();
      for (const t of [colorT, bumpT, roughT, glowT, shadowT]) t.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

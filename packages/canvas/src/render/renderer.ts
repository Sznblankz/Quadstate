import { HI, LO, X, Z } from "@logicsim/engine";
import type { CircuitDocument, EntityId, InkStroke, Selection } from "@logicsim/document";
import type { PartLibrary } from "@logicsim/schema";
import { MIXED, aggregateBus } from "../bus.js";
import { ICONIC_GATES, componentGeom, isIo, layoutInterface, wireJunctions, wireSegments } from "../symbols.js";
import type { SpatialGrid } from "../grid.js";
import type { Viewport } from "../transform.js";
import type { OverlayState } from "../tools/types.js";
import { THEMES, type ThemeName, type Tokens } from "../tokens.js";

/**
 * Layered Canvas2D renderer (plan: 4 stacked canvases redrawn
 * independently). All functions are stateless draws over RenderState;
 * the app shell owns dirty-flagging per layer.
 */
export interface RenderState {
  doc: CircuitDocument;
  lib: PartLibrary;
  selection: Selection;
  viewport: Viewport;
  grid: SpatialGrid;
  overlay: OverlayState;
  /** Latest engine snapshot (net values), or null before first compile. */
  netValues: Uint8Array | null;
  /** doc wire id -> engine net index (bit 0). */
  wireNets: Map<EntityId, number>;
  /** doc wire id -> full bus (engine net indices, LSB first) for width-aware
   *  rendering. Optional; falls back to wireNets (1-bit) when absent. */
  wireBus?: Map<EntityId, number[]>;
  /** io component id -> engine net index (bit 0). */
  ioNets: Map<EntityId, number>;
  /** CSS pixel size of the canvas area. */
  width: number;
  height: number;
  /** Device pixel ratio; render functions own the full transform. */
  dpr: number;
  /** Draw the background grid dots (Settings → Canvas). Defaults to on. */
  showGrid?: boolean;
}

// COLORS is a thin alias over the ACTIVE palette so call sites stay unchanged.
// It's a `let` rebuilt by setActiveTheme(); the render fns read COLORS.* at call
// time, so a theme swap is visible on the next frame with no call-site edits.
function buildColors(t: Tokens) {
  return {
    background: t.bg,
    gridDot: t.gridDot,
    body: t.partFill,
    bodyEdge: t.partEdge,
    partStroke: t.partStroke,
    label: t.label,
    port: t.pin,
    wire: t.wireNeutral,
    selection: t.accent,
    marqueeFill: t.accentQuiet,
    signal: {
      [LO]: t.sig0,
      [HI]: t.sig1,
      [X]: t.sigX,
      [Z]: t.sigZ,
    } as Record<number, string>,
  };
}

let COLORS = buildColors(THEMES.light);

/** Swap the renderer's active palette. The app marks the canvas dirty so the
 *  permanent rAF loop repaints with the new colors next frame. */
export function setActiveTheme(name: ThemeName): void {
  COLORS = buildColors(THEMES[name]);
}

export function signalColor(v: number): string {
  return COLORS.signal[v] ?? COLORS.signal[Z];
}

function applyView(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const k = s.viewport.zoom * s.dpr;
  ctx.setTransform(k, 0, 0, k, -s.viewport.x * k, -s.viewport.y * k);
}

function applyScreen(ctx: CanvasRenderingContext2D, s: RenderState): void {
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
}

function visibleIds(s: RenderState): number[] {
  const r = s.viewport.visibleRect(s.width, s.height);
  return s.grid.query(r.x0, r.y0, r.x1, r.y1);
}

export function renderSchematic(ctx: CanvasRenderingContext2D, s: RenderState): void {
  applyScreen(ctx, s);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, s.width, s.height);

  applyView(ctx, s);
  if (s.showGrid !== false) drawGridDots(ctx, s);

  const ids = visibleIds(s);

  // Wires under components.
  ctx.lineWidth = 2 / s.viewport.zoom + 1;
  ctx.lineCap = "round";
  for (const id of ids) {
    if (!s.doc.wires.has(id)) continue;
    ctx.strokeStyle = s.selection.has(id) ? COLORS.selection : COLORS.wire;
    for (const seg of wireSegments(s.doc, s.lib, id)) {
      ctx.beginPath();
      ctx.moveTo(seg.x0, seg.y0);
      ctx.lineTo(seg.x1, seg.y1);
      ctx.stroke();
    }
  }

  for (const id of ids) {
    const comp = s.doc.components.get(id);
    if (comp) drawComponent(ctx, s, comp.id);
  }

  // Junction dots — same node language as component pins (COLORS.port), drawn
  // where a net branches so an intentional connection reads differently from a
  // mere crossing (crossings share no pin, so they get no dot).
  ctx.fillStyle = COLORS.port;
  for (const j of wireJunctions(s.doc, s.lib)) {
    ctx.beginPath();
    ctx.arc(j.x, j.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGridDots(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const r = s.viewport.visibleRect(s.width, s.height);
  const step = 50;
  if ((r.x1 - r.x0) / step > 200) return; // too zoomed out for dots
  ctx.fillStyle = COLORS.gridDot;
  const x0 = Math.floor(r.x0 / step) * step;
  const y0 = Math.floor(r.y0 / step) * step;
  const radius = 1 / s.viewport.zoom + 0.4;
  for (let x = x0; x <= r.x1; x += step) {
    for (let y = y0; y <= r.y1; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function shortLabel(part: string, lib: PartLibrary): string {
  if (part.startsWith("builtin:")) return part.slice(8).toUpperCase();
  if (part === "io:in") return "IN";
  if (part === "io:out") return "OUT";
  return lib.get(part)?.name ?? "?";
}

function drawComponent(ctx: CanvasRenderingContext2D, s: RenderState, id: EntityId): void {
  const comp = s.doc.components.get(id)!;
  const ghost = s.overlay.dragGhost;
  const offset = ghost && ghost.ids.includes(id) ? ghost : { dx: 0, dy: 0 };
  const geom = componentGeom(comp, layoutInterface(comp.part, s.lib));
  const selected = s.selection.has(id);

  // Gates draw as silhouettes; IO and chips/unknowns keep the labelled box.
  if (ICONIC_GATES.has(comp.part)) {
    drawGate(ctx, comp.part, geom, offset, selected);
    return;
  }

  const x = geom.x + offset.dx;
  const y = geom.y + offset.dy;
  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = selected ? COLORS.selection : COLORS.bodyEdge;
  ctx.lineWidth = selected ? 2.2 : 1.5;
  ctx.setLineDash([]);
  roundRect(ctx, x, y, geom.w, geom.h, 6);
  ctx.fill();
  ctx.stroke();

  for (const port of geom.ports) {
    ctx.fillStyle = COLORS.port;
    ctx.beginPath();
    ctx.arc(port.x + offset.dx, port.y + offset.dy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isIo(comp.part)) {
    // IO: a single centred name (the pin's user name).
    ctx.fillStyle = COLORS.label;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const nm = typeof comp.props.name === "string" ? comp.props.name : shortLabel(comp.part, s.lib);
    ctx.fillText(nm, x + geom.w / 2, y + geom.h / 2, geom.w - 6);
  } else {
    // Composite/builtin box: part name on top, pin names beside each port.
    ctx.fillStyle = COLORS.label;
    ctx.font = "8px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (const port of geom.ports) {
      const py = port.y + offset.dy;
      if (port.dir === "in") { ctx.textAlign = "left"; ctx.fillText(port.pin, x + 7, py, geom.w / 2 - 8); }
      else { ctx.textAlign = "right"; ctx.fillText(port.pin, x + geom.w - 7, py, geom.w / 2 - 8); }
    }
    ctx.fillStyle = COLORS.label;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(shortLabel(comp.part, s.lib), x + geom.w / 2, y + 5, geom.w - 10);
  }
}

/**
 * Approved primitive gate silhouettes (one house stroke, no text label —
 * the shape is the label). Pin stubs connect the body to the geom ports so
 * every gate reads as wired regardless of its outline.
 */
function drawGate(
  ctx: CanvasRenderingContext2D,
  part: string,
  geom: ReturnType<typeof componentGeom>,
  offset: { dx: number; dy: number },
  selected: boolean,
): void {
  const ox = offset.dx, oy = offset.dy;
  const x = geom.x + ox, y = geom.y + oy, w = geom.w, h = geom.h;
  const stub = 7;
  const br = 3.2; // inverting output bubble
  const inverting = part === "builtin:nand" || part === "builtin:nor" || part === "builtin:not";
  const bx = x + stub;
  const by = y;
  const bh = h;
  const bw = (w - 2 * stub) - (inverting ? 2 * br : 0);
  const fx = (px: number) => bx + (px / 20) * bw;
  const fy = (py: number) => by + (py / 16) * bh;

  // Pin stubs. They run from the port PAST the body's flat baseline and into
  // the silhouette; the body fill (drawn next) is opaque and clips them to the
  // exact outline. This guarantees every pin meets the symbol cleanly — even
  // the concave back of OR/XOR — with no floating gap.
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.port;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (const p of geom.ports) {
    const py = p.y + oy;
    ctx.beginPath();
    if (p.dir === "in") { ctx.moveTo(x, py); ctx.lineTo(bx + bw * 0.4, py); }
    else { ctx.moveTo(bx + bw * 0.6, py); ctx.lineTo(x + w, py); }
    ctx.stroke();
  }

  // Body silhouette.
  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = selected ? COLORS.selection : COLORS.partStroke;
  ctx.lineWidth = selected ? 2.2 : 1.7;
  ctx.beginPath();
  if (part === "builtin:and" || part === "builtin:nand") {
    const r = bh / 2;
    const flatW = Math.max(0, bw - r);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + flatW, by);
    ctx.arc(bx + flatW, by + bh / 2, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(bx, by + bh);
    ctx.closePath();
  } else if (part === "builtin:not" || part === "builtin:buf") {
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bw, by + bh / 2);
    ctx.lineTo(bx, by + bh);
    ctx.closePath();
  } else {
    // OR / NOR / XOR / XNOR shield.
    ctx.moveTo(fx(2), fy(2));
    ctx.bezierCurveTo(fx(5), fy(6), fx(5), fy(10), fx(2), fy(14));
    ctx.bezierCurveTo(fx(9), fy(13), fx(16), fy(11), fx(20), fy(8));
    ctx.bezierCurveTo(fx(16), fy(5), fx(9), fy(3), fx(2), fy(2));
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // XOR/XNOR back arc.
  if (part === "builtin:xor" || part === "builtin:xnor") {
    const o = -4;
    ctx.beginPath();
    ctx.moveTo(fx(2) + o, fy(2));
    ctx.bezierCurveTo(fx(5) + o, fy(6), fx(5) + o, fy(10), fx(2) + o, fy(14));
    ctx.stroke();
  }

  // Inverting output bubble.
  if (inverting) {
    ctx.beginPath();
    ctx.fillStyle = COLORS.body;
    ctx.arc(bx + bw + br, by + bh / 2, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Port nodes on top.
  for (const p of geom.ports) {
    ctx.fillStyle = COLORS.port;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Signal layer: wires + io bodies tinted by live net values. */
export function renderSignals(ctx: CanvasRenderingContext2D, s: RenderState): void {
  applyScreen(ctx, s);
  ctx.clearRect(0, 0, s.width, s.height);
  if (!s.netValues) return;
  applyView(ctx, s);

  // Approved 4-state signal language (VISUAL_SYSTEM_SUMMARY §2):
  //   1 = green solid + halo · 0 = blue flat · X = amber dash-dot · Z = gray dash.
  // Pattern + glow carry state (never colour alone); thickness stays 1-bit
  // base here — the bus-width channel is reserved but unused in P0.
  const ids = visibleIds(s);
  const z = s.viewport.zoom;
  const base = 2.5 / z + 1;
  const halo = base + 5 / z;
  // Thickness is the reserved BUS-WIDTH channel: 1-bit base, 2..8 bit +60%,
  // 9..64 bit +120% (state and width are orthogonal).
  const tierMul = (w: number) => (w <= 1 ? 1 : w <= 8 ? 1.6 : 2.2);
  const tags: Array<{ x: number; y: number; w: number }> = [];
  ctx.lineCap = "round";
  for (const id of ids) {
    if (!s.doc.wires.has(id)) continue;
    const bus = s.wireBus?.get(id);
    const net = s.wireNets.get(id);
    const nets = bus ?? (net === undefined ? null : [net]);
    if (nets === null) continue;
    const v = nets.length === 1 ? s.netValues[nets[0]] : aggregateBus(nets.map((n) => s.netValues![n]));
    const width = nets.length;
    const t = base * tierMul(width);
    const segs = wireSegments(s.doc, s.lib, id);
    if (width > 1 && segs.length > 0) {
      const m = segs[0];
      tags.push({ x: (m.x0 + m.x1) / 2, y: (m.y0 + m.y1) / 2, w: width });
    }
    const draw = (lw: number) => {
      ctx.lineWidth = lw;
      for (const seg of segs) {
        ctx.beginPath();
        ctx.moveTo(seg.x0, seg.y0);
        ctx.lineTo(seg.x1, seg.y1);
        ctx.stroke();
      }
    };
    if (v === HI) {
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.signal[HI];
      ctx.globalAlpha = 0.28; draw(t + (halo - base)); // soft halo (only glowing state)
      ctx.globalAlpha = 1; draw(t);
    } else if (v === MIXED) {
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.signal[HI];
      ctx.globalAlpha = 0.9; draw(t);       // defined multi-bit value: calm solid, no glow
    } else if (v === LO) {
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.signal[LO];
      ctx.globalAlpha = 0.9; draw(t);       // flat, slightly recessed
    } else if (v === X) {
      ctx.setLineDash([9 / z, 4 / z, 2 / z, 4 / z]); // dash-dot — looks wrong
      ctx.strokeStyle = COLORS.signal[X];
      ctx.globalAlpha = 1; draw(t);
    } else {
      ctx.setLineDash([6 / z, 5 / z]);      // Z (or unknown) — even dash, hollow
      ctx.strokeStyle = COLORS.signal[Z];
      ctx.globalAlpha = 0.7; draw(t);
    }
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  // Width tags for buses (mono digits, on top of the wires).
  if (tags.length > 0) {
    ctx.font = `${11 / z}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3 / z;
    ctx.strokeStyle = COLORS.background;
    ctx.fillStyle = COLORS.label;
    for (const tag of tags) {
      ctx.strokeText(String(tag.w), tag.x, tag.y - 7 / z);
      ctx.fillText(String(tag.w), tag.x, tag.y - 7 / z);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // IO indicators: switches show their driven value, LEDs glow with the net.
  for (const id of ids) {
    const comp = s.doc.components.get(id);
    if (!comp || !isIo(comp.part)) continue;
    const geom = componentGeom(comp, layoutInterface(comp.part, s.lib));
    const ghost = s.overlay.dragGhost;
    const off = ghost && ghost.ids.includes(id) ? ghost : { dx: 0, dy: 0 };
    const net = s.ioNets.get(id);
    const pv = typeof comp.props.value === "number" ? comp.props.value : 0;
    const v = comp.part === "io:in"
      ? pv // engine code 0/1/2/3 — show the poked state on the switch body
      : net !== undefined ? s.netValues[net] : Z;
    ctx.fillStyle = signalColor(v);
    ctx.beginPath();
    ctx.arc(geom.x + off.dx + geom.w / 2, geom.y + off.dy + geom.h / 2 + 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderInk(ctx: CanvasRenderingContext2D, s: RenderState): void {
  applyScreen(ctx, s);
  ctx.clearRect(0, 0, s.width, s.height);
  applyView(ctx, s);
  for (const stroke of s.doc.strokes.values()) {
    drawStroke(ctx, stroke, s.selection.has(stroke.id));
  }
  if (s.overlay.inkPreview && s.overlay.inkPreview.length > 1) {
    drawStroke(ctx, {
      id: -1, points: s.overlay.inkPreview, baseWidth: 2.5, color: "#f59e0b",
    }, false);
  }
}

/** Pressure-driven variable-width polyline as filled segment quads. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke, selected: boolean): void {
  const pts = stroke.points;
  if (pts.length < 2) return;
  ctx.strokeStyle = selected ? COLORS.selection : stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = stroke.baseWidth * (0.4 + 1.6 * ((pts[i - 1].p + pts[i].p) / 2));
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
}

export function renderOverlay(ctx: CanvasRenderingContext2D, s: RenderState): void {
  applyScreen(ctx, s);
  ctx.clearRect(0, 0, s.width, s.height);
  applyView(ctx, s);

  const net = s.overlay.netGhost;
  if (net) {
    ctx.strokeStyle = COLORS.selection;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 6 / s.viewport.zoom + 2;
    ctx.lineCap = "round";
    for (const id of net) {
      for (const seg of wireSegments(s.doc, s.lib, id)) {
        ctx.beginPath();
        ctx.moveTo(seg.x0, seg.y0);
        ctx.lineTo(seg.x1, seg.y1);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  const m = s.overlay.marquee;
  if (m) {
    ctx.fillStyle = COLORS.marqueeFill;
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 1 / s.viewport.zoom;
    ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
    ctx.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
  }
  const w = s.overlay.wirePreview;
  if (w) {
    ctx.strokeStyle = w.valid ? COLORS.signal[HI] : COLORS.wire;
    ctx.lineWidth = 2 / s.viewport.zoom + 0.5;
    ctx.setLineDash(w.valid ? [] : [5, 4]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    // Orthogonal Z preview (mid-gap dogleg) so it matches how the committed
    // wire routes; collapses to a straight line when the ends are aligned.
    const mx = Math.round((w.x0 + w.x1) / 2);
    ctx.moveTo(w.x0, w.y0);
    ctx.lineTo(mx, w.y0);
    ctx.lineTo(mx, w.y1);
    ctx.lineTo(w.x1, w.y1);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const path = s.overlay.wirePath;
  if (path && path.points.length > 1) {
    ctx.strokeStyle = path.valid ? COLORS.signal[HI] : COLORS.wire;
    ctx.lineWidth = 2 / s.viewport.zoom + 0.5;
    ctx.setLineDash(path.valid ? [] : [5, 4]);
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const ghost = s.overlay.stampGhost;
  if (ghost) {
    const fake = { id: -1, part: ghost.part, x: ghost.x, y: ghost.y, rot: 0 as const, props: {} };
    try {
      const geom = componentGeom(fake, layoutInterface(ghost.part, s.lib));
      ctx.globalAlpha = 0.5;
      // The ghost must read as the SHAPE it will drop as: iconic gates draw as
      // their silhouette, everything else as the labelled box. (Footprint and
      // origin already match the placement via stampOrigin.)
      if (ICONIC_GATES.has(ghost.part)) {
        drawGate(ctx, ghost.part, geom, { dx: 0, dy: 0 }, false);
      } else {
        ctx.fillStyle = COLORS.body;
        ctx.strokeStyle = COLORS.selection;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        roundRect(ctx, geom.x, geom.y, geom.w, geom.h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        for (const port of geom.ports) {
          ctx.fillStyle = COLORS.port;
          ctx.beginPath();
          ctx.arc(port.x, port.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } catch {
      ctx.globalAlpha = 1; // unknown part id: no ghost
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Creates and sizes the four stacked canvases inside a container. */
export class CanvasStack {
  readonly schematic: HTMLCanvasElement;
  readonly signals: HTMLCanvasElement;
  readonly ink: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
  readonly layers: HTMLCanvasElement[];

  constructor(container: HTMLElement) {
    this.layers = [0, 1, 2, 3].map(() => {
      const c = document.createElement("canvas");
      c.style.position = "absolute";
      c.style.inset = "0";
      container.appendChild(c);
      return c;
    });
    [this.schematic, this.signals, this.ink, this.overlay] = this.layers;
  }

  resize(width: number, height: number, dpr: number): void {
    for (const c of this.layers) {
      c.width = Math.max(1, Math.round(width * dpr));
      c.height = Math.max(1, Math.round(height * dpr));
      c.style.width = width + "px";
      c.style.height = height + "px";
    }
  }
}

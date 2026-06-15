import type { CircuitDocument, Component, EntityId } from "@logicsim/document";
import type { PartLibrary, ResolvedInterface } from "@logicsim/schema";
import type { SpatialGrid } from "./grid.js";

/** World-unit grid for snapping component positions. */
export const SNAP = 10;

export interface PortGeom {
  pin: string;
  dir: "in" | "out";
  x: number;
  y: number;
}

export interface ComponentGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  ports: PortGeom[];
}

export const IO_PARTS = new Set(["io:in", "io:out"]);

export function isIo(part: string): boolean {
  return IO_PARTS.has(part);
}

/** Builtins drawn as iconic silhouettes (kept narrow); everything else that
 *  renders as a labelled box gets a wider body to fit a name + pin labels. */
export const ICONIC_GATES = new Set([
  "builtin:and", "builtin:nand", "builtin:or", "builtin:nor",
  "builtin:xor", "builtin:xnor", "builtin:not", "builtin:buf",
]);

/** Interface for layout purposes; io pseudo-parts get a single "pin" port. */
export function layoutInterface(part: string, lib: PartLibrary): ResolvedInterface {
  if (part === "io:in") return { pins: [{ name: "pin", dir: "out", width: 1 }] };
  if (part === "io:out") return { pins: [{ name: "pin", dir: "in", width: 1 }] };
  const iface = lib.resolveInterface(part);
  if (!iface) throw new Error(`unknown part "${part}"`);
  return iface;
}

/**
 * Deterministic symbol layout: in-pins down the left edge, out-pins down
 * the right, evenly spaced. (comp.x, comp.y) is the box's top-left.
 * Rotation is deferred to M4 — rot is carried in the document already.
 */
export function componentGeom(comp: Component, iface: ResolvedInterface): ComponentGeom {
  if (isIo(comp.part)) {
    const w = 30, h = 30;
    return {
      x: comp.x, y: comp.y, w, h,
      ports: [{
        pin: "pin",
        dir: comp.part === "io:in" ? "out" : "in",
        x: comp.part === "io:in" ? comp.x + w : comp.x,
        y: comp.y + h / 2,
      }],
    };
  }
  const ins = iface.pins.filter((p) => p.dir === "in");
  const outs = iface.pins.filter((p) => p.dir === "out");
  // Iconic gates stay 60 wide; labelled-box parts are wider for name + pins.
  const w = ICONIC_GATES.has(comp.part) ? 60 : 84;
  const h = Math.max(40, 20 * Math.max(ins.length, outs.length));
  const ports: PortGeom[] = [];
  ins.forEach((p, i) => ports.push({
    pin: p.name, dir: "in",
    x: comp.x,
    y: comp.y + (h * (i + 1)) / (ins.length + 1),
  }));
  outs.forEach((p, i) => ports.push({
    pin: p.name, dir: "out",
    x: comp.x + w,
    y: comp.y + (h * (i + 1)) / (outs.length + 1),
  }));
  return { x: comp.x, y: comp.y, w, h, ports };
}

/**
 * Snapped top-left for stamping `part` so its real footprint is centred under
 * a cursor world point. Shared by the placement tool and the drag/stamp ghost
 * so the preview lands exactly where the part drops, for any part size (a 30×30
 * IO pin, a 60×40 gate, and a tall multi-pin chip all centre on the cursor).
 */
export function stampOrigin(
  part: string,
  lib: PartLibrary,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const probe: Component = { id: -1, part, x: 0, y: 0, rot: 0, props: {} };
  const geom = componentGeom(probe, layoutInterface(part, lib));
  return {
    x: Math.round((wx - geom.w / 2) / SNAP) * SNAP,
    y: Math.round((wy - geom.h / 2) / SNAP) * SNAP,
  };
}

export type HitResult =
  | { type: "port"; component: EntityId; pin: string; x: number; y: number; dir: "in" | "out" }
  | { type: "component"; id: EntityId }
  | { type: "wire"; id: EntityId }
  | null;

const PORT_RADIUS = 7;
const WIRE_RADIUS = 5;

/** Port position lookup used by wires and hit-testing. */
export function portPosition(
  doc: CircuitDocument,
  lib: PartLibrary,
  componentId: EntityId,
  pin: string,
): { x: number; y: number } | null {
  const comp = doc.components.get(componentId);
  if (!comp) return null;
  const geom = componentGeom(comp, layoutInterface(comp.part, lib));
  const port = geom.ports.find((p) => p.pin === pin);
  return port ? { x: port.x, y: port.y } : null;
}

/**
 * Hub-routed wire polyline: every port connects to the first port (the hub).
 * Routing is ORTHOGONAL with a Z-shape per hub→port link: horizontal out of
 * the hub to a vertical "dogleg" placed in the GAP between the two columns,
 * then horizontal into the target. Keeping the long vertical leg in the gap
 * (not at either pin's x) keeps wires off the component bodies, and a small
 * per-wire lane offset on the dogleg de-stacks parallel routes. Aligned pins
 * collapse to a single straight segment. No diagonals.
 */
export function wireSegments(
  doc: CircuitDocument,
  lib: PartLibrary,
  wireId: EntityId,
): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const wire = doc.wires.get(wireId);
  if (!wire || wire.ports.length === 0) return [];
  const pts = wire.ports
    .map((p) => portPosition(doc, lib, p.component, p.pin))
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length < 2) return [];
  const hub = pts[0];
  const segs: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  const push = (x0: number, y0: number, x1: number, y1: number): void => {
    if (x0 !== x1 || y0 !== y1) segs.push({ x0, y0, x1, y1 });
  };
  pts.slice(1).forEach((p, i) => {
    if (hub.x === p.x || hub.y === p.y) {
      push(hub.x, hub.y, p.x, p.y); // already aligned: one straight leg
      return;
    }
    // Vertical dogleg at a grid-snapped mid-x, nudged into its own lane so
    // sibling routes don't stack, then clamped to stay inside the gap.
    const lane = (((wireId * 2 + i) % 5) - 2) * SNAP; // one of 5 lanes
    const lo = Math.min(hub.x, p.x), hi = Math.max(hub.x, p.x);
    let midX = Math.round(((hub.x + p.x) / 2 + lane) / SNAP) * SNAP;
    midX = Math.max(lo + SNAP, Math.min(hi - SNAP, midX));
    push(hub.x, hub.y, midX, hub.y);  // H out of the hub
    push(midX, hub.y, midX, p.y);     // V dogleg in the gap
    push(midX, p.y, p.x, p.y);        // H into the target
  });
  return segs;
}

/**
 * Points where a net visibly branches — drawn as junction dots so an
 * intentional connection (≥2 wire segments meeting at a shared pin, or a
 * fan-out hub) reads differently from two wires merely crossing (which never
 * share a pin endpoint, so they never get a dot).
 */
export function wireJunctions(
  doc: CircuitDocument,
  lib: PartLibrary,
): Array<{ x: number; y: number }> {
  const tally = new Map<string, { x: number; y: number; count: number }>();
  const bump = (x: number, y: number, n: number): void => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    const e = tally.get(k);
    if (e) e.count += n;
    else tally.set(k, { x, y, count: n });
  };
  for (const wire of doc.wires.values()) {
    const pts = wire.ports
      .map((p) => portPosition(doc, lib, p.component, p.pin))
      .filter((p): p is { x: number; y: number } => p !== null);
    if (pts.length < 2) continue;
    bump(pts[0].x, pts[0].y, pts.length - 1); // segments emanating from the hub
    for (const p of pts.slice(1)) bump(p.x, p.y, 1);
  }
  const out: Array<{ x: number; y: number }> = [];
  for (const e of tally.values()) if (e.count >= 2) out.push({ x: e.x, y: e.y });
  return out;
}

function distToSegment(
  px: number, py: number,
  x0: number, y0: number, x1: number, y1: number,
): number {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
  const cx = x0 + t * dx, cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Precise hit test, priority: ports > components > wires (smaller targets
 * win). The grid narrows candidates; geometry decides.
 */
export function hitTest(
  doc: CircuitDocument,
  lib: PartLibrary,
  grid: SpatialGrid,
  wx: number,
  wy: number,
): HitResult {
  const pad = Math.max(PORT_RADIUS, WIRE_RADIUS);
  const candidates = grid.query(wx - pad, wy - pad, wx + pad, wy + pad);

  let component: HitResult = null;
  let wireHit: HitResult = null;
  for (const id of candidates) {
    const comp = doc.components.get(id);
    if (comp) {
      const geom = componentGeom(comp, layoutInterface(comp.part, lib));
      for (const port of geom.ports) {
        if (Math.hypot(wx - port.x, wy - port.y) <= PORT_RADIUS) {
          return { type: "port", component: id, pin: port.pin, x: port.x, y: port.y, dir: port.dir };
        }
      }
      if (wx >= geom.x && wx <= geom.x + geom.w && wy >= geom.y && wy <= geom.y + geom.h) {
        component ??= { type: "component", id };
      }
      continue;
    }
    if (doc.wires.has(id) && wireHit === null) {
      for (const seg of wireSegments(doc, lib, id)) {
        if (distToSegment(wx, wy, seg.x0, seg.y0, seg.x1, seg.y1) <= WIRE_RADIUS) {
          wireHit = { type: "wire", id };
          break;
        }
      }
    }
  }
  return component ?? wireHit;
}

/** Bounds for grid insertion (ports stick out PORT_RADIUS past the box). */
export function componentBounds(comp: Component, lib: PartLibrary) {
  const geom = componentGeom(comp, layoutInterface(comp.part, lib));
  return {
    x0: geom.x - PORT_RADIUS, y0: geom.y - PORT_RADIUS,
    x1: geom.x + geom.w + PORT_RADIUS, y1: geom.y + geom.h + PORT_RADIUS,
  };
}

export function wireBounds(doc: CircuitDocument, lib: PartLibrary, wireId: EntityId) {
  const segs = wireSegments(doc, lib, wireId);
  if (segs.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segs) {
    x0 = Math.min(x0, s.x0, s.x1); x1 = Math.max(x1, s.x0, s.x1);
    y0 = Math.min(y0, s.y0, s.y1); y1 = Math.max(y1, s.y0, s.y1);
  }
  return { x0: x0 - WIRE_RADIUS, y0: y0 - WIRE_RADIUS, x1: x1 + WIRE_RADIUS, y1: y1 + WIRE_RADIUS };
}

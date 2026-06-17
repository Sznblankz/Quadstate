/**
 * Project thumbnails (motion/polish pass): render a saved project's circuit
 * to a small data-URL image by reusing the real schematic renderer, so Home
 * cards show the actual circuit rather than a placeholder pattern.
 *
 * Pure read: a throwaway PartLibrary (builtins resolve statically; the file
 * carries its own chip closure) and a fresh document keep this isolated from
 * the live editor's library and document.
 */
import {
  SpatialGrid, Viewport, componentBounds, renderSchematic, wireBounds,
  type RenderState,
} from "@logicsim/canvas";
import { Selection, projectFromJson, type CircuitDocument } from "@logicsim/document";
import { PartLibrary } from "@logicsim/schema";

/**
 * Populate a fresh spatial grid with every component + wire and return their
 * shared bounding box (or null when the document has no finite geometry). Shared
 * by the card thumbnail and the Share/Export PNG so both fit content the same way.
 */
function contentBounds(
  doc: CircuitDocument,
  lib: PartLibrary,
): { grid: SpatialGrid; x0: number; y0: number; x1: number; y1: number } | null {
  const grid = new SpatialGrid(200);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const comp of doc.components.values()) {
    const b = componentBounds(comp, lib);
    grid.insert(comp.id, b.x0, b.y0, b.x1, b.y1);
    x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
    x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
  }
  for (const wire of doc.wires.values()) {
    const b = wireBounds(doc, lib, wire.id);
    if (!b) continue;
    grid.insert(wire.id, b.x0, b.y0, b.x1, b.y1);
    x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
    x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
  }
  if (!Number.isFinite(x0)) return null;
  return { grid, x0, y0, x1, y1 };
}

/**
 * Render `json` (a project file) to a PNG data URL of `w`×`h` CSS px.
 * Returns null for empty/unparseable projects so callers can fall back to
 * the placeholder. `dpr` oversamples so the image stays crisp both on HiDPI
 * cards and while the Home→Editor portal zooms it up to the canvas region.
 */
export function renderThumbnail(json: string, w: number, h: number, dpr = 3): string | null {
  try {
    const lib = new PartLibrary();
    const { doc } = projectFromJson(json, lib);
    if (doc.components.size === 0) return null;

    const b = contentBounds(doc, lib);
    if (!b) return null;
    const { grid, x0, y0, x1, y1 } = b;

    // Fit-to-view with breathing room; never magnify past 1.4× so small
    // circuits read as a tidy diagram rather than giant single gates.
    const pad = 28;
    const bw = x1 - x0 + pad * 2;
    const bh = y1 - y0 + pad * 2;
    const zoom = Math.min(1.4, Math.min(w / bw, h / bh));
    const vp = new Viewport();
    vp.zoom = zoom;
    vp.x = x0 - pad - (w / zoom - bw) / 2;
    vp.y = y0 - pad - (h / zoom - bh) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const state: RenderState = {
      doc, lib, selection: new Selection(doc), viewport: vp, grid, overlay: {},
      netValues: null, wireNets: new Map(), ioNets: new Map(),
      width: w, height: h, dpr,
    };
    renderSchematic(ctx, state);
    return canvas.toDataURL("image/png");
  } catch {
    return null; // corrupt/legacy project — fall back to the placeholder
  }
}

/**
 * Render `json` (a project file) to a standalone PNG data URL for Share/Export.
 * Unlike the card thumbnail this sizes the image to the circuit's OWN bounds
 * (not a fixed card), fitting the longest side near `target` CSS px and then
 * oversampling by `dpr` for a crisp, shareable picture. The app's dark
 * background is baked in by the renderer. Returns null for an empty/unparseable
 * project so callers can disable the action.
 */
export function renderCircuitPng(
  json: string,
  opts: { target?: number; pad?: number; dpr?: number; maxDim?: number } = {},
): string | null {
  const target = opts.target ?? 1600; // desired longest CSS side, pre-dpr
  const pad = opts.pad ?? 48;
  const dpr = opts.dpr ?? 2;
  const maxDim = opts.maxDim ?? 4096; // hard cap on output pixels per side
  try {
    const lib = new PartLibrary();
    const { doc } = projectFromJson(json, lib);
    if (doc.components.size === 0) return null;

    const b = contentBounds(doc, lib);
    if (!b) return null;
    const { grid, x0, y0, x1, y1 } = b;

    const bw = x1 - x0 + pad * 2;
    const bh = y1 - y0 + pad * 2;
    const longest = Math.max(bw, bh);
    // Fit the longest side near `target`, keep tiny circuits readable (>=0.5×)
    // without ballooning a single gate (<=2×), then honour the pixel cap so a
    // sprawling circuit can't produce a multi-megapixel data URL.
    let zoom = Math.min(2, Math.max(0.5, target / longest));
    zoom = Math.min(zoom, maxDim / dpr / longest);

    const w = bw * zoom;
    const h = bh * zoom;
    const vp = new Viewport();
    vp.zoom = zoom;
    vp.x = x0 - pad;
    vp.y = y0 - pad;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const state: RenderState = {
      doc, lib, selection: new Selection(doc), viewport: vp, grid, overlay: {},
      netValues: null, wireNets: new Map(), ioNets: new Map(),
      width: w, height: h, dpr,
    };
    renderSchematic(ctx, state);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

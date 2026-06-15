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
import { Selection, projectFromJson } from "@logicsim/document";
import { PartLibrary } from "@logicsim/schema";

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

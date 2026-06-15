import { moveComponents } from "@logicsim/document";
import { SNAP } from "../symbols.js";
import type { Intent } from "../input/types.js";
import type { Tool, ToolContext } from "./types.js";

/** Round a world delta to the grid, unless snapping is disabled (Settings). */
function snapTo(v: number, ctx: ToolContext): number {
  return ctx.snap === false ? v : Math.round(v / SNAP) * SNAP;
}

/**
 * Select tool: tap selects (shift toggles), drag on a component moves the
 * selection (ghost preview, single undoable command on release, snapped),
 * drag on empty space marquee-selects.
 */
export class SelectTool implements Tool {
  readonly id = "select";
  private moving: { ids: number[]; dx: number; dy: number } | null = null;
  private marqueeStart: { x: number; y: number } | null = null;

  intent(i: Intent, ctx: ToolContext): void {
    switch (i.type) {
      case "tap": {
        if (i.target?.type === "component" || i.target?.type === "wire") {
          const id = i.target.type === "component" ? i.target.id : i.target.id;
          if (i.shift) ctx.selection.toggle(id);
          else ctx.selection.setTo([id]);
        } else if (!i.shift) {
          ctx.selection.clear();
        }
        ctx.requestRender();
        return;
      }
      case "dragStart": {
        if (i.target?.type === "component") {
          if (!ctx.selection.has(i.target.id)) ctx.selection.setTo([i.target.id]);
          this.moving = { ids: [...ctx.selection.ofType("component")], dx: 0, dy: 0 };
          ctx.overlay.dragGhost = { ids: this.moving.ids, dx: 0, dy: 0 };
        } else {
          this.marqueeStart = { x: i.wx, y: i.wy };
          ctx.overlay.marquee = { x0: i.wx, y0: i.wy, x1: i.wx, y1: i.wy };
        }
        ctx.requestRender();
        return;
      }
      case "dragMove": {
        if (this.moving) {
          this.moving.dx += i.dwx;
          this.moving.dy += i.dwy;
          ctx.overlay.dragGhost = {
            ids: this.moving.ids,
            dx: snapTo(this.moving.dx, ctx),
            dy: snapTo(this.moving.dy, ctx),
          };
        } else if (this.marqueeStart) {
          ctx.overlay.marquee = {
            x0: Math.min(this.marqueeStart.x, i.wx),
            y0: Math.min(this.marqueeStart.y, i.wy),
            x1: Math.max(this.marqueeStart.x, i.wx),
            y1: Math.max(this.marqueeStart.y, i.wy),
          };
        }
        ctx.requestRender();
        return;
      }
      case "dragEnd": {
        if (this.moving) {
          const dx = snapTo(this.moving.dx, ctx);
          const dy = snapTo(this.moving.dy, ctx);
          if (dx !== 0 || dy !== 0) {
            ctx.history.execute(ctx.doc, moveComponents(this.moving.ids, dx, dy), ctx.selection);
            ctx.structureChanged(); // geometry feeds wires; nets unchanged but bounds move
          }
        } else if (ctx.overlay.marquee) {
          const m = ctx.overlay.marquee;
          ctx.selection.setTo(ctx.queryRect(m.x0, m.y0, m.x1, m.y1));
        }
        this.reset(ctx);
        return;
      }
      case "dragCancel":
        this.reset(ctx);
        return;
    }
  }

  deactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  private reset(ctx: ToolContext): void {
    this.moving = null;
    this.marqueeStart = null;
    delete ctx.overlay.dragGhost;
    delete ctx.overlay.marquee;
    ctx.requestRender();
  }
}

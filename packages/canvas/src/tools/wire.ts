import { addWire } from "@logicsim/document";
import type { Intent } from "../input/types.js";
import type { Tool, ToolContext } from "./types.js";

/** Wire tool: drag from one port to another. Two-port wires in V1;
 *  tapping extends later (M4). */
export class WireTool implements Tool {
  readonly id = "wire";
  private from: { component: number; pin: string; x: number; y: number } | null = null;

  intent(i: Intent, ctx: ToolContext): void {
    switch (i.type) {
      case "dragStart": {
        if (i.target?.type === "port") {
          this.from = {
            component: i.target.component, pin: i.target.pin,
            x: i.target.x, y: i.target.y,
          };
          ctx.overlay.wirePreview = {
            x0: i.target.x, y0: i.target.y, x1: i.target.x, y1: i.target.y, valid: false,
          };
          ctx.requestRender();
        }
        return;
      }
      case "dragMove": {
        if (!this.from || !ctx.overlay.wirePreview) return;
        const hit = ctx.hitTest(i.wx, i.wy);
        const snap = hit?.type === "port" && hit.component !== this.from.component ? hit : null;
        ctx.overlay.wirePreview.x1 = snap ? snap.x : i.wx;
        ctx.overlay.wirePreview.y1 = snap ? snap.y : i.wy;
        ctx.overlay.wirePreview.valid = snap !== null;
        ctx.requestRender();
        return;
      }
      case "dragEnd": {
        if (this.from) {
          const hit = ctx.hitTest(i.wx, i.wy);
          if (hit?.type === "port" &&
            (hit.component !== this.from.component || hit.pin !== this.from.pin)) {
            ctx.history.execute(ctx.doc, addWire(ctx.doc, [
              { component: this.from.component, pin: this.from.pin },
              { component: hit.component, pin: hit.pin },
            ]), ctx.selection);
            ctx.structureChanged();
          }
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
    this.from = null;
    delete ctx.overlay.wirePreview;
    ctx.requestRender();
  }
}

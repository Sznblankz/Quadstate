import { addStroke, type StrokePoint } from "@logicsim/document";
import type { Intent } from "../input/types.js";
import type { Tool, ToolContext } from "./types.js";

/**
 * Ink tool: freehand annotation strokes with pressure. One-euro-style
 * smoothing is a simple EMA in V1 (positions only; raw pressure kept).
 */
export class InkTool implements Tool {
  readonly id = "ink";
  private points: StrokePoint[] | null = null;
  private smoothX = 0;
  private smoothY = 0;

  color = "#f59e0b";
  baseWidth = 2.5;
  /** EMA factor: 1 = no smoothing. */
  smoothing = 0.55;

  intent(i: Intent, ctx: ToolContext): void {
    switch (i.type) {
      case "dragStart": {
        this.points = [{ x: i.wx, y: i.wy, p: clampP(i.pressure) }];
        this.smoothX = i.wx;
        this.smoothY = i.wy;
        ctx.overlay.inkPreview = this.points;
        ctx.requestRender();
        return;
      }
      case "dragMove": {
        if (!this.points) return;
        this.smoothX += (i.wx - this.smoothX) * this.smoothing;
        this.smoothY += (i.wy - this.smoothY) * this.smoothing;
        this.points.push({ x: this.smoothX, y: this.smoothY, p: clampP(i.pressure) });
        ctx.requestRender();
        return;
      }
      case "dragEnd": {
        if (this.points && this.points.length > 1) {
          ctx.history.execute(ctx.doc, addStroke(ctx.doc, {
            points: this.points, baseWidth: this.baseWidth, color: this.color,
          }), ctx.selection);
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
    this.points = null;
    delete ctx.overlay.inkPreview;
    ctx.requestRender();
  }
}

function clampP(p: number): number {
  return p > 0 && p <= 1 ? p : 0.5;
}

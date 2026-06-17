import { addWire, moveComponents, pokeInput } from "@logicsim/document";
import { SNAP } from "../symbols.js";
import type { HitResult } from "../symbols.js";
import type { Intent } from "../input/types.js";
import type { Tool, ToolContext } from "./types.js";

type PortHit = Extract<NonNullable<HitResult>, { type: "port" }>;

/** Round a world delta to the grid, unless snapping is disabled (Settings). */
function snapTo(v: number, ctx: ToolContext): number {
  return ctx.snap === false ? v : Math.round(v / SNAP) * SNAP;
}

/**
 * Modeless default tool — "the target decides", so there is no Select / Wire /
 * Poke switching. One resting state; the gesture's meaning comes from what it
 * starts on:
 *   tap an input switch (io:in) -> toggle it 0 <-> 1 (X/Z are never hand-set)
 *   tap a part / wire           -> select (shift toggles)
 *   tap empty                   -> deselect
 *   drag from a port            -> draw a wire (snaps to a target port)
 *   drag from a part            -> move the selection (snapped ghost)
 *   drag from empty             -> marquee select
 *
 * This folds the old SelectTool + WireTool + PokeTool into the one tool the
 * canvas rests in, so the basic build/poke loop needs no mode buttons.
 */
export class ModelessTool implements Tool {
  readonly id = "modeless";

  private wireFrom: PortHit | null = null;
  private moving: { ids: number[]; dx: number; dy: number } | null = null;
  private marqueeStart: { x: number; y: number } | null = null;

  intent(i: Intent, ctx: ToolContext): void {
    switch (i.type) {
      case "tap": return this.tap(i, ctx);
      case "dragStart": return this.dragStart(i, ctx);
      case "dragMove": return this.dragMove(i, ctx);
      case "dragEnd": return this.dragEnd(i, ctx);
      case "dragCancel": return this.reset(ctx);
    }
  }

  // ------------------------------------------------------------------- taps

  private tap(i: Extract<Intent, { type: "tap" }>, ctx: ToolContext): void {
    // Tapping an input switch pokes it directly. A click on the io:in body OR
    // on its pin both count, so the switch is reliably pokeable.
    const pokeId = this.inputAt(i.target, ctx);
    if (pokeId !== null) {
      const comp = ctx.doc.components.get(pokeId)!;
      const cur = typeof comp.props.value === "number" ? comp.props.value : 0;
      // User-facing inputs toggle 0 <-> 1 ONLY. X and Z are never set by hand —
      // they emerge from circuit behaviour (contention/uninitialized -> X,
      // floating/tri-state -> Z). Forcing X/Z is a dev-only affordance via the
      // console (window.__logicsim.bridge.poke(id, 2|3)).
      const next = cur === 0 ? 1 : 0; // 0 -> 1 -> 0 (any X/Z resolves to 0)
      ctx.history.execute(ctx.doc, pokeInput(pokeId, next, ctx.simTick()), ctx.selection);
      ctx.poke(pokeId, next);
      ctx.requestRender();
      return;
    }

    // Alt+tap a wire adds it to the timing diagram (stable tracked-signal path),
    // and selects it as feedback. Idempotent if it's already tracked.
    if (i.alt && i.target?.type === "wire" && ctx.addToScope) {
      ctx.addToScope(i.target.id);
      ctx.selection.setTo([i.target.id]);
      ctx.requestRender();
      return;
    }

    if (i.target?.type === "port") {
      // A bare tap on a (non-input) port selects its part; wiring is a drag.
      ctx.selection.setTo([i.target.component]);
    } else if (i.target?.type === "component" || i.target?.type === "wire") {
      if (i.shift) ctx.selection.toggle(i.target.id);
      else ctx.selection.setTo([i.target.id]);
    } else if (!i.shift) {
      ctx.selection.clear();
    }
    ctx.requestRender();
  }

  /** The io:in component a hit refers to (its body or its pin), else null. */
  private inputAt(target: HitResult, ctx: ToolContext): number | null {
    const id = target?.type === "component" ? target.id
      : target?.type === "port" ? target.component
      : null;
    if (id === null) return null;
    return ctx.doc.components.get(id)?.part === "io:in" ? id : null;
  }

  // ------------------------------------------------------------------ drags

  private dragStart(i: Extract<Intent, { type: "dragStart" }>, ctx: ToolContext): void {
    if (i.target?.type === "port") {
      this.wireFrom = i.target;
      ctx.overlay.wirePreview = {
        x0: i.target.x, y0: i.target.y, x1: i.target.x, y1: i.target.y, valid: false,
      };
    } else if (i.target?.type === "component") {
      if (!ctx.selection.has(i.target.id)) ctx.selection.setTo([i.target.id]);
      this.moving = { ids: [...ctx.selection.ofType("component")], dx: 0, dy: 0 };
      ctx.overlay.dragGhost = { ids: this.moving.ids, dx: 0, dy: 0 };
    } else {
      // Empty canvas or a wire body: marquee.
      this.marqueeStart = { x: i.wx, y: i.wy };
      ctx.overlay.marquee = { x0: i.wx, y0: i.wy, x1: i.wx, y1: i.wy };
    }
    ctx.requestRender();
  }

  private dragMove(i: Extract<Intent, { type: "dragMove" }>, ctx: ToolContext): void {
    if (this.wireFrom && ctx.overlay.wirePreview) {
      const hit = ctx.hitTest(i.wx, i.wy);
      const snap = hit?.type === "port" && hit.component !== this.wireFrom.component ? hit : null;
      ctx.overlay.wirePreview.x1 = snap ? snap.x : i.wx;
      ctx.overlay.wirePreview.y1 = snap ? snap.y : i.wy;
      ctx.overlay.wirePreview.valid = snap !== null;
    } else if (this.moving) {
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
  }

  private dragEnd(i: Extract<Intent, { type: "dragEnd" }>, ctx: ToolContext): void {
    if (this.wireFrom) {
      const hit = ctx.hitTest(i.wx, i.wy);
      if (hit?.type === "port" &&
        (hit.component !== this.wireFrom.component || hit.pin !== this.wireFrom.pin)) {
        ctx.history.execute(ctx.doc, addWire(ctx.doc, [
          { component: this.wireFrom.component, pin: this.wireFrom.pin },
          { component: hit.component, pin: hit.pin },
        ]), ctx.selection);
        ctx.structureChanged();
      }
    } else if (this.moving) {
      const dx = snapTo(this.moving.dx, ctx);
      const dy = snapTo(this.moving.dy, ctx);
      if (dx !== 0 || dy !== 0) {
        ctx.history.execute(ctx.doc, moveComponents(this.moving.ids, dx, dy), ctx.selection);
        ctx.structureChanged();
      }
    } else if (ctx.overlay.marquee) {
      const m = ctx.overlay.marquee;
      ctx.selection.setTo(ctx.queryRect(m.x0, m.y0, m.x1, m.y1));
    }
    this.reset(ctx);
  }

  deactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  private reset(ctx: ToolContext): void {
    this.wireFrom = null;
    this.moving = null;
    this.marqueeStart = null;
    delete ctx.overlay.wirePreview;
    delete ctx.overlay.dragGhost;
    delete ctx.overlay.marquee;
    ctx.requestRender();
  }
}

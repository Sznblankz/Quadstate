/**
 * Modeless contract tool (interaction model doc §1: the target decides).
 *
 * One resting state; what a gesture means is decided by what it starts on:
 *   drag from a port      -> wire (drop on port = connect, on wire = junction)
 *   drag from a component -> move selection (snapped ghost)
 *   drag from empty/wire  -> marquee (full enclosure)
 *   tap on port           -> click-click wiring chain (taps add waypoints)
 *   tap on entity         -> select (shift toggles); wire taps ghost the net
 *   tap on empty          -> deselect
 *
 * Escape ladder rung 1 lives here: cancelPending() aborts any in-flight
 * gesture or wiring chain and reports whether it did anything.
 */
import {
  SNAP, portPosition,
  type HitResult, type Intent, type Tool, type ToolContext,
} from "@logicsim/canvas";
import { addWire, moveComponents, type CircuitDocument, type EntityId } from "@logicsim/document";
import type { ProtoLogger } from "./logger.js";

type PortHit = Extract<NonNullable<HitResult>, { type: "port" }>;

export class ContractTool implements Tool {
  readonly id = "contract";

  private moving: { ids: number[]; dx: number; dy: number } | null = null;
  private marqueeStart: { x: number; y: number } | null = null;
  private wireFrom: PortHit | null = null;
  /** Click-click chain: source port + committed waypoints. */
  private chain: { from: PortHit; waypoints: Array<{ x: number; y: number }> } | null = null;
  private lastDragAt = 0;

  constructor(private logger: ProtoLogger) {}

  /** True while a wiring chain or drag gesture is in flight (ladder rung 1). */
  get pending(): boolean {
    return this.moving !== null || this.marqueeStart !== null ||
      this.wireFrom !== null || this.chain !== null;
  }

  cancelPending(ctx: ToolContext): boolean {
    if (!this.pending) return false;
    this.logger.log("gestureCancel", {
      what: this.chain ? "chain" : this.wireFrom ? "wireDrag" : this.moving ? "move" : "marquee",
    });
    this.reset(ctx);
    return true;
  }

  intent(i: Intent, ctx: ToolContext): void {
    switch (i.type) {
      case "tap": return this.tap(i, ctx);
      case "dragStart": return this.dragStart(i, ctx);
      case "dragMove": return this.dragMove(i, ctx);
      case "dragEnd": return this.dragEnd(i, ctx);
      case "dragCancel":
        this.reset(ctx);
        return;
    }
  }

  // ------------------------------------------------------------------- taps

  private tap(i: Extract<Intent, { type: "tap" }>, ctx: ToolContext): void {
    // Active click-click chain: taps extend or finish it.
    if (this.chain) {
      if (i.target?.type === "port") {
        this.commitWire(this.chain.from, i.target, ctx, "clickClick");
        this.reset(ctx);
      } else if (i.target?.type === "wire") {
        this.commitJunction(this.chain.from, i.target.id, i.wx, i.wy, ctx, "clickClick");
        this.reset(ctx);
      } else {
        this.chain.waypoints.push({ x: i.wx, y: i.wy });
        this.logger.log("wireWaypoint", { n: this.chain.waypoints.length });
        this.updateChainPreview(i.wx, i.wy, false, ctx);
      }
      return;
    }

    if (i.target?.type === "port") {
      this.chain = { from: i.target, waypoints: [] };
      this.logger.log("wireStart", { mode: "clickClick" });
      this.updateChainPreview(i.target.x, i.target.y, false, ctx);
      return;
    }

    if (i.target?.type === "component" || i.target?.type === "wire") {
      if (i.shift) ctx.selection.toggle(i.target.id);
      else ctx.selection.setTo([i.target.id]);
      if (i.target.type === "wire" && ctx.selection.has(i.target.id)) {
        const net = netWires(ctx.doc, i.target.id);
        ctx.overlay.netGhost = net;
        this.logger.log("select", { kind: "wire", netSize: net.length });
      } else {
        delete ctx.overlay.netGhost;
        this.logger.log("select", { kind: i.target.type, size: ctx.selection.size });
      }
    } else if (!i.shift) {
      ctx.selection.clear();
      delete ctx.overlay.netGhost;
      this.logger.log("deselect", {});
    }
    ctx.requestRender();
  }

  // ------------------------------------------------------------------ drags

  private dragStart(i: Extract<Intent, { type: "dragStart" }>, ctx: ToolContext): void {
    this.lastDragAt = performance.now();
    if (this.chain) this.reset(ctx); // a drag supersedes a dangling chain

    if (i.target?.type === "port") {
      this.wireFrom = i.target;
      this.logger.log("wireStart", { mode: "drag" });
      ctx.overlay.wirePath = {
        points: [{ x: i.target.x, y: i.target.y }, { x: i.target.x, y: i.target.y }],
        valid: false,
      };
    } else if (i.target?.type === "component") {
      if (!ctx.selection.has(i.target.id)) ctx.selection.setTo([i.target.id]);
      this.moving = { ids: [...ctx.selection.ofType("component")], dx: 0, dy: 0 };
      ctx.overlay.dragGhost = { ids: this.moving.ids, dx: 0, dy: 0 };
      this.logger.log("moveStart", { ids: this.moving.ids.length });
    } else {
      // Empty canvas or wire body: marquee.
      this.marqueeStart = { x: i.wx, y: i.wy };
      ctx.overlay.marquee = { x0: i.wx, y0: i.wy, x1: i.wx, y1: i.wy };
    }
    ctx.requestRender();
  }

  private dragMove(i: Extract<Intent, { type: "dragMove" }>, ctx: ToolContext): void {
    if (this.wireFrom && ctx.overlay.wirePath) {
      const target = this.wireTarget(this.wireFrom, i.wx, i.wy, ctx);
      const head = ctx.overlay.wirePath.points;
      head[head.length - 1] = target.snap ?? { x: i.wx, y: i.wy };
      ctx.overlay.wirePath.valid = target.valid;
    } else if (this.moving) {
      this.moving.dx += i.dwx;
      this.moving.dy += i.dwy;
      ctx.overlay.dragGhost = {
        ids: this.moving.ids,
        dx: Math.round(this.moving.dx / SNAP) * SNAP,
        dy: Math.round(this.moving.dy / SNAP) * SNAP,
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
        this.commitWire(this.wireFrom, hit, ctx, "drag");
      } else if (hit?.type === "wire") {
        this.commitJunction(this.wireFrom, hit.id, i.wx, i.wy, ctx, "drag");
      } else {
        this.logger.log("wireRefuse", {
          reason: hit === null ? "empty" : hit.type === "component" ? "componentBody" : "samePort",
        });
      }
    } else if (this.moving) {
      const dx = Math.round(this.moving.dx / SNAP) * SNAP;
      const dy = Math.round(this.moving.dy / SNAP) * SNAP;
      if (dx !== 0 || dy !== 0) {
        ctx.history.execute(ctx.doc, moveComponents(this.moving.ids, dx, dy), ctx.selection);
        ctx.structureChanged();
        this.logger.log("move", { ids: this.moving.ids.length, dx, dy });
      }
    } else if (ctx.overlay.marquee) {
      const m = ctx.overlay.marquee;
      ctx.selection.setTo(ctx.queryRect(m.x0, m.y0, m.x1, m.y1));
      this.logger.log("marquee", { count: ctx.selection.size });
    }
    this.reset(ctx);
  }

  // ---------------------------------------------------------------- helpers

  private wireTarget(
    from: PortHit, wx: number, wy: number, ctx: ToolContext,
  ): { valid: boolean; snap: { x: number; y: number } | null } {
    const hit = ctx.hitTest(wx, wy);
    if (hit?.type === "port" && (hit.component !== from.component || hit.pin !== from.pin)) {
      return { valid: true, snap: { x: hit.x, y: hit.y } };
    }
    if (hit?.type === "wire") return { valid: true, snap: null };
    return { valid: false, snap: null };
  }

  private commitWire(from: PortHit, to: PortHit, ctx: ToolContext, mode: string): void {
    ctx.history.execute(ctx.doc, addWire(ctx.doc, [
      { component: from.component, pin: from.pin },
      { component: to.component, pin: to.pin },
    ]), ctx.selection);
    ctx.structureChanged();
    this.logger.log("wireCommit", { mode, junction: false });
  }

  /**
   * Drop on a wire = junction: connect to the hit wire's nearest port.
   * Sharing a port merges the nets (union-find in document/nets.ts), so
   * this is electrically a mid-wire tap even though the gray-box renders
   * it as a line to that port.
   */
  private commitJunction(
    from: PortHit, wireId: EntityId, wx: number, wy: number, ctx: ToolContext, mode: string,
  ): void {
    const wire = ctx.doc.wires.get(wireId);
    if (!wire || wire.ports.length === 0) return;
    let best = wire.ports[0];
    let bestD = Infinity;
    for (const p of wire.ports) {
      if (p.component === from.component && p.pin === from.pin) continue;
      const pos = portPosition(ctx.doc, ctx.lib, p.component, p.pin);
      if (!pos) continue;
      const d = Math.hypot(pos.x - wx, pos.y - wy);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best.component === from.component && best.pin === from.pin) {
      this.logger.log("wireRefuse", { reason: "selfJunction" });
      return;
    }
    ctx.history.execute(ctx.doc, addWire(ctx.doc, [
      { component: from.component, pin: from.pin },
      { component: best.component, pin: best.pin },
    ]), ctx.selection);
    ctx.structureChanged();
    this.logger.log("wireCommit", { mode, junction: true });
  }

  private updateChainPreview(hx: number, hy: number, valid: boolean, ctx: ToolContext): void {
    if (!this.chain) return;
    ctx.overlay.wirePath = {
      points: [
        { x: this.chain.from.x, y: this.chain.from.y },
        ...this.chain.waypoints,
        { x: hx, y: hy },
      ],
      valid,
    };
    ctx.requestRender();
  }

  /** Live head tracking for the click-click chain (fed by raw pointer moves). */
  hover(wx: number, wy: number, ctx: ToolContext): void {
    if (!this.chain) return;
    const target = this.wireTarget(this.chain.from, wx, wy, ctx);
    this.updateChainPreview(target.snap?.x ?? wx, target.snap?.y ?? wy, target.valid, ctx);
  }

  deactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  private reset(ctx: ToolContext): void {
    this.moving = null;
    this.marqueeStart = null;
    this.wireFrom = null;
    this.chain = null;
    delete ctx.overlay.dragGhost;
    delete ctx.overlay.marquee;
    delete ctx.overlay.wirePath;
    ctx.requestRender();
  }
}

/** All wires in the same electrical net (wires sharing any port merge). */
export function netWires(doc: CircuitDocument, wireId: EntityId): EntityId[] {
  const portKey = (c: EntityId, pin: string) => `${c}:${pin}`;
  const byPort = new Map<string, EntityId[]>();
  for (const w of doc.wires.values()) {
    for (const p of w.ports) {
      const k = portKey(p.component, p.pin);
      const list = byPort.get(k);
      if (list) list.push(w.id);
      else byPort.set(k, [w.id]);
    }
  }
  const seen = new Set<EntityId>([wireId]);
  const queue = [wireId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    const w = doc.wires.get(id);
    if (!w) continue;
    for (const p of w.ports) {
      for (const other of byPort.get(portKey(p.component, p.pin)) ?? []) {
        if (!seen.has(other)) { seen.add(other); queue.push(other); }
      }
    }
  }
  return [...seen];
}

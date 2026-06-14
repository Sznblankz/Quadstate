import type { HitResult } from "../symbols.js";
import type { Intent, PointerInput, WheelInput } from "./types.js";

export interface RecognizerDeps {
  hitTest(wx: number, wy: number): HitResult;
  emit(intent: Intent): void;
  /** Screen-px movement before a press becomes a drag instead of a tap. */
  slopPx?: number;
}

interface Tracked {
  kind: PointerInput["kind"];
  startSx: number;
  startSy: number;
  lastSx: number;
  lastSy: number;
  lastWx: number;
  lastWy: number;
  startTarget: HitResult;
  shift: boolean;
  /** "pending" until slop exceeded; then "drag" | "pan". */
  mode: "pending" | "drag" | "pan";
}

/**
 * Layer 2: per-pointer state machines + the device policy table. This is
 * the ONLY device-aware code in the stack.
 *
 * Policy:
 * - mouse: left press on entity -> drag (slop-gated, else tap); left press
 *   on empty -> drag with null target (tools interpret: marquee, wire,
 *   ink); middle press -> pan; wheel -> zoom at cursor.
 * - touch: one finger on entity -> drag/tap; on empty -> pan; a second
 *   finger converts the gesture to pinch-zoom (cancelling any drag).
 * - pen: behaves like the mouse left button (precise pointer), with
 *   pressure forwarded. While a pen is active, ALL touch input is
 *   demoted to panning — that one rule is both palm rejection and the
 *   "pen draws while finger pans" convention.
 */
export class GestureRecognizer {
  private pointers = new Map<number, Tracked>();
  private pinch: { a: number; b: number; lastDist: number; lastMidX: number; lastMidY: number } | null = null;
  private dragOwner: number | null = null;
  private readonly slop: number;

  constructor(private readonly deps: RecognizerDeps) {
    this.slop = deps.slopPx ?? 4;
  }

  private get penActive(): boolean {
    for (const t of this.pointers.values()) if (t.kind === "pen") return true;
    return false;
  }

  private touchPointers(): number[] {
    const out: number[] = [];
    for (const [id, t] of this.pointers) if (t.kind === "touch") out.push(id);
    return out;
  }

  pointer(p: PointerInput): void {
    switch (p.phase) {
      case "down": return this.down(p);
      case "move": return this.move(p);
      case "up": return this.up(p);
      case "cancel": return this.cancel(p);
    }
  }

  wheel(w: WheelInput): void {
    // Exponential so equal scroll steps feel like equal zoom ratios.
    this.deps.emit({ type: "zoom", factor: Math.exp(-w.deltaY * 0.0015), sx: w.sx, sy: w.sy });
  }

  private down(p: PointerInput): void {
    const tracked: Tracked = {
      kind: p.kind,
      startSx: p.sx, startSy: p.sy,
      lastSx: p.sx, lastSy: p.sy,
      lastWx: p.wx, lastWy: p.wy,
      startTarget: null,
      shift: p.shift,
      mode: "pending",
    };

    if (p.kind === "mouse" && p.button === 1) {
      tracked.mode = "pan";
    } else if (p.kind === "touch") {
      const touches = this.touchPointers();
      if (touches.length >= 1) {
        // Second finger: become pinch; cancel any in-flight drag.
        this.pointers.set(p.id, tracked);
        this.beginPinch(touches[0], p.id);
        return;
      }
      if (this.penActive) {
        tracked.mode = "pan"; // palm rejection: touch only pans while pen is down
      } else {
        tracked.startTarget = this.deps.hitTest(p.wx, p.wy);
        // Finger on empty canvas pans; on an entity it drags (slop-gated).
        if (tracked.startTarget === null) tracked.mode = "pan";
      }
    } else {
      // mouse left/right, pen
      tracked.startTarget = this.deps.hitTest(p.wx, p.wy);
    }
    this.pointers.set(p.id, tracked);
  }

  private beginPinch(aId: number, bId: number): void {
    const a = this.pointers.get(aId)!;
    const b = this.pointers.get(bId)!;
    if (this.dragOwner === aId) {
      this.deps.emit({ type: "dragCancel" });
      this.dragOwner = null;
    }
    a.mode = "pan"; // folded into pinch handling
    b.mode = "pan";
    this.pinch = {
      a: aId, b: bId,
      lastDist: Math.hypot(a.lastSx - b.lastSx, a.lastSy - b.lastSy),
      lastMidX: (a.lastSx + b.lastSx) / 2,
      lastMidY: (a.lastSy + b.lastSy) / 2,
    };
  }

  private move(p: PointerInput): void {
    const t = this.pointers.get(p.id);
    if (!t) return;

    if (this.pinch && (p.id === this.pinch.a || p.id === this.pinch.b)) {
      t.lastSx = p.sx; t.lastSy = p.sy; t.lastWx = p.wx; t.lastWy = p.wy;
      const a = this.pointers.get(this.pinch.a);
      const b = this.pointers.get(this.pinch.b);
      if (!a || !b) return;
      const dist = Math.hypot(a.lastSx - b.lastSx, a.lastSy - b.lastSy);
      const midX = (a.lastSx + b.lastSx) / 2;
      const midY = (a.lastSy + b.lastSy) / 2;
      if (this.pinch.lastDist > 0 && dist > 0) {
        this.deps.emit({ type: "zoom", factor: dist / this.pinch.lastDist, sx: midX, sy: midY });
      }
      this.deps.emit({ type: "pan", dsx: midX - this.pinch.lastMidX, dsy: midY - this.pinch.lastMidY });
      this.pinch.lastDist = dist;
      this.pinch.lastMidX = midX;
      this.pinch.lastMidY = midY;
      return;
    }

    if (t.mode === "pan") {
      this.deps.emit({ type: "pan", dsx: p.sx - t.lastSx, dsy: p.sy - t.lastSy });
    } else if (t.mode === "pending") {
      if (Math.hypot(p.sx - t.startSx, p.sy - t.startSy) > this.slop) {
        t.mode = "drag";
        this.dragOwner = p.id;
        this.deps.emit({
          type: "dragStart",
          wx: t.lastWx, wy: t.lastWy,
          target: t.startTarget, pressure: p.pressure, shift: t.shift,
        });
        this.emitDragMove(t, p);
      }
    } else if (t.mode === "drag" && this.dragOwner === p.id) {
      this.emitDragMove(t, p);
    }
    t.lastSx = p.sx; t.lastSy = p.sy; t.lastWx = p.wx; t.lastWy = p.wy;
  }

  private emitDragMove(t: Tracked, p: PointerInput): void {
    this.deps.emit({
      type: "dragMove",
      wx: p.wx, wy: p.wy,
      dwx: p.wx - t.lastWx, dwy: p.wy - t.lastWy,
      pressure: p.pressure,
    });
  }

  private up(p: PointerInput): void {
    const t = this.pointers.get(p.id);
    this.pointers.delete(p.id);
    if (!t) return;

    if (this.pinch && (p.id === this.pinch.a || p.id === this.pinch.b)) {
      this.pinch = null; // remaining finger continues as pan
      return;
    }
    if (t.mode === "pending") {
      this.deps.emit({ type: "tap", wx: t.lastWx, wy: t.lastWy, target: t.startTarget, shift: t.shift });
    } else if (t.mode === "drag" && this.dragOwner === p.id) {
      this.dragOwner = null;
      this.deps.emit({ type: "dragEnd", wx: p.wx, wy: p.wy });
    }
  }

  private cancel(p: PointerInput): void {
    const t = this.pointers.get(p.id);
    this.pointers.delete(p.id);
    if (!t) return;
    if (this.pinch && (p.id === this.pinch.a || p.id === this.pinch.b)) {
      this.pinch = null;
      return;
    }
    if (t.mode === "drag" && this.dragOwner === p.id) {
      this.dragOwner = null;
      this.deps.emit({ type: "dragCancel" });
    }
  }
}

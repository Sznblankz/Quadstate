import type { CircuitDocument, EntityId, History, Selection, StrokePoint } from "@logicsim/document";
import type { PartLibrary } from "@logicsim/schema";
import type { HitResult } from "../symbols.js";
import type { Intent } from "../input/types.js";
import type { Viewport } from "../transform.js";

/** Transient visuals drawn by the overlay layer; owned by the active tool. */
export interface OverlayState {
  marquee?: { x0: number; y0: number; x1: number; y1: number };
  wirePreview?: { x0: number; y0: number; x1: number; y1: number; valid: boolean };
  /** Multi-point wire preview (click-click waypoints + live head). */
  wirePath?: { points: Array<{ x: number; y: number }>; valid: boolean };
  inkPreview?: StrokePoint[];
  /** Live move ghost: draw these components offset by (dx, dy). */
  dragGhost?: { ids: EntityId[]; dx: number; dy: number };
  /** Armed stamp: translucent part preview following the cursor. */
  stampGhost?: { part: string; x: number; y: number };
  /** Faint highlight of the full electrical net of a selected wire. */
  netGhost?: EntityId[];
}

export interface ToolContext {
  doc: CircuitDocument;
  lib: PartLibrary;
  history: History;
  selection: Selection;
  viewport: Viewport;
  overlay: OverlayState;
  hitTest(wx: number, wy: number): HitResult;
  /** Entity ids intersecting a world rect (marquee). */
  queryRect(x0: number, y0: number, x1: number, y1: number): EntityId[];
  /** Current simulation tick (for poke commands). */
  simTick(): number;
  /** Push an input value change into the running simulation. */
  poke(componentId: EntityId, value: number): void;
  /** Document structure changed -> recompile + re-elaborate. */
  structureChanged(): void;
  requestRender(): void;
}

export interface Tool {
  readonly id: string;
  intent(i: Intent, ctx: ToolContext): void;
  /** Called when the tool is deactivated; clear any overlay state. */
  deactivate?(ctx: ToolContext): void;
}

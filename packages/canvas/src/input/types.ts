import type { HitResult } from "../symbols.js";

/**
 * Layer 1 output: normalized pointer samples. The DOM adapter (app shell)
 * converts PointerEvents into these — screen AND world coordinates are
 * both present because gestures need screen-space math (slop, pinch)
 * while tools live entirely in world space.
 */
export type PointerKind = "mouse" | "touch" | "pen";

export interface PointerInput {
  id: number;
  kind: PointerKind;
  phase: "down" | "move" | "up" | "cancel";
  sx: number;
  sy: number;
  wx: number;
  wy: number;
  /** 0..1; mouse reports 1 while a button is down. */
  pressure: number;
  /** 0 = left/primary, 1 = middle, 2 = right. */
  button: number;
  shift: boolean;
}

export interface WheelInput {
  sx: number;
  sy: number;
  deltaY: number;
}

/**
 * Layer 2 output: semantic intents. Tools consume ONLY these — they can
 * never tell an iPad from a desktop. Pressure rides along for the ink
 * tool; everything else ignores it.
 */
export type Intent =
  | { type: "tap"; wx: number; wy: number; target: HitResult; shift: boolean }
  | { type: "dragStart"; wx: number; wy: number; target: HitResult; pressure: number; shift: boolean }
  | { type: "dragMove"; wx: number; wy: number; dwx: number; dwy: number; pressure: number }
  | { type: "dragEnd"; wx: number; wy: number }
  | { type: "dragCancel" }
  | { type: "pan"; dsx: number; dsy: number }
  | { type: "zoom"; factor: number; sx: number; sy: number };

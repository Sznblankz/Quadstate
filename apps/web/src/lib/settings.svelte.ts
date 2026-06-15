/**
 * Per-device user settings (Settings overlay). Persisted to localStorage and
 * kept reactive via a Svelte 5 rune so components and the controller stay in
 * sync. Per-device only — there is no cloud sync (by design for this pass).
 */

export const APP_NAME = "QuadState";
export const APP_VERSION = "0.1.0";

export type WheelMode = "zoom" | "pan";
/** "playPan": tap = play/pause, hold = pan. "transport": tap = play/pause only. */
export type SpaceMode = "playPan" | "transport";

export interface Settings {
  /** Reduce non-essential motion (on top of the OS prefers-reduced-motion). */
  reducedMotion: boolean;
  /** Draw background grid dots on the canvas. */
  showGrid: boolean;
  /** Snap component placement/movement to the grid. */
  snap: boolean;
  /** Default bus width for newly placed IN/OUT pins. */
  defaultBusWidth: number;
  /** Mouse-wheel gesture: zoom at cursor, or scroll-to-pan. */
  wheelMode: WheelMode;
  /** Spacebar behaviour in the editor. */
  spaceMode: SpaceMode;
  /** Simulation speed (ticks/second) a freshly opened circuit starts at. */
  defaultSpeed: number;
  /** Begin simulating automatically when a circuit is opened. */
  startLive: boolean;
}

const DEFAULTS: Settings = {
  reducedMotion: false,
  showGrid: true,
  snap: true,
  defaultBusWidth: 1,
  wheelMode: "zoom",
  spaceMode: "playPan",
  defaultSpeed: 2000,
  startLive: false,
};

const KEY = "quadstate:settings:v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* corrupt / blocked — fall back to defaults */ }
  return { ...DEFAULTS };
}

/** Reactive settings singleton. Never reassigned (only mutated), so it stays
 *  a live store across module boundaries. */
export const settings = $state<Settings>(load());

function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* full/blocked */ }
}

/** Update one setting and persist. */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  if (key === "reducedMotion") applyReducedMotion();
  persist();
}

/** True when the OS asks for reduced motion. */
export function systemReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Effective reduced-motion = user setting OR OS preference. */
export function reduceMotionActive(): boolean {
  return settings.reducedMotion || systemReducedMotion();
}

/** Mirror the user's reduced-motion choice onto the document root so global
 *  CSS can neutralise transitions/animations (the OS preference is already
 *  handled by per-component @media queries). Call once on boot. */
export function applyReducedMotion(): void {
  if (typeof document === "undefined") return;
  if (settings.reducedMotion) document.documentElement.dataset.reducedMotion = "1";
  else delete document.documentElement.dataset.reducedMotion;
}

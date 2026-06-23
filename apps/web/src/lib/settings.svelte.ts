/**
 * User settings (Settings overlay). Persisted to localStorage (the immediate,
 * always-available cache) and kept reactive via a Svelte 5 rune. When signed
 * in, the blob also syncs to the cloud (`user_settings`): pulled on sign-in
 * (cloud wins) and pushed, debounced, on each change.
 */
import { supabase } from "./supabase.js";
import { account } from "./account.svelte.js";
import type { ThemeName } from "@logicsim/canvas";

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
  /** Light or dark appearance. */
  theme: ThemeName;
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
  theme: "light",
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

/** Update one setting and persist (locally, immediately; cloud, debounced). */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  if (key === "reducedMotion") applyReducedMotion();
  if (key === "theme") applyTheme();
  persist();
  pushCloud();
}

// ------------------------------------------------------------- cloud sync
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function upsertCloud(): void {
  if (!supabase || account.status !== "signedIn" || !account.userId) return;
  // PostgREST builders execute when `.then` is called; swallow errors (cloud
  // settings are best-effort — the local cache is always authoritative offline).
  supabase
    .from("user_settings")
    .upsert({ user_id: account.userId, settings: { ...settings }, updated_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

/** Debounced push of the whole settings blob to the signed-in user's row. */
function pushCloud(): void {
  if (!supabase || account.status !== "signedIn" || !account.userId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(upsertCloud, 600);
}

/** Pull the signed-in user's settings (cloud wins). If they have no row yet,
 *  seed it from this device's settings. Call when auth flips to signed-in. */
export async function pullCloudSettings(): Promise<void> {
  if (!supabase || account.status !== "signedIn" || !account.userId) return;
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", account.userId)
    .maybeSingle();
  if (error) return;
  const remote = (data as { settings: Partial<Settings> } | null)?.settings;
  if (remote && typeof remote === "object") {
    Object.assign(settings, { ...DEFAULTS, ...remote });
    applyReducedMotion();
    applyTheme();
    persist();
  } else {
    if (pushTimer) clearTimeout(pushTimer);
    upsertCloud(); // first sign-in: seed the cloud row from local
  }
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

/** Mirror the active theme onto the document root so the inline boot script's
 *  `data-theme` flag and any `[data-theme]` CSS overrides stay in sync. The
 *  chrome CSS vars + canvas palette are switched separately (App.svelte). */
export function applyTheme(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = settings.theme;
}

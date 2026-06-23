/**
 * QuadState visual tokens — the single JS source of truth. The Canvas2D
 * renderer consumes the ACTIVE palette directly; the Svelte app shell mirrors
 * it onto CSS custom properties so chrome and canvas never drift.
 *
 * Two palettes (`light` default, `dark`) share one key set, so a runtime theme
 * switch is just "pick the other palette". Laws this encodes: signal colors are
 * reserved (sig*) for circuit state only; `accent` (matte brick red) is
 * focus/selection/brand; one palette for everything.
 */
export type ThemeName = "light" | "dark";

export interface Tokens {
  // neutrals — chrome
  bg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  hairline: string;
  hairlineStrong: string;
  text1: string;
  text2: string;
  text3: string;
  // accent — focus / selection / brand (matte brick red)
  accent: string;
  accentHover: string;
  accentPress: string;
  accentQuiet: string;
  // canvas / part
  partFill: string;
  partEdge: string;
  partStroke: string;
  pin: string;
  label: string;
  wireNeutral: string;
  gridDot: string;
  // RESERVED signal palette — canvas / watch values only (X = amber)
  sig0: string;
  sig1: string;
  sigX: string;
  sigZ: string;
  // utility — overlays/elevation, theme-aware so chrome has no hardcoded darks
  scrim: string;
  overlayPanel: string;
  placeholderDot: string;
  shadow: string;
  fade: string;
}

/** Light theme — the default: white canvas, grey shapes/labels, brick-red accent. */
const light: Tokens = {
  bg: "#FFFFFF",
  surface1: "#F4F5F7",
  surface2: "#EBEDF1",
  surface3: "#DFE2E8",
  hairline: "rgba(17,20,26,0.10)",
  hairlineStrong: "rgba(17,20,26,0.16)",
  text1: "#1C2128",
  text2: "#535B68",
  text3: "#8A93A1",
  accent: "#BD4B3B",
  accentHover: "#A8412F",
  accentPress: "#93392A",
  accentQuiet: "rgba(189,75,59,0.12)",
  partFill: "#ECEEF1",
  partEdge: "rgba(28,33,40,0.22)",
  partStroke: "rgba(28,33,40,0.30)",
  pin: "#5E6878",
  label: "#3A424E",
  wireNeutral: "#7A828F",
  gridDot: "rgba(17,20,26,0.10)",
  sig0: "#2F6DB0",
  sig1: "#1FA463",
  sigX: "#C9821B",
  sigZ: "#7C8593",
  scrim: "rgba(28,33,40,0.34)",
  overlayPanel: "rgba(255,255,255,0.90)",
  placeholderDot: "rgba(17,20,26,0.07)",
  shadow: "rgba(28,33,40,0.16)",
  fade: "rgba(244,245,247,0)",
};

/** Dark theme — kept available; same neutrals as before, new brick-red accent
 *  and matte/amber signals to match the redesign. */
const dark: Tokens = {
  bg: "#0B0D11",
  surface1: "#13161C",
  surface2: "#1A1E26",
  surface3: "#222732",
  hairline: "rgba(255,255,255,0.07)",
  hairlineStrong: "rgba(255,255,255,0.12)",
  text1: "#E8EBF1",
  text2: "#9AA2B1",
  text3: "#626A79",
  accent: "#CB5746",
  accentHover: "#D96B5A",
  accentPress: "#B8493A",
  accentQuiet: "rgba(203,87,70,0.16)",
  partFill: "#14181F",
  partEdge: "rgba(255,255,255,0.12)",
  partStroke: "rgba(255,255,255,0.16)",
  pin: "#7E93AB",
  label: "#AEB6C4",
  wireNeutral: "#5A6573",
  gridDot: "rgba(255,255,255,0.05)",
  sig0: "#4A86C9",
  sig1: "#3FCB86",
  sigX: "#E0A53A",
  sigZ: "#8A93A3",
  scrim: "rgba(5,6,9,0.62)",
  overlayPanel: "rgba(13,15,20,0.90)",
  placeholderDot: "rgba(255,255,255,0.05)",
  shadow: "rgba(0,0,0,0.5)",
  fade: "rgba(19,22,28,0)",
};

export const THEMES: Record<ThemeName, Tokens> = { light, dark };

/** Back-compat alias for the default (light) palette. The app switches palettes
 *  at runtime via THEMES[theme] (chrome) and setActiveTheme() (canvas). */
export const TOKENS: Tokens = THEMES.light;

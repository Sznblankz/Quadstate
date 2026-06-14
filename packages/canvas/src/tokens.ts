/**
 * QuadState approved visual tokens — the single JS source of truth
 * (docs/product/VISUAL_SYSTEM_SUMMARY.md §1). The Canvas2D renderer consumes
 * these directly; the Svelte app shell mirrors them onto CSS custom
 * properties so chrome and canvas never drift.
 *
 * Three laws this encodes: signal colors are reserved (sig*) for circuit
 * state only; `accent` is focus/selection only; one palette for everything.
 */
export const TOKENS = {
  // neutrals — chrome
  bg: "#0B0D11",
  surface1: "#13161C",
  surface2: "#1A1E26",
  surface3: "#222732",
  hairline: "rgba(255,255,255,0.07)",
  hairlineStrong: "rgba(255,255,255,0.12)",
  text1: "#E8EBF1",
  text2: "#9AA2B1",
  text3: "#626A79",
  // accent — focus/selection ONLY
  accent: "#6C72FF",
  accentHover: "#7E83FF",
  accentPress: "#5A60E6",
  accentQuiet: "rgba(108,114,255,0.14)",
  // canvas / part
  partFill: "#14181F",
  partEdge: "rgba(255,255,255,0.12)",
  partStroke: "rgba(255,255,255,0.16)",
  pin: "#7E93AB",
  label: "#AEB6C4",
  wireNeutral: "#5A6573",
  gridDot: "rgba(255,255,255,0.05)",
  // RESERVED signal palette — canvas / watch values only
  sig0: "#3F72B0",
  sig1: "#43D689",
  sigX: "#E8554E",
  sigZ: "#8A93A3",
} as const;

export type Tokens = typeof TOKENS;

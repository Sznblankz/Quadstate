# P0 Checkpoint — Editor Re-skin (VERIFIED CLEAN)

**Date:** 2026-06-13 · **Plan:** `docs/build/VERTICAL_SLICE_V1.md` (milestone P0)
**Status:** ✅ Complete and verified. Zero new product logic (one dev-only seed + a 4-state poke cycle added for acceptance).

## What P0 did
Re-skinned the already-working editor to the approved QuadState visual system (tokens, 4-state signal language, gate silhouettes, editor shell). Engine, worker, document model, tools, and renderer **architecture** untouched.

## Acceptance — all verified live (pixel-sampled, not eyeballed)
1. **XOR demo seeds reliably** — the dev-only **`XOR demo`** button (and `__logicsim.loadXorDemo()`) builds 2×`io:in` → `XOR` → `io:out`, wired (`in1→a`, `in2→b`, `y→out`), running. Confirmed after a hard refresh: 4 components, 3 wires, `3 nets, 3 nodes`.
2. **Poke cycles 0 → 1 → X → Z → 0** — tapping an input with the Poke tool advances through all four states (verified by tool taps: `0→1→X→Z→0`).
3. **Wires render the approved signal language** (signals-layer pixel samples):
   | State | Sampled RGBA | Expected |
   |---|---|---|
   | `1` | rgb(67,214,137) a255 **+ halo a71 at +3px** | `#43D689` green solid + soft halo |
   | `0` | rgb(63,115,176) a229 | `#3F72B0` blue flat (~0.9α) |
   | `X` | rgb(232,85,78) a255 (dash-dot) | `#E8554E` red dash-dot |
   | `Z` | rgb(138,147,163) a179 (dashed) | `#8A93A3` gray dashed (~0.7α) |

   Halo confirmed precisely: full-alpha green core, **alpha-71 green** at +3px perpendicular, fully transparent at +7px.
4. **Build checks:** `pnpm typecheck` clean · **95 tests pass** (engine 19 / schema 31 / document 23 / canvas 22) · `vite build` succeeds (158 modules).

## Exact files changed
| File | Change |
|---|---|
| `packages/canvas/src/tokens.ts` | **NEW** — canonical JS token palette (VISUAL_SYSTEM_SUMMARY §1). |
| `packages/canvas/src/index.ts` | Export `TOKENS`, `Tokens`. |
| `packages/canvas/src/render/renderer.ts` | `COLORS` aliased to `TOKENS` (+`partStroke`); `renderSignals` rewritten to the 4-state language (1 green+halo / 0 blue flat / X red dash-dot / Z gray dashed; thickness 1-bit base, bus channel reserved-unused); `drawComponent` dispatches gates to new `drawGate()` silhouettes (AND/NAND/OR/NOR/XOR/XNOR/NOT/BUF); io switch body shows the poked state. |
| `packages/canvas/src/tools/poke.ts` | Poke cycles `0→1→X→Z→0` (was 0/1 toggle) so every state is clickable. |
| `apps/web/src/lib/controller.ts` | `import addComponent, addWire`; **NEW** `loadXorDemo()` (dev acceptance seed). |
| `apps/web/src/App.svelte` | Re-laid to the editor shell (header / 132px palette / dark canvas / 220px right rail) using `TOKENS`→CSS vars; dev-only `XOR demo` button. |
| `apps/web/src/lib/CanvasHost.svelte` | Host background → `#0B0D11`. |

## How to reproduce the demo
1. `pnpm --filter @logicsim/web dev` → open the app.
2. Click **`XOR demo`** (top-right, dev builds) — seeds the wired XOR, sim running, `in1=1 in2=0 → out=1` (green/blue/green).
   *Manual path:* palette → place `IN`, `IN`, `XOR`, `OUT`; `Wire` tool, drag pin→pin; done.
3. Select the **Poke** tool, click an `IN` pin repeatedly → watch its wire cycle **1 (green+halo) → X (red dash-dot) → Z (gray dashed) → 0 (blue)**, and the XOR output update live.

## Deferred (next milestones, do not start yet)
P1 Home + Resume → P2 Watch → P3 Why? → P4 polish. **Note for P1:** a refresh currently loses the working circuit — draft autosave/recovery matters for P1 (flagged, not built in P0).

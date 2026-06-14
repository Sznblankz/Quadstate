# P4 Checkpoint — Slice Polish + Modeless Interaction (VERIFIED CLEAN)

**Date:** 2026-06-14 · **Plan:** `docs/build/VERTICAL_SLICE_V1.md` (milestones P4a + P4)
**Status:** ✅ Complete and verified. The vertical slice (P0→P4) is on-brand and demoable.

This checkpoint covers two steps:
- **P4a** — interaction/branding cleanup (the modeless "fast-follow" flagged in plan §7 risk row).
- **P4** — slice polish: rail consistency, empty states, removal of mode leftovers.

## P4a — modeless interaction + branding (done 2026-06-14)
The default editor (non-`?proto=1`) is now **modeless** — the Select / Wire / Poke mode buttons are gone.
- **NEW `packages/canvas/src/tools/modeless.ts`** (`ModelessTool`, exported from the canvas index, the default `active` tool): *the target decides* — tap an `io:in` = poke-cycle `0→1→X→Z→0`, tap a part/wire = select, tap empty = deselect, drag from a port = wire (snap preview), drag from a part = move, drag from empty = marquee. The `?proto=1` harness still uses `ContractTool`.
- **Palette drag-and-drop** works in the default editor: drag a part onto the canvas to place one (ghost preview); a plain click still arms repeat-stamp. `Esc` drops an armed stamp / clears selection (the modeless exit).
- **Branding → QuadState:** `index.html` title, file-picker descriptions, and save/export filenames (`circuit.quadstate.json`, `*.quadstate-part.json`). Internal `@logicsim/*` package names and the `window.__logicsim` dev global intentionally kept.

## P4 — slice polish (done 2026-06-14)
1. **Inspector re-skin** — `Inspector.svelte` was the last surface still on hardcoded hex (panel `#131a23`, name `#7fb4f7`, signal `1`=`#3fd68f`). Now uses the token CSS variables and `signalColor()`, so it matches the rest of the rail and the canvas. Nested as a standard rail section with an `INSPECTOR` label.
2. **Rail consistency** — Inspector / Why? / Watches now share one token system + the signal language; the Why? close and Watch remove buttons share one `.icon-x` class.
3. **Watch empty/disabled states** — `+ Watch selected wire` is disabled unless exactly one not-yet-watched wire is selected (`UiState.canWatch`); the empty hint only shows when nothing watchable is selected.
4. **Empty labels** — clearer Inspector/Watches hints.
5. **Removed mode leftovers** — deleted the dead `setTool` method and the unused `UiState.tool` field; trimmed the controller `tools` map to `{ modeless, contract }`; dropped the now-unused `SelectTool/WireTool/PokeTool/InkTool` imports (the classes stay exported from `@logicsim/canvas`).

## Acceptance — verified live (real PointerEvent pipeline via `window.__logicsim`)
- Header has **no Select/Wire/Poke**; default tool is `modeless`; tab + brand read **QuadState**.
- Tap `in1` cycles `1 → X → Z` with **no tool change**; XOR output updates.
- Drag IN-pin → AND-pin creates a wire (valid snap preview); palette-drag places one part (ghost), not left armed.
- **Inspector** (on a chip) renders: section label = `--text3`, name = `--text1`, export = `--surface1/--text2`; pin values use canonical signal colors (`1`=`#43D689`, `0`=`#3F72B0` — the off-spec `#3fd68f` is gone).
- **Watch**: button enables on wire-select → adds a row (value in signal color + `.icon-x` remove) → disables (wire already watched).
- **Why?**: poke to X → `Why is this X?` → card shows token `X` in `#E8554E`, verdict + drivers, `.icon-x` close.
- No console errors during any of the above.

## Build checks
- `pnpm typecheck` clean.
- **95 tests pass** (engine 19 / schema 31 / document 23 / canvas 22).
- `vite build` succeeds (162 modules).

## Exact files changed
| File | Change |
|---|---|
| `packages/canvas/src/tools/modeless.ts` | **NEW** — `ModelessTool` (modeless default: poke / select / wire-drag / move / marquee). |
| `packages/canvas/src/index.ts` | Export `ModelessTool`. |
| `apps/web/src/lib/controller.ts` | Modeless default tool; `beginPaletteDrag` works without proto; `Esc` disarm/clear; removed `setTool` + `UiState.tool`; added `canWatch`; trimmed `tools` map + imports; save/export filenames → `.quadstate`. |
| `apps/web/src/App.svelte` | Removed mode-button segment; single `onpointerdown` palette handler; ungated stamp banner; rail wording + unified `.icon-x`; disabled `+ Watch`; `ui` initializer updated. |
| `apps/web/src/lib/Inspector.svelte` | Re-skin to tokens + `signalColor()`; `INSPECTOR` label; nests in rail. |
| `apps/web/src/lib/storage.ts` | File-picker description "QuadState project"; capacitor load path → `circuit.quadstate.json`. |
| `apps/web/index.html` | `<title>` → QuadState. |

## How to reproduce
1. `pnpm --filter @logicsim/web dev` → open the app → **+ New circuit**.
2. Drag parts from the palette; drag pin→pin to wire; click an `IN` to cycle its state — all with no tool switching.
3. Select a wire → `+ Watch selected wire` (it disables once watched). Poke an input to **X**, select the X wire → **Why is this X?**.
4. (dev) **XOR demo** seeds a running, immediately-pokeable circuit.

## Slice status
P0 (re-skin) → P1 (Home/Resume) → P2 (Watch) → P3 (Why?) → P4a (modeless + branding) → **P4 (polish) DONE**. The core-loop vertical slice is complete and on-brand.

## Deliberately still deferred (per the brief)
Buses, Create Chip polish/hierarchy dive (proto-only), Share/Export sheet, iPad/Pencil, motion spec, distinctive brand mark. Do not start without instruction.

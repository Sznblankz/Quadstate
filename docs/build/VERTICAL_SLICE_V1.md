# QuadState — Vertical-Slice Prototype: Implementation Plan

**Phase:** Build planning (first since the visual phase). **Date:** 2026-06-13
**Canonical visual reference:** `docs/product/VISUAL_SYSTEM_SUMMARY.md` (tokens, signal language, components — source of truth).
**Goal:** a working app slice of the core loop, not completeness.

## 0. The decisive fact: this is not greenfield

The M1–M6 codebase already implements most of the *logic* this slice needs — the 4-value engine, the worker, the document model, the canvas tools, and a layered renderer all exist and work. **The new work is almost entirely (a) re-skinning to the approved visual system and (b) three targeted additions** (Home, Watch panel, Why? card). Planning this as a fresh build would waste the most valuable asset we have. So this plan is **reuse-first**, and the smallest first milestone is a *re-skin of the already-working editor*.

Legend: ✅ exists & reusable · 🔧 exists, adapt · 🆕 new for the slice.

| Core-loop item | Status |
|---|---|
| 4. Place primitive gates | ✅ `PlaceTool` · 🔧 draw silhouettes not boxes |
| 5. Move parts | ✅ `SelectTool` drag + snap |
| 6. Wire pins | ✅ `WireTool` / `ContractTool` (union-find nets) |
| 7. Simulate 0/1/X/Z | ✅ `packages/engine` + worker + `SimBridge` |
| 8. Signal state on wires | 🔧 `renderSignals` exists — rewrite to the approved language |
| 3. Editor shell | 🔧 `App.svelte` + `AppController` exist — re-skin/re-layout |
| 1. Home · 2. Resume | 🆕 (storage adapters ✅; the screen is new) |
| 9. Basic watch | 🆕 (probing ✅ via `bridge.probe`; the panel is new) |
| 10. Basic Why? (X/Z) | 🆕 provenance query (engine exposes `driverValue`/netlist) |

---

## 1. Recommended tech stack — keep what's proven

No stack change. The M1–M6 stack is the locked architecture and it works; re-choosing it would be churn.

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript (strict)** | Already the whole codebase; types are load-bearing for the netlist boundary. |
| Repo | **pnpm monorepo** (`packages/*`, `apps/web`) | Exists; clean engine/UI separation. |
| UI shell | **Svelte 5 + Vite** | Exists; tiny runtime, fast HMR; chrome is thin over a framework-free controller. |
| Canvas | **Layered Canvas2D** (4 stacked canvases) | Exists; ample for hundreds of parts at 60fps. **No WebGL** for the slice. |
| Engine | **TS delta-cycle simulator in a Web Worker** | Exists; 3–6M events/sec, keeps the UI thread free. |
| Storage | **`StorageProvider`** (FS-Access / download) | Exists; web adapter is enough for the slice. |
| Tests | **Vitest** | Exists; 95 tests green. |

**Deliberately not adding:** React, WebGL/WebGPU, a state library (the controller is the store), CRDT/multiplayer, Tauri/Capacitor builds (web-only slice).

---

## 2. App architecture — extend, don't restructure

```
packages/
  engine/    ✅ Simulator (4-value, worker-side), netlist
  schema/    ✅ part defs, elaborate() → flat netlist, content-hash ids
  document/  ✅ Component/Wire/PortRef, commands+undo, Selection, nets (union-find)
  canvas/    ✅ Viewport, SpatialGrid, GestureRecognizer, tools, layered renderer
            🔧 renderer re-skin + signal language ; 🔧 gate silhouettes
  ui/        🆕 (optional) shared design tokens module (or inline in apps/web)
apps/web/
  AppController.ts   ✅ framework-free controller (the store + orchestration)
  App.svelte         🔧 re-skin to editor shell (header/palette/right-rail)
  HomeView.svelte    🆕 Home screen
  lib/sim/bridge,worker  ✅ + 🆕 provenance message for Why?
  lib/WatchPanel.svelte  🆕
  lib/WhyCard.svelte     🆕 (tethered overlay)
```

- **Pattern (keep):** a **framework-free `AppController`** owns document, selection, viewport, bridge, and pushes a `UiState` to a thin Svelte shell. New panels (Watch, Why?) read from the controller; no new state framework.
- **View switch (not a router):** `App.svelte` toggles **Home ⇄ Editor** on one `view` flag — the two-shell model, no routing library.
- **Data flow:** edit → `document` command → `recompile()` → `SimBridge.compile()` (schema `elaborate`) → worker loads netlist → worker streams net-value snapshots → renderer paints the signal layer. Already wired; we extend the snapshot path with a **provenance query** for Why?.

---

## 3. Data model for circuits — use the existing document model

Reuse `packages/document` as-is for the slice:

- **`Component`** `{ id, part, x, y, rot, props }` — stable monotonic `EntityId`s, never regenerated.
- **`Wire`** `{ id, ports: PortRef[] }` — a wire connects ≥2 ports; **wires sharing a port merge into one electrical net** (union-find, `nets.ts`).
- **Parts (slice set):** `io:in`, `io:out`, `builtin:and/or/xor/nand/nor/not/buf/tri`, `builtin:dff`, `builtin:clock`. All **1-bit** for the slice.
- **Commands + undo:** `addComponent`, `moveComponents`, `addWire`, `removeEntities` — every edit is one undoable command (exists).
- **Persistence:** `projectToJson` / `projectFromJson` (document + content-hashed part library).

**Deferred from the model for v1:** bus widths (1-bit only — no width prop UI), groups, ink strokes (keep the layer, no tool), chip creation/library growth.

---

## 4. Simulation model — already done; expose one new query

- **Engine (reuse):** 4-value (`LO/HI/X/Z`) **delta-cycle discrete-event** simulator, **integer ticks**, deterministic, in a **Web Worker**. Nets default to **Z**; contention → **X**; oscillation → diagnostic.
- **Flow (reuse):** `SimBridge.compile(doc, lib)` → `schema.elaborate()` flattens to a `CompiledNetlist` → worker `load` → worker streams `snapshot { values, time }` → renderer + watches read `netValues`.
- **Always-on sim** for the slice (the engine is fast enough): poke an `io:in` → settle → snapshot. Keep the existing run/pause/speed controls (free); a full transport (step/trace) is **deferred**.
- 🆕 **Provenance query (the one new sim feature, for Why?):** a worker message `why(net)` returning a classification + drivers, computed from the netlist fan-in + `driverValue(node)`:
  - **Contention** → ≥2 nodes drive the net with conflicting non-Z values → list them with values.
  - **Floating** → no driver, or all drivers Z → name the undriven input.
  - **Uninitialized** → the driving node is a DFF still at X (never reset).
  Combinational, single-net, current-state only for v1 (the honest "sequential history not recorded yet" message is text, no time machine). Feasible today: the engine already exposes `driverValue`, `value`, and the netlist topology.

---

## 5. Rendering approach — keep the layers, rewrite the paint

**Keep:** 4 stacked canvases (`schematic` / `signals` / `ink` / `overlay`), a central `Viewport` (world↔screen), `SpatialGrid` hit-testing, per-layer dirty flags. This is the right architecture at this scale; **Canvas2D, no WebGL.**

**Rewrite to the approved language (the core visual work):**
- **`renderSignals`** → the 4-state language: `1` green `#43D689` solid **+ halo** (a wider translucent underlay line — cheap, no blur), `0` blue `#3F72B0` flat ~85%, `X` red `#E8554E` **dash-dot** `[9,4,2,4]`, `Z` gray `#8A93A3` **dash** `[6,5]` ~70%. **Thickness stays 1-bit base** (bus thickness deferred but the channel is reserved in code).
- **`renderSchematic`** → **gate silhouettes** (the approved paths: AND D-body, OR/XOR shields, NOT triangle+bubble, DFF rect+clock-notch) with `--part-stroke`, `--part-fill`; selection = indigo ring + glow.
- **Tokens:** a single `tokens.ts` (the §1 palette from the summary) consumed by the renderer and the Svelte chrome — one source for both.
- **Chrome (HTML/Svelte over the canvas):** header (home/breadcrumb stub · transport · health stub · share stub), palette (left, silhouette tiles), right rail (Inspector over Watches), Why? card overlay. All from the approved component specs.

---

## 6. Milestone plan — small, each independently demoable

| # | Milestone | Contents | Demo |
|---|---|---|---|
| **P0** | **Re-skin foundation** *(smallest — §8)* | `tokens.ts`; rewrite `renderSignals` to the 4-state language; gate silhouettes; re-layout `App.svelte` to the editor shell (dark `#0B0D11`, indigo selection, header/palette/right-rail). **No logic changes.** | Open app → place gates → wire → poke → see correct 0/1/X/Z signals on a dark, QuadState-looking canvas. |
| **P1** | **Home + resume** | `HomeView.svelte` (Continue card from recents, New, Open), `view` switch, recents from storage. | Launch → Home → Continue/New → Editor; back to Home. |
| **P2** | **Watch panel** | promote a probed net to a `WatchPanel` row (name · live value · state color); right-rail Watches region. | Click a wire → +watch → value updates live as you poke. |
| **P3** | **Why? card (X/Z)** | worker `why(net)` provenance + `WhyCard.svelte` (tethered, verdict, cause rows w/ jump); contention/floating/uninitialized. | Make a contention → click the red wire → "Why?" → card names both drivers. |
| **P4** | **Slice polish** | neutral refusal hints, focus rings, empty states, health-count stub, breadcrumb stub (no dive). | A coherent, demoable core-loop slice. |

Sequencing rationale: **P0 first** because it converts the existing working app into a recognizably-QuadState one with the least effort and de-risks the visual language early. P1–P3 add the missing surfaces in increasing newness (Home reuses storage; Watch reuses probing; Why? is the only net-new engine work).

---

## 7. Risks & simplifications

| Risk / question | Simplification for v1 |
|---|---|
| **Why? provenance** is the only net-new engine logic | Combinational, single-net, current-state classification only; the sequential-history message is honest text, no time machine. Ship contention + floating + uninitialized; nothing deeper. |
| **Interaction model is modeless** (approved) but existing tools are mode-based and *work* | Slice keeps the **working tool-based interaction**, re-skinned. Fold in the modeless `ContractTool` as a fast-follow — don't block the slice on it. |
| **Signal-language perf** (halos) | Halo = one extra translucent underlay stroke per lit wire; trivial. No blur filters (they flash + cost). |
| **Home/Editor as two screens** | One `view` flag, not a router. Recents = last-N from storage; static save-time thumbnail (or a placeholder) — no live thumbnails. |
| **Bus rules** | Out of scope — 1-bit only; thickness channel reserved in code but unused. |
| **Create Chip / hierarchy / share / iPad / motion** | Deferred per the brief. Breadcrumb/health/share render as inert stubs so the shell is complete-looking. |
| **Gate silhouettes** = illustration work | Use the approved paths from the symbology pass; monochrome, one stroke — already specified. |
| Determinism / cross-platform | Not a slice concern (web-only); the engine already guarantees it. |

**Guiding rule:** when a choice is "make it work" vs "make it complete," choose working. Stubs over absences (an inert breadcrumb beats a missing header region).

---

## 8. The smallest buildable first milestone (P0)

**Re-skin the already-working editor to the approved visual system — zero new logic.** This is the highest-leverage first step because the place/move/wire/simulate loop *already runs*; P0 makes it *look like QuadState* and proves the signal language in the real renderer.

Concretely, P0 is four edits:
1. **`apps/web/src/lib/tokens.ts`** — the §1 token palette (one module, imported by renderer + Svelte).
2. **`packages/canvas/src/render/renderer.ts` → `renderSignals`** — implement the 4-state language (green+halo / blue-flat / red dash-dot / gray dash), thickness 1-bit base.
3. **`renderSchematic`** — swap gate boxes for the approved silhouettes; selection = indigo ring + glow; canvas bg `#0B0D11`, dot grid `--grid-dot`.
4. **`App.svelte`** — re-layout to the editor shell (header / 212px palette with silhouette tiles / right-rail) using tokens; retire the old toolbar colors.

**Definition of done for P0:** launch the web app, place an XOR + two inputs + an output, wire them, poke the inputs, and watch the output wire render the correct live state in the approved signal language on a dark QuadState canvas with indigo selection — *all on the existing engine and tools, no new logic.* That is a working, on-brand vertical-slice skeleton in the fewest possible moving parts, ready for P1–P3 to hang the new surfaces on.

---

## 9. Next step
Build **P0**. It reuses everything that works and yields an immediately demoable, on-brand slice; P1 (Home), P2 (Watch), P3 (Why?) then add the missing surfaces in order of increasing novelty.

# QuadState — Interaction Prototype: Session Runbook

The gray-box prototype (design doc 4) is built into the web app behind a flag.

## Running it

```
pnpm --filter @logicsim/web dev
```

Open **http://localhost:5173/?proto=1** — the flag enables the doc-3 interaction
contract. Without it the app behaves exactly as before (legacy tools).

## What the flag enables

| Area | Contract |
|---|---|
| Modeless canvas | Drag from a **pin** = wire · drag a **part** = move · drag **empty** = marquee (full enclosure) · tap wire = select + faint whole-net highlight · Shift-click toggles |
| Wiring | Drop on pin = connect · drop on a wire = junction (nets merge) · drag from a wired pin = branch · tap a pin = click-click chain (taps add waypoints, Esc cancels) |
| Placement | **Drag from the palette = place one part where dropped** (the §5.1 primary route); palette *click* = arm the repeating stamp |
| Stamp mode | `A O N X I U D` load a ghost on the cursor; each click stamps; **Esc puts it down**. Digits before `I`/`U` set bus width (e.g. `8` then `I`) |
| Space | **Tap = play/pause** · **hold + drag = pan** (movement is the discriminator; the 180 ms timer only guards the no-move case — tune live via `__logicsim.protoConfig.spaceTapMs`) |
| Transport | LIVE/PAUSED chip in the header · `S` steps one clock cycle while paused |
| Escape ladder | cancel gesture → exit stamp mode → deselect → surface one hierarchy level |
| Create Chip | Select a cluster → **Ctrl+G** → chip collapses in place with an inline name field |
| Hierarchy | **Double-click** a chip = dive into the live instance (read-only, real signal values) · breadcrumb · Esc = up · **Home** = top |

## Instrumentation

Everything logs through `window.__logicsim.logger` (DevTools console):

- `__logicsim.logger.summary()` — headline rates: space histogram, probable
  false toggles, **suspect pauses** (paused intervals never used before
  resuming = the silent-pause worst case), misfires (undo-within-2s heuristic).
- `__logicsim.logger.startTask("name")` / `endTask("name")` — task timers for
  the doc-4 §4 script.
- `__logicsim.logger.exportJson()` — full event log. Save each session's
  output as `docs/product/validation/session-<n>.json`.

## Session protocol

Run the doc-4 §4 script (~30 min, think-aloud). Adjudicate each card against
its §3 gates afterward; amend `EDITOR_INTERACTION_MODEL.md` with the results.

## Known harness limitations (gray-box honest, not bugs)

- Click-click **waypoints guide the preview only**; committed wires render
  hub-routed (multi-segment wire geometry is a post-plan backlog item).
- Junctions connect to the hit wire's **nearest port** rather than mid-segment
  (electrically identical via net merge; rendering differs).
- Dive interiors use a deterministic **auto-layout grid** (definitions store
  structure, not layout).
- Dive entry **clears the canvas selection** — the double-click's first tap
  selects, and without this Esc rung 3 silently ate a press before rung 4
  could surface. This is a harness-discovered contract note for Card F's
  adjudication.
- Glance/probe/watch and Why? are out of scope (per doc 4 §1).

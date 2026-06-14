# QuadState — Bus UX

**Phase:** Visual + interaction design — document 9
**Date:** 2026-06-13
**Status:** Draft for review
**Fixed context (do not redesign):** VISUAL_EDITOR.md (approved — signal language, tokens, panels, Why? card + its placement), EDITOR_INTERACTION_MODEL.md §5.3 (width-flows-from-pins), SIMULATION_DEBUGGING_UX.md §3.1 (bus display), COMPONENT_LIBRARY.md §B (bus/mem primitives). **Engine facts:** 64-bit bus cap; splitter/merger/register/mux/decoder/constant are width-parametric primitives; union-find net merge; 4-state per-bit semantics.
**Mandate:** extend the approved editor. This document **resolves the two "bus-pending" carve-outs** the editor design left open — the bus *aggregate rendering rule* (§4) and the watch *bit-strip content* (§6) — plus the broader bus interaction/IA. No new colors, no new panels, no new tools.

**The one governing idea:** a bus is just a wire whose pins are wider than one bit. Everything below follows from that — width comes from parts, thickness shows it, the stroke shows *drive-health*, and the *value* lives in the panel. The reserved 4-state language is reused verbatim; buses add exactly **one** derived wire appearance and **one** panel element (the bit-strip), nothing more.

---

## 1. How users create buses

There is **no bus tool.** Buses emerge from pin widths (the modeless, target-decides doctrine). Three concrete paths, all using existing gestures:

1. **Set a width, then wire.** Parametric parts (IN/OUT, register, constant, mux, splitter, chip pins) carry a `width` prop — set by the inspector stepper or the **numeric-prefix stamp** (`8` then `I` = 8-bit input, already in the prototype). Wire two equal-width pins → the wire is born a bus and renders thick automatically. Width is a property of *parts*, never of the wire you draw.
2. **Bundle with a merger.** To gather N separate 1-bit signals into one bus, drop a **merger**; to break a bus apart, a **splitter** (§2).
3. **Adapt on connection.** Dropping a bus wire onto a narrower pin offers *insert splitter* rather than refusing (§9) — creation by repair.

Buses are **nets**, so they're named by **net labels** (§7), not by naming the wire.

---

## 2. How splitters work

A **splitter** maps a bus to sub-ranges; a **merger** is its mirror. Both are width-parametric primitives.

```
        ┌──────────┐                         splitter taps are RANGE-LABELED
  bus →══╡ SPLIT    │──[7:4]══►  (a 4-bit sub-bus)
   (8)   │          │──[3:1]══►  (a 3-bit sub-bus)
        │          │──[0] ─►    (a single bit, thin)
        └──────────┘
   inspector edits the tap list: each tap = a bit-range field.
   defaults: "per-bit" (0..n) or "high/low nibble" preset.
```

- **Canvas:** a compact part — one bus pin on the wide side, fanned taps on the other, each tap **labeled with its range** (`[7:4]`, `[0]`). Tap thickness follows its sub-width (the reserved channel applies recursively).
- **Editing ranges:** the inspector shows the tap list; each tap has a range field (`7:4`) and reorder. Overlapping/duplicate ranges flag inline.
- **Auto-insert:** dropping an 8-bit bus on a 1-bit pin offers *insert splitter → tap [0]* (or pick a bit); dropping mixed widths offers a splitter/merger that makes the mapping valid (§9).

---

## 3. How bus width is shown on canvas

Two cues, both already reserved:

- **Thickness** (the reserved channel): 1-bit = base; **2–8 bit = +60%**; **9–64 bit = +120%**. Three legible tiers — a bus *looks* like a bus before any label or color.
- **Width tag:** a small **mono** number at the wire midpoint (or at the driving pin) — `8`, `16`, `32`. Exact width when the tier isn't enough. **1-bit wires carry no tag** (no clutter); tags appear only on buses.

Thickness says "this is a bus and roughly how wide"; the tag says "exactly." Neither uses color — color stays on state.

---

## 4. Mixed bus states — the aggregate rule *(resolves bus-pending carve-out #1)*

A bus is one stroke summarizing N bits. **On a bus the stroke shows drive-health; the value lives in the panel.** (On a 1-bit wire the stroke still shows the literal state — thickness disambiguates the two readings.) Precedence, top wins:

| # | Condition | Wire appearance | Reads as |
|---|---|---|---|
| 1 | **any bit X** | **red dash-dot** (bus thickness) | "contains an unknown — look inside" |
| 2 | else **any bit Z** | **gray even-dash** | "partially floating" |
| 3 | else **all bits 1** | **green solid + halo** | uniform high |
| 4 | else **all bits 0** | **blue solid, flat** | uniform low |
| 5 | else **mixed 0/1, fully driven** | **green solid, no halo** | "driven & known — value in panel" |

This reuses the 4-state language exactly and adds **one** new derived appearance: case 5, *green-solid-no-halo* = "a healthy data bus carrying a real value." The design payoff on a real datapath: **healthy buses are calm green ribbons; trouble (X red dash-dot / Z gray dash) jumps out** against them — exactly the "bugs announce themselves" hierarchy from the editor. X dominates because a single unknown bit makes the bus value partly unknown; that's the signal worth interrupting for.

Rationale note (reviewable): cases 3–5 mean an all-zero bus shows blue and everything else driven shows green — buses report *drive-health*, not their numeric value, because one stroke can't honestly encode 8 different bit values. The number is one glance/panel away.

---

## 5. Bus values in the watch panel

The collapsed watch row is unchanged in shape; bus values fill it per the **4-state-honest base rendering** (debugging doc §3.1):

```
WATCHES
▸ pc      0x1F   hex   ▕▏▕ ▏▕▏      (clean 8-bit value)
▸ bus_a   0x3X   hex   ▕▕▏▕▕▏      (nibble 0 contains an X → digit shows X, red)
▸ addr    0xZZ-- gray  ▕ ▏ ▏        (upper byte floating → Z digits, gray)
```

- **Base toggle per row:** `hex | bin | dec | signed`. **Hex/bin** render every bit honestly. **Dec/signed** require all bits known — if any X/Z, the value shows `—` (uncomputable) with a tiny state glyph, never a fake number.
- **4-state-honest digits:** a hex nibble containing any X → that digit is **`X` (red)**; any Z (no X) → **`Z` (gray)**; else the digit. One bad bit in 64 stays findable at the digit level, fully discoverable at the bit level (§6).
- **Mini-trace by width:** 1-bit = the step-line (as approved); **bus = a change-tick band** (a tick at each cycle the value changed) — compact activity, not an attempt to plot 8 lines.

---

## 6. Expanded bit-strips *(resolves bus-pending carve-out #2)*

Disclosure `▾` expands a bus row into a **bit-strip** — the per-bit truth:

```
▾ bus_a   0x3X   [ hex | bin | dec ]
  ┌─────────────── nibble 1 ──────────┬────────── nibble 0 ─────────┐
  │  1    0    1    1   │   0    0    X    1                         │
  │ [7]  [6]  [5]  [4]  │  [3]  [2]  [1]  [0]                        │
  └────────────────────┴────────────────────────────────────────────┘
   each cell: state fill + the LITERAL digit (0/1/X/Z) in mono  (never color-only)
   nibble separators; MSB left, LSB right
```

- Each **cell** = state color fill (muted, since many) **plus the literal digit** in mono — satisfies "never color alone" at cell scale; X cells also carry the dash-dot micro-texture.
- **Grouping & wrapping:** cells group by **nibble** (subtle separators); wide buses wrap at 16/row (a 64-bit bus = 4 rows of 16, byte/nibble grouped). Readable, not a 64-wide smear.
- **Per-bit affordances:** hover a cell → "bit 1 = X" + its cause; a problem cell offers **→ why?** (jumps into §10). If the bus is split, a cell can jump to that bit's driver.
- The **base toggle** lives in the expanded header; **1-bit watches still expand** (to a single cell + taller trace) so the row IA is uniform — exactly the "expandable from day one" constraint, now with its multi-bit content defined.

---

## 7. Probe, watch, rename, inspect

All reuse the approved inspection gradient and inspector:

- **Glance** (hover, stillness-gated): transient readout = aggregate value in current base + width (`0x1F · 8`). 
- **Probe** (Alt-click): pins the readout to the bus; if X/Z, it carries **why?**.
- **Watch** (`W` / +watch): adds the expandable bus row (§5–6).
- **Rename = net labels.** You don't name a wire; you name its **net**. An inline label field (watch row or inspector) sets a net label, which renders as a **small mono chip on the wire** (`pc`, `bus_a`) and is reused everywhere the net appears (watch, inspector, Why?). Bus nets benefit most — labels turn an anonymous ribbon into "the program counter."
- **Inspect** (select a bus wire): the inspector shows **width · resolved aggregate · a mini bit-strip · driver(s) · net-label field**. Select a *part* with bus pins → each pin lists width + value. (Inspector layout is the approved one; this is its bus content.)

---

## 8. Connecting to registers, muxes, constants, chips

The universal rule: **bus connections require width agreement** (else §9). Per part:

- **Register:** D/Q are buses of `width`; a small `8` tag on the body; stored value shown on hover/inspector (4-state-honest). Wiring an 8-bit bus to an 8-bit register just works.
- **Mux:** N data inputs + output are buses of `width`; the **select** pin is its own narrow input (`ceil(log2 N)` bits). Visual: trapezoid, bus data pins one side, narrow select pin on the angled edge, bus output the other side.
- **Constant:** drives a literal of `width`; the part **displays its value** (`0x2A`) and width; value edited in the inspector; on canvas it's the source of a calm green driven bus.
- **Chips:** interface pins may be buses (declared in the definition). Bus pins render thicker with width tags on the chip body; diving in, the pin appears as a boundary bus. Width must match on connect.

Across all four, the part shows **width** at rest and **value** on glance/inspect — wire = health, part/panel = value, consistently.

---

## 9. Width mismatch & floating bus bits

- **Width mismatch (during wiring):** the live preview turns to the invalid treatment + an inline label of **both widths** — `8 ✗ 4`. On drop, rather than a dead refusal, offer **insert splitter / merger / adapter** when a sub-range mapping is sensible (§2); otherwise a plain-language refusal at the pin ("can't connect an 8-bit bus to a 4-bit pin"). Never a modal.
- **Floating bus bits:** bits left undriven read **Z**; the bus shows the Z aggregate (gray dash, §4 rule 2). The **bit-strip names exactly which** bits float; the **inspector** lists floating indices; **health lint** flags "bus has N floating bits" (construction-dampened so it doesn't nag mid-build). Common case — a 4-bit driver into an 8-bit bus — shows Z-aggregate, and the strip reveals the upper four as Z.

---

## 10. Why? for bus X and Z *(extending the flagship, not rebuilding it)*

The approved Why? card (and its collision-aware placement, pass 1.2) is reused unchanged in form; for a bus it **decomposes into per-bit causes**:

```
┌──────────────────────────────────────┐
│ [X] Why is bus_a partly unknown?      │   header: state token + bus question
│                                       │
│ Bit [1] is X — two drivers disagree.  │   ← verdict names the bits (the hero)
│ Bit [6] is Z — nothing drives it.     │
│                                       │
│  ▕1▏0▏1▏1▏0▏0▏X▏1▏   (strip, bad bits lit) │
│  · reg_hi.q[1] = 1        → jump      │   per problem-bit cause rows
│  · alu.y[1]    = 0        → jump      │
│  · (bit 6)     undriven   → jump      │
│                              [Done]   │
└──────────────────────────────────────┘
```

- **Header:** "Why is bus_a partly unknown?" with the state token.
- **Verdict (the hero):** names the offending **bits** and their kind ("Bit [1] is X — contention; bit [6] is Z — floating").
- **Evidence:** a **mini bit-strip** with the bad bits lit, then one cause row per problem bit (drivers for X bits with their conflicting values as signal chips; "undriven" for Z bits), each with **→ jump** — jumping pans/dives to that bit's driver, *through a splitter if needed*.
- Placement, scrim, leader line, accessibility mirror: all the approved behavior, unchanged. The honest sequential-boundary verdict still applies per bit (a register bit that captured X at an earlier edge).

A bus Why? is just the single-net Why? run per problematic bit and grouped — the flagship scales to buses with no new machinery.

---

## 11. What this added (extension audit)

- **New colors:** none. The 4-state palette is reused verbatim.
- **New wire appearance:** exactly one — case 5, *green-solid-no-halo* (mixed driven bus).
- **New panel element:** the **bit-strip** (the editor already reserved its row container).
- **New canvas elements:** the **width tag** and **net-label chip** (both small mono, monochrome).
- **New parts:** splitter/merger/register/mux/constant were already scoped (doc 5 tier B); this gives them their bus behavior, not new identity.
- Everything else — thickness reservation, Why? card + placement, inspection gradient, inspector, health lint, transport — is reused as approved.

## 12. Open questions

1. ~~All-zero bus = blue~~ **CONFIRMED 2026-06-13** — all-zero reads blue (matches scalar `0`); mixed-driven uses green **without** glow so it never looks identical to all-1. Aggregate rule §4 is locked.
2. **Bus mini-trace** as a change-tick band — sufficient, or do power users want a tiny per-bit heatmap? (Recommend band for v1; heatmap is a later affordance.)
3. **Net-label canvas density** — labels on every bus could clutter; default to showing labels only for *named* nets and on hover/selection for the rest. Confirm.
4. **Splitter default mapping** — per-bit vs high/low-nibble as the out-of-the-box tap set.

## 13. Next steps

1. Review; confirm the §4 aggregate precedence and §6 bit-strip — they were the editor's deferred items and everything bus-shaped depends on them.
2. Update VISUAL_EDITOR.md's two bus-pending notes to "resolved by doc 9."
3. Then the remaining surfaces (Create Chip, Share sheet, Settings) — which inherit tokens, the signal language, and now bus behavior with little new invention — and the part-symbology illustration pass extended to the bus/mem parts.

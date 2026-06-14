# QuadState — Visual Design: Editor

**Phase:** Visual Design — document 8 (the primary product surface)
**Date:** 2026-06-13
**Status:** Draft for review · **refined 2026-06-13 (pass 1.1)** — Why? card (confident, tethered), palette armed state (quieter), primitive gate symbology (silhouette illustration pass). · **pass 1.2** — Why? card *placement behavior* (collision-aware, never clipped by panels). All other direction unchanged.
**Fixed structure:** WIREFRAMES.md §3 (editor zones). **Baseline visual language:** VISUAL_HOME.md (tokens). **Behavior governed by:** SIMULATION_DEBUGGING_UX.md, EDITOR_INTERACTION_MODEL.md.
**The question this design must answer:** *"Does QuadState feel like a modern creative tool for building digital systems?"* Every decision below is in service of "yes."

**Locked constraints (carried in by direction):**
1. **Stroke thickness is reserved for bus width** and future bus semantics — states may never use it.
2. **The watch row is expandable from day one**, even before advanced bus interactions ship.
3. **Signal states never rely on color alone** — every state carries a redundant non-color channel.
4. **The Home visual language is the baseline** — dark surfaces, reserved signal colors, indigo accent, restrained chrome.

Two pieces are explicitly labeled **v1 — bus extension pending** (the agreed carve-out): the signal language's *bus aggregate treatment*, and the watch row's *bit-strip content*. Their containers and reservations are designed now; only the bus-specific fill is deferred.

---

## 0. The signal state language (the centerpiece)

This is the brand system — the one visual artifact unique to QuadState and the literal embodiment of its name. It must satisfy all four constraints simultaneously. Channel allocation, decided:

- **Color** → hue identity per state (from the reserved palette).
- **Stroke pattern + glow** → the redundant non-color channel (grayscale-safe).
- **Stroke thickness** → *reserved for bus width only.* Never touched by state.

### The four states

| State | Meaning (the fixed gloss) | Color | Non-color channel | Reads as |
|---|---|---|---|---|
| `1` HIGH | "the wire is driven high" | `#43D689` green | **solid + soft halo** (the only state that glows) | alive, energized |
| `0` LOW | "driven low" | `#3F72B0` dim blue | **solid, flat, slightly recessed** (~85% opacity, no glow) | resting, quiet |
| `Z` | "disconnected — nothing is driving this" | `#8A93A3` gray | **even dashes** (`6 5`), ~70% opacity | hollow, absent |
| `X` | "unknown — the circuit can't decide" | `#E8554E` red | **dash-dot** (`9 4 2 4`), irregular, no glow | wrong, broken |

Why this set survives every constraint:
- **Grayscale-safe (constraint 3):** solid-flat (`0`) vs solid-glowing (`1`) vs even-dash (`Z`) vs dash-dot (`X`) are four distinct stroke signatures with no reliance on hue. Luminance reinforces (`1` brightest, `0` recessed). A colorblind Builder reads state from pattern + glow alone.
- **Thickness untouched (constraint 1):** the four states are distinguished entirely by color + pattern + glow. A `1` and a `0` are the *same width*; only the bus changes width. So a thin green-glow line is "1-bit high," a thick green-glow line is "an 8-bit bus resolving high" — width and state are orthogonal, readable together.
- **`X` looks wrong on purpose** (debugging doc §4.5): the irregular dash-dot is deliberately the least "designed," most alarming texture. You spot an `X` across the canvas before you read its color.
- **The halo is the product's quiet signature:** the live-high wire is the brightest, softest-glowing thing on screen — the work, glowing, exactly as the reserved-color rule demands.

### Buses (containers now, aggregate fill **v1 — pending**)

- **Width → thickness**, the reserved channel: 1-bit = base stroke; 2–8-bit = +60%; 9–64-bit = +120%. A bus *looks* like a bus at a glance, before any label.
- A bus also carries a small **width tag** (`8`, mono) at its midpoint or near its driving pin.
- **Aggregate state on the bus line:** **resolved by BUS_UX.md §4** (precedence: any X → red dash-dot; else any Z → gray dash; else all-1 → green+halo; all-0 → blue; mixed-driven → green solid no-halo). The per-bit truth lives in the watch panel's bit-strip. The bus stroke shows *drive-health*; the *value* is read in the panel. *(Was bus-pending; now finalized.)*

### Transitions (motion hook, deferred)

Steady state is fully static (product doc §8). At the *moment* a wire changes state, a ~110ms cross-fade of color+pattern plays — perceptible as "it changed," never ambient. At Max sim speed, states snap (no queued animation — honesty over theater). Specced here only so the renderer reserves the hook; motion is its own phase.

---

## 1. Design rationale

**The canvas is the room; the chrome is furniture pushed to the walls.** The editor is 95% of all user time, so the design's first act is to get out of the way: a near-black canvas fills the frame, panels are dark and hairline-separated so they read as instruments resting *above* the world rather than walls boxing it in. The brightest pixels on the entire screen are signal states on the wires — the work glows, the UI never does. That single discipline is what separates "creative tool" from "engineering software": in Logisim the chrome shouts and the circuit is flat clip-art; here the chrome whispers and the circuit is the only thing alive.

**Modeless, so the tool never nags you into a mode.** There is no wall of tool buttons. The canvas is one resting state and the target under the pointer decides the verb (per the interaction contract). What little persistent chrome exists — transport, palette, inspector, watches — is each collapsible to nothing, so a Builder in flow can reduce the entire application to header + canvas. Figma's lesson, applied: the confident move is to show less.

**Debugging is woven into the surface, not bolted to the side.** No console, no separate debug perspective. Probes pin to wires, watches live in a rail with their own history, `Why?` highlights causes *on the circuit*, and health is a quiet counter that lets the canvas wear its own errors (an `X` wire already looks wrong). This is the humane, integrated feel of a modern creative app rather than the modal-alert anxiety of EDA tools.

**Premium through restraint, exactly as Home established.** One accent color (indigo, and it means "your focus" — selection and focus rings, nothing else). Two type families. Tabular numerics everywhere values live. Soft elevation instead of hard borders. The richness comes from the signal language and the custom part symbology — earned detail where it matters — not from ornament anywhere else.

**Parts you'd want to look at for hours.** The symbology is a drawn family with one stroke weight and one corner language — distinctive silhouettes that read as circuitry, with a clear visual tell for "this chip has an interior you can dive into." Beauty at close zoom, legibility at far zoom. This is where per-pixel craft is most visible, and where the product earns the right to feel premium.

**Answering the question:** yes — because the canvas dominates, the work glows while the UI recedes, manipulation is direct and modeless, debugging is in-place and calm, and every surface is held to the same restrained, numerate, soft-edged standard. It feels like Figma/Procreate aimed at logic, not like a simulator with a coat of paint.

---

## 2. Refined layout

Desktop reference **1440 × 900**. Three-part header over a three-column body; both side rails collapsible to an icon rail, and a Focus Mode that hides both entirely.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐ 52px header
│ ⌂  8-bit ALU ▸ ALU ▸ [Adder4]      ⏮  ⏸ LIVE  ⏭   ~2kHz ───   t=1,204     ⚠2  ↗Share │ A
├────────────┬───────────────────────────────────────────────────────────┬──────────────┤
│ ▤ search   │                                                           │ INSPECTOR  ▤ │
│ BUILT-IN   │                  · · · · · · · · · · · ·                   │ FullAdder    │ D
│ ▸ AND      │            in1 ●━━━━━━━┓                                  │ → a   1      │
│ ▸ OR       │                  (green-glow = 1)  ┏━━━┓                  │ → b   0      │
│ ▸ XOR      │            in2 ●╌╌╌╌╌╌╌┛ (gray dash┃XOR┃━━━● sum         │ → cin Z      │
│ ▸ NOT      │                  = Z)               ┗━━━┛  (1)           │ ← sum 1      │
│ ▸ DFF/CLK  │                                                          │ ← cout 0     │
│ BUS·MEM    │            a ●·-·-·-·-·  (red dash-dot = X)               ├──────────────┤
│ ▸ SPLIT    │                        ┏━━━━━━┓                          │ WATCHES    ▤ │ E
│ ▸ REGISTER │            b ●━━━━━━━━━━┃ Adder4┃══8══●  (thick = bus)   │ ▸ pc  0x1F ▂▃▅│
│ ▸ MUX      │                        ┗━━⤢━━━┛  (⤢ = divable chip)     │ ▾ bus 0xZX hex│
│ MY CHIPS   │                                                          │   ▦▦▦·▦▥▦▦   │
│ ▸ Adder4   │                  · · · · · · · · · · · ·                   │   7 . . . . 0│
│ ▸ HA       │                                                          │ ▸ cy  1    ▁▆│
│ + Import   │                                                          │ [+ watch]    │
└────────────┴───────────────────────────────────────────────────────────┴──────────────┘
   A  header: [identity + breadcrumb] | [transport, centered] | [health · share]
   B  palette (212px → 48px icon rail → hidden in Focus Mode)
   C  canvas (full-bleed, dot grid, the only saturated pixels live here)
   D  inspector (contextual; empty selection = project overview)
   E  watches (persistent, independent of selection; rows expandable)
```

Decisions made here (not deferred):
- **Transport is centered in the header**, not floating. Rationale: it's the global *stage* control, and centering consolidates chrome (one place to look) and keeps the canvas edge-to-edge clean. The classic silent-pause risk (Card C) is mitigated not by extra chrome but by the **advancing `t=` counter being the liveness cue** — if the tick counter is moving, you're live; if it's frozen with a `PAUSED` label, you're not. Liveness is shown by the thing that's actually true.
- **Identity + breadcrumb left** (where-am-I nav, grouped with the home button); **health + share right** (outbound/meta). Three clean header regions.
- **Right rail is one column, two stacked regions** (Inspector over Watches) with a draggable divider — *not* tabs. Watches must be visible while inspecting a selection, so they can't share a tab slot with the inspector.
- **Palette collapses to a 48px icon rail** (parts one hover away), and a separate **Focus Mode** hides both rails for flow-state work — honoring "collapse to zero" without making the common collapse destroy discoverability.

---

## 3. Visual hierarchy

Top to bottom of attention, by design:

1. **Signal state on the canvas** — the only saturated, only glowing pixels. Reserved-color rule makes the work itself the loudest thing.
2. **The selected object** — indigo ring + faint accent glow. The editor's single accent expression: indigo means "your current focus."
3. **An `X`/contested wire** — the dash-dot red is engineered to pull the eye even against (1). Bugs announce themselves.
4. **Active transient affordances** — wire preview, stamp ghost, marquee, the `Why?` card — brighter than chrome, dimmer than signal.
5. **Chrome text & controls** — `--text-1`/`--text-2` on dark surfaces, quiet and even.
6. **Structural chrome** — panel fills, hairlines, dot grid — barely-there, felt not seen.

Everything not on the canvas is monochrome-neutral + the one indigo accent. No second accent competes. Health, share, transport, palette, inspector — all live in the neutral register so that nothing manufactured out-shouts the real signal.

---

## 4. Component specifications

### Tokens added for the editor (extend Home, don't replace)

| Token | Value | Use |
|---|---|---|
| `--part-fill` | `#14181F` | Component body on canvas (a step above `--bg`) |
| `--part-edge` | `rgba(255,255,255,0.12)` | Chip-rect outline at rest |
| `--part-stroke` | `rgba(255,255,255,0.16)` | **Gate silhouette outline** (slightly stronger so the shape reads) |
| `--part-edge-sel` | `#6C72FF` | Selected outline (2px) + 12% accent glow |
| `--pin` | `#7E93AB` | Pin nodes |
| `--label` | `#AEB6C4` | Part labels (dimmer than primary text) |
| `--grid-dot` | `rgba(255,255,255,0.05)` | Canvas dot grid |
| Signal `1/0/X/Z` | `#43D689 / #3F72B0 / #E8554E / #8A93A3` | **Canvas + watch only — reserved** |

### Header (A) — 52px, `--bg`, 1px `--hairline` bottom

- **Home button** `⌂` 32×32, `--text-2`, hover `--surface-2`. **Project name** 14/600 `--text-1`, inline-editable. **Breadcrumb** appears only at depth >0: `name ▸ Chip ▸ [current]`, ancestors `--text-2` underlined-on-hover, current `--text-1`; separators `--text-3`.
- **Transport cluster** (centered), a `--surface-1` pill group, radius 10, height 34: `⏮` reset · `⏯` play/pause (the state-bearing control) · `⏭` step · a thin speed control (log scale, label `~2kHz`/`Max`) · `t=1,204` in mono/tabular. **LIVE:** pause glyph shown, a small `--accent` dot, counter advancing. **PAUSED:** play glyph, `--surface-3` fill, muted `PAUSED` label, counter frozen.
- **Health** pill (right): `⚠ 2`, monochrome (`--text-1` when >0, hidden at 0). Click cycles findings (`H`/`Shift-H`); the *canvas* shows the red. **Share** button: quiet (`--surface-1`, not filled), `↗ Share`. Overflow `⋯` for window/focus toggles.

### Palette (B) — 212px, `--bg`, 1px `--hairline` right

- Top: **search field**, `--surface-1`, radius 8, 32px. Below: sections with micro-labels (`BUILT-IN`, `BUS·MEM`, `MY CHIPS`, `IMPORTED`).
- **Part row:** 36px, a 28×28 mini-symbol tile (the part's true silhouette) + name (14/450) + an optional **width stepper** for parametric parts (IN/OUT/register/bus parts) showing `1`/`8`/… in mono. Hover → `--surface-2`. **Drag = place one; click = arm stamp** (validated).
- **Armed/active row (refined — quieter):** *no fill.* The indigo is reduced to a **2px `--accent` left bar** + the mini-symbol tile gaining a **1px `--accent` border**, and the label brightening to `--text-1`. The previous `--accent-quiet` background fill is dropped — an armed palette row must never out-weigh a selected object or a live signal on the canvas. Indigo here marks "armed," but as the *quietest* expression of the focus accent; the loudest indigo on screen stays the canvas selection ring, and the loudest pixels overall stay the signals. (Hover may still tint to `--surface-2`; armed + hover simply keeps the bar + border.)
- **Collapsed (48px rail):** just the mini-symbol tiles, grouped by section with hairline dividers; tooltip on hover.

### Canvas (C) — `--bg`, dot grid

- **Dot grid:** `--grid-dot`, 50px world spacing, radius scales with zoom, fades out when zoomed far (existing renderer behavior).
- **Primitive parts (illustration pass — silhouette-first, no longer boxes):** each primitive is a drawn silhouette, not a labeled rectangle. The shape *is* the identity, so classic gates carry **no text label** — the silhouette reads at a glance and at distance. House rules: one consistent stroke (`--part-stroke` 1.7px), `--part-fill` body, soft joins, output **bubbles** as small `--part-fill` circles (r3) for inverting gates, pins as short stubs on a 20px module grid ending in `--pin` nodes. Monochrome only — color stays on the wires.

  | Part | Silhouette |
  |---|---|
  | **AND** | D-body: flat left edge, semicircular right. 2 inputs left, 1 output right. |
  | **OR** | Curved shield: concave back (inputs cross it), sweeping to a rounded point. |
  | **XOR** | OR shield + a second concave arc just behind the back edge (the double line). |
  | **NOT** | Right-pointing triangle + output **bubble** at the apex. |
  | **NAND / NOR** | AND / OR silhouette + output bubble. |
  | **BUF / TRI** | Plain triangle; TRI adds an enable stub on the top edge. |
  | **DFF** | Rectangle (flip-flops are honestly rectangular) but distinguished by a **clock-edge "‹" notch** on the left and small `D`/`Q` pin labels — never a generic box. |
  | **CLK** | Compact body with a square-wave glyph. |

  Only shape-ambiguous parts (DFF, CLK, MUX, decoder, register) keep a short `--label`; the iconic gates do not. This is where "premium vs. simulator" is most visible per pixel — the canvas should read as drawn circuitry, not a class diagram.

- **Bus & memory part symbology (extension pass, 2026-06-13):** same house style as the gates — one stroke (`--part-stroke`), `--part-fill` body, soft corners, monochrome bodies (color stays on wires). Bus pins are *thick* (the reserved channel) and carry the bus mark.

  | Part | Silhouette | Identity cue |
  |---|---|---|
  | **Splitter / Merger** | A slim tall **bus-bar**: one thick bus pin centered on the wide side, fanned taps on the other at **sub-width thickness**, each range-labeled (`[7:4]`, `[0]`). Merger is the mirror. | The fan of varying-thickness taps reads as "one bus → many" (or the reverse). Not a generic box. |
  | **Register** | DFF's rectangle + clock-edge **`‹` notch**, plus a **stacked top-edge** (a second offset top line) to say *bank*; thick bus `D`/`Q` pins with width tag. | Single DFF = one rect; register = the stacked motif + bus-thick pins + width tag. |
  | **Mux** | The iconic **trapezoid** (wide data side → narrow output): thick bus data pins on the wide edge, a **narrow `sel` pin** on the angled edge, bus output on the narrow edge. | The trapezoid silhouette alone reads "mux"; the lone thin select pin distinguishes it from a buffer. |
  | **Constant** | A compact rounded body that **shows its literal value** (`0x2A`, mono) with a **single bus output** and no inputs. | Value-on-body + output-only = a source. No `⤢`, no double-outline (it's a primitive, not a chip). |
  | **Bus pin / port** | A **thicker pin stub** crossed by a short **diagonal slash** + the width number — the at-a-glance "this pin is a bus" mark, present even before a wire attaches. A 1-bit pin stays a plain node (no slash, no tag). | The slash is the universal "bus here" glyph, on parts and chip edges alike. |
  | **Bus label / width tag** | Two chrome marks, both small/mono/monochrome: **width tag** = bare mono digits at the wire midpoint (buses only); **net label** = a small `--surface-1` pill, hairline edge, mono text (`pc`), sitting on the wire (shown for *named* nets; on hover/selection otherwise). | Quiet chrome, never competes with signal color — labels name the ribbon without lighting it. |

  Consistency rule: bus/mem parts never introduce new color or a new corner language — they are the gate family plus the **bus mark** (thick pin + slash + width tag). Diving into any of them shows the same house style at the next level down.
- **Chips (divable composites):** rounded-rect body with a **double-outline** (a 3px-inset second hairline) + a small `⤢` corner glyph top-right — the unmistakable "this has an interior" tell. Name centered; pin labels at the edges.
- **IO:** input = a toggle/switch pill (shows its driven value via the signal language); output = a lamp node that glows with its net's state.
- **Selection:** `--part-edge-sel` 2px + 12% accent outer glow. **Marquee:** `--accent-quiet` fill + `--accent` 1px stroke. **Wire preview:** valid = green-glow solid; invalid = `--text-3` dashed. **Stamp ghost:** 45% part at the cursor + a top-center banner "Stamping AND — Esc to put down."

### Inspector (D) — top of right rail, 288px

- **Header:** selected part name (14/600) + type. **Pin rows:** `→ a   1` — direction glyph, pin name (`--text-2`), live value rendered in the **signal language** (state color + a tiny state glyph so it's not color-only: `1`/`0`/`X`/`Z` literally printed in mono). Bus pins show width and a value chip (`0x1F`).
- **Empty selection:** project overview (name, counts, depth) — never a blank pane.

### Watches (E) — bottom of right rail, **expandable rows (constraint 2)**

- **Collapsed row (44px):** `▸` disclosure · name (editable) · value (mono, state-colored, with printed glyph so never color-only) · base tag (`hex`/`bin`/`dec`) · **mini-trace sparkline** (last N cycles, signal-colored) · `×`.
- **Expanded row (`▾`, +variable):** reveals a **bit-strip** — per-bit cells, each painted in the 4-state language at cell scale (color + pattern), bit indices beneath, plus the base toggle as a segmented control. A 1-bit watch still expands (to a single cell + a taller trace) so the affordance and IA are uniform from day one. *Multi-bit content (cells carry the literal 0/1/X/Z digit, nibble grouping, wrap-at-16, per-bit → why?) and the bus change-tick mini-trace are **resolved by BUS_UX.md §6**.*
- **Empty state:** "Probe a wire and press +watch — watches save with the project."

### Why? card (canvas overlay — refined: the circuit explaining itself, not a tooltip)

The flagship debugging moment should feel *confident and authored*, like the circuit turned to face you and explained the fault — while staying calm and in-canvas. Refinements over the first pass:

- **Tethered, not floating.** The card is anchored to the origin node by a visible **leader line** — a 1px `--text-3` connector ending in a small dot on the offending node. The card is the node *speaking*; the line is the proof of who's talking. This single change is what separates "explanation" from "tooltip."
- **Confident size & rhythm.** Width ~360 (up from 320), padding 20–22, radius 14, `--surface-2`, soft `--shadow-hover` elevation so it sits clearly above the dimmed canvas. Generous internal spacing — it reads as a considered panel, not a bubble.
- **Header = a state token + a real question.** A rounded **state token** (28×20, state-color at 16% fill, the glyph `X`/`Z` in full state color) sits left of the title `Why is this X?` (15/600 `--text-1`). No full-width colored banner — the state color appears only as the small token (and the canvas highlight), preserving the reserved-color discipline.
- **The verdict is the hero.** The plain-language sentence is set at **15/450, `--text-1`, line-height 1.5** — the largest, most readable text in the card. This is the circuit's voice; everything else supports it.
- **Causes read as evidence.** Each driver is a row: a small `--pin`-dot, the driver name in mono `--text-2`, its value as a **signal-language chip** (state color + glyph), and a quiet `→ jump` on the right. Rows are separated by hairlines so they feel like listed evidence, not a menu.
- **One quiet exit.** `Done` as a ghost button (`--text-2`), bottom-right. No competing CTA.
- **Calm context:** surroundings scrim `rgba(11,13,17,0.62)`; the causal path and all named drivers stay full-strength beneath the dim. **Mirrored** as a focusable list in the inspector (accessibility-first). For a sequential-boundary verdict the card states the honest limit plainly and the leader line ends at the register.

#### Placement behavior (pass 1.2 — anchored, collision-aware, never clipped)

A flagship surface earns *computed* placement, not a fixed offset that lands behind a panel. The model is an anchored flyout with collision avoidance, resolved in this fixed order — the same flip → shift → reposition logic mature canvas tools use:

1. **Safe area.** The card must lie entirely within the **canvas region only** (it explicitly excludes the palette, right rail, and header), inset by a **~20px gutter**. Panels are outside this region, so a card that obeys the safe area can never be clipped by one. The card renders on a canvas-overlay layer but placement guarantees clipping is never reached.
2. **Side — flip.** Prefer opening to the **right** of the origin (reading order). **Flip to the left** when the origin sits within `cardWidth + gutter` of the safe-area's right edge — i.e. near the right rail (the case that failed before). Symmetric on the left edge. Whichever side has more room wins ties.
3. **Cross-axis — shift.** Align the card's near edge to the origin's height, then **clamp** vertically so the card stays inside the safe area: an origin near the **top** edge shifts the card **down/inward**; near the **bottom**, **up/inward**. The leader line lengthens to keep the anchor — the card moves, the connection doesn't break.
4. **Auto-pan — fallback.** If no side seats the card while keeping the origin visible (large circuit, cornered origin, or a small viewport), the canvas **pans the minimum amount** — structural motion, ≤300ms ease-out — to bring **both** origin and card into the safe area. The pan is capped so the origin never leaves view; it nudges, it never yanks.
5. **Final dock — degenerate viewport.** If the card still cannot fit beside the origin (a viewport barely larger than the card), it **docks to the safe-area edge nearest the origin** with a lengthened leader line, and the canvas keeps the origin in view. This is the guarantee of last resort: *always fully visible.*

Throughout, the **leader line always connects the card's anchor edge to the origin dot** regardless of side, shift, or pan — the card is felt as anchored to the cause, never as a tooltip dropped into leftover space, and is never clipped by a panel.

---

## 5. Figma-recreatable mockup

Frame `Editor / Desktop` — **1440 × 900**, fill `#0B0D11`. All px.

```
FRAME Editor/Desktop 1440×900 fill #0B0D11
│
├─ FRAME Header 1440×52 fill #0B0D11 stroke-bottom 1px #FFFFFF@7%
│   ├─ GROUP Left  x16 y10
│   │   ├─ BUTTON Home ⌂ 32×32 icon ti-home 18 #9AA2B1 radius8
│   │   ├─ TEXT "8-bit ALU" Inter 14/600 #E8EBF1  x+40
│   │   └─ BREADCRUMB "▸ ALU ▸ Adder4"  Inter 13/450  ancestors #9AA2B1 / current #E8EBF1 / sep #626A79
│   ├─ GROUP Transport  CENTERED x~620 y9  pill 200×34 fill #13161C radius10
│   │   ├─ ICON ti-player-skip-back 16 #9AA2B1
│   │   ├─ ICON ti-player-pause 18 #E8EBF1  + dot 6 #6C72FF  (LIVE state)
│   │   ├─ ICON ti-player-skip-forward 16 #9AA2B1
│   │   ├─ SLIDER speed (4px track / 14 thumb) + TEXT "~2kHz" GeistMono 12 #9AA2B1
│   │   └─ TEXT "t=1,204" GeistMono 13 #9AA2B1  tabular
│   └─ GROUP Right  x1300 y10
│       ├─ PILL Health "⚠ 2" Inter 13/500 #E8EBF1 radius8
│       └─ BUTTON Share "↗ Share" Inter 14/550 #E8EBF1 fill #13161C radius10
│
├─ FRAME Palette 212×848 x0 y52 fill #0B0D11 stroke-right 1px #FFFFFF@7%
│   ├─ INPUT Search 188×32 fill #13161C radius8 placeholder #626A79
│   ├─ LABEL "BUILT-IN" Inter 11/600 +0.10em #626A79
│   ├─ ROW Part (×N) 188×36 radius8 : TILE 28 #1A1E26 + symbol SILHOUETTE ; TEXT name Inter 14/450 #E8EBF1
│   │     (AND OR XOR NOT DFF CLK TRI)
│   │     armed (refined) → NO fill · left-bar 2px #6C72FF · tile border 1px #6C72FF · name → #E8EBF1
│   ├─ LABEL "BUS·MEM"  → SPLIT REGISTER MUX DECODER CONST  (rows show width stepper, mono)
│   ├─ LABEL "MY CHIPS" → Adder4, HA   ; ROW "+ Import" dashed #8FA1B5
│
├─ FRAME Canvas 940×848 x212 y52 fill #0B0D11
│   ├─ LAYER DotGrid  dots #FFFFFF@5  spacing 50
│   ├─ WIRES (the signal language — see §0):
│   │   • "1" : stroke #43D689 width2.5 solid + underlay #43D689@30 width7 (halo)
│   │   • "0" : stroke #3F72B0 width2.5 solid opacity .85
│   │   • "Z" : stroke #8A93A3 width2.5 dash 6 5 opacity .7
│   │   • "X" : stroke #E8554E width2.5 dash 9 4 2 4
│   │   • BUS: width4 (8-bit) + TEXT "8" GeistMono 11 #9AA2B1 at midpoint
│   ├─ PART Gate (×N) SILHOUETTE path, fill #14181F stroke #FFFFFF@16 1.7 ; NO text label on iconic gates ;
│   │     AND=D-body · OR/XOR=curved shield (+back arc) · NOT=triangle+bubble · DFF=rect+clock-notch+D/Q ;
│   │     inverting gates: output bubble r3 #14181F ; pins #7E93AB r3.5 on 20px module
│   ├─ PART Chip "Adder4" : rounded-rect + inner outline 3px inset #FFFFFF@10 + corner ⤢ glyph 12 #9AA2B1
│   ├─ STATE Selection : stroke #6C72FF 2 + outer glow #6C72FF@18
│   └─ OVERLAY Why?Card (refined): scrim #0B0D11@62 ; LEADER line 1px #626A79 card→origin-dot ;
│         card #1A1E26 360w radius14 shadow-hover ; header = state-token [X] (#E8554E@16 fill / #E8554E glyph)
│         + title "Why is this X?" 15/600 #E8EBF1 ; verdict 15/450 #E8EBF1 lh1.5 (the hero) ;
│         cause rows (pin-dot + name mono #9AA2B1 + value-chip + "→ jump") hairline-separated ; [Done] ghost
│         PLACEMENT: constrained to canvas safe-area (20px gutter, excl. panels) ; flip side (open LEFT when
│         origin near right rail) → shift cross-axis inward → auto-pan ≤300ms → dock-to-edge ; leader always
│         connects card edge → origin dot ; NEVER clipped by a panel  (Figma: build as auto-layout flyout
│         component w/ a `side`=L|R variant + a constraint frame = canvas rect inset 20)
│
└─ FRAME RightRail 288×848 x1152 y52 fill #0B0D11 stroke-left 1px #FFFFFF@7%
    ├─ PANEL Inspector  (flex top)
    │   ├─ TEXT "FullAdder" Inter 14/600 #E8EBF1
    │   └─ ROW Pin (×5) 26 : dir-glyph + name #9AA2B1 + value (state color + printed glyph mono)
    ├─ DIVIDER draggable 1px #FFFFFF@7%
    └─ PANEL Watches  (lower ~45%)
        ├─ LABEL "WATCHES" 11/600 #626A79
        ├─ ROW Watch collapsed 44 : ▸ · name(✎) · value(state-colored mono) · base-tag · sparkline · ×
        ├─ ROW Watch EXPANDED "bus" : ▾ header + BITSTRIP (8 cells, 4-state painted) + indices 7..0
        │       + SEGMENTED base [hex|bin|dec]
        └─ BUTTON "+ watch" ghost #9AA2B1
```

Components/variants for Figma: `SignalWire` {state: 1|0|X|Z, width: 1|bus|wide} · `Part` {kind: gate|chip|io, state: rest|selected|ghost} · `WatchRow` {collapsed|expanded, bits: 1|n} · `Transport` {live|paused} · `PartRow` {rest|hover|armed} · `WhyCard` {X|Z, causes: n}. The `SignalWire` component is the single most important shared symbol — it encodes the whole §0 language and every other surface references it.

---

## 6. Alternatives considered and rejected

1. **Thickness encodes state** (thin=0, bold=1). *Rejected by constraint 1* and on merit: it consumes the one channel buses universally need, exactly the collision we flagged when sequencing this work. Thickness belongs to bus width; states use color + pattern + glow.
2. **Color-only state encoding** (the prettiest, simplest option). *Rejected by constraint 3* — fails colorblind Builders and fails in grayscale screenshots, which a portfolio product's shared images will often be.
3. **Floating bottom-center transport** (media-player placement). *Considered* — closer to thumb/eye and nice on iPad. *Rejected for desktop* in favor of header-center to consolidate chrome and keep the canvas edge clean; the advancing `t=` counter, not extra chrome, carries liveness. (Revisit for the iPad adaptation pass.)
4. **MIL-spec / Logisim gate symbols.** *Rejected* — they are the visual signature of exactly the dated category QuadState rejects. Custom house-style silhouettes are where "premium vs. simulator" is most visible per pixel.
5. **Toolbar of mode buttons** (select/wire/probe/… always visible). *Rejected* — contradicts the modeless contract and canvas-first doctrine; it's chrome that exists to apologize for an interaction model we don't have.
6. **Inspector and Watches as tabs.** *Rejected* — watches must stay visible while a selection drives the inspector; tabs would force a choice between "see my CPU's vital signs" and "see this part's pins." Stacked rail with a divider keeps both.
7. **Pulsing / flowing wire animation for steady state.** *Rejected* (product doc doctrine) — steady state is static; motion is spent only at transitions. Ambient pulsing is visual noise pretending to be information.
8. **Light theme (or light editor).** *Rejected* — signal colors lose their bloom on light, long sessions favor dark, and it would clash with the dark Home. Dark-first is an identity commitment. (A light option may come later; not the default.)
9. **Tabbed multi-document editor.** *Rejected* — the two-shell model uses the browser/OS for multitasking (Arc's lesson); rebuilding tabs inside the app is chrome we deliberately don't own.
10. **Separate "debug mode" / waveform-first workspace.** *Rejected* — debugging is in-place (probes, Why?, watches on the canvas's own rail). A separate perspective is the EDA habit we're leaving behind; the waveform view, when it comes, is a reserved surface, not a mode switch.

---

## 7. Open questions (genuine dependencies only)

1. **Bus aggregate rendering & bit-strip content** — the agreed bus-pending items; finalize with bus UX planning. Containers and the thickness reservation are locked.
2. **Part symbology fine art** — the silhouette *system* is decided (house-style ANSI-derived, one stroke language, double-outline+⤢ for chips); the finished per-part drawings are an illustration pass. The mockup uses representative forms.
3. **Brand mark** — inherited open item from Home (the 2×2 four-state glyph is a placeholder); the editor uses it only at the home button scale, low-stakes until the mark is finalized.
4. **iPad transport placement** — header-center is the desktop decision; the floating-bottom alternative is reserved for the adaptation pass, not relitigated here.

## 8. Next steps

1. Review; the signal language (§0) is the highest-leverage thing to ratify — everything inherits it.
2. **Bus UX planning** — now genuinely unblocked, designed *against* this established language (the sequence we agreed on).
3. Part symbology illustration pass; then the remaining surfaces (Create Chip, Share sheet, Settings) inherit these tokens and the signal language with little new invention.

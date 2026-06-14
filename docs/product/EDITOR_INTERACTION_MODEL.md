# QuadState — Editor Interaction Model

**Phase:** Product Design & UX Planning — document 3 of the design phase
**Date:** 2026-06-12
**Status:** Amended 2026-06-12 after the four-document system review — keymap collisions resolved (arrows, `Home`, `H`), Windows platform audit applied (§1.1), glance stillness gate added, §13 ratified
**Depends on:** `PRODUCT_DEFINITION.md` (principles 1–7), `SIMULATION_DEBUGGING_UX.md` (transport, inspection gradient, Why?, peek). Those documents govern; where this document assigns a gesture, it is implementing their philosophy.
**Engineering grounding:** W3C Pointer Events with a single device-aware arbitration layer and per-device gesture policy table (built, `packages/canvas` GestureRecognizer); pressure ink (built); world-coordinate viewport. The contract below is largely *configuration* of that layer, not new input architecture.

**Scope:** interaction only. No layouts, no wireframes, no visual design. This defines what the hands do.

---

## 1. Interaction doctrine

Six rules that generate every assignment below. When a new interaction is designed later, it must be derivable from these.

1. **Modeless by default.** There is one resting state — Select — and the *target under the pointer* determines what a drag means: empty canvas → marquee, part body → move, pin → wire, chip (double-click) → dive. Tools-as-modes exist only where a target can't disambiguate (stamping parts, ink). Figma's lesson: experts never want to switch tools to do the obvious thing.
2. **The target decides; the modifier adjusts.** Modifiers never change *what* you're acting on, only *how*: **Shift = add/constrain**, **Alt/Option = reveal/variant** (duplicate a part, peek a chip, probe a wire — one *family* of meaning, resolved by target), **Ctrl/Cmd = command space**. A modifier never acts outside its family — Shift never deletes, Alt never navigates.
3. **Every mode announces itself and dies by Escape.** Any temporary state (stamping, wiring in progress, trace mode, peek) is visibly active and exits via Esc (or lifting the gesture that sustains it). **The Escape ladder** resolves all Esc ambiguity, top first: cancel in-progress gesture → exit active mode → clear selection → surface one hierarchy level. One key, predictable order.
4. **Hold means temporary; tap means toggle.** Held keys/gestures create spring-loaded states that end on release (Space-hold = pan, Alt-hover = peek). Taps switch persistent states (Space-tap = play/pause). This single distinction lets one key serve two jobs without modes.
5. **Three lanes to everything that touches the circuit.** Every canvas-affecting action has a direct-manipulation route (pointer/touch), a keyboard route, and a command-palette route; obscure non-canvas conveniences may be palette-only (§9). The palette is the universal fallback — it is also the accessibility floor and the discoverability surface (every palette entry shows its shortcut, which is how experts are grown).
6. **Devices have roles, not emulations.** Mouse/trackpad = precision + modifier richness. Touch = navigation + coarse manipulation. Pencil = precision instrument (never a finger). Keyboard = the speed layer. A gesture is assigned per device by role, not translated from the mouse contract.

---

### 1.1 Platform key dialect *(added by the system review)*

`⌘` means Cmd on macOS/iPadOS and **Ctrl on Windows/Linux**. The lead platform is the web app — frequently in a browser on Windows — so every binding must survive the browser. Combos the OS or browser reserves *non-interceptably* are never assigned: **Ctrl+W/N/T**, **Ctrl+Esc** (Windows Start menu), **Shift+Esc** (Chrome task manager). Interceptable-but-contested combos (Ctrl+D, Ctrl+G, Ctrl+K, Ctrl +/−/0) are intercepted deliberately, as Figma does. The Tauri desktop build has no browser constraints but ships the identical map — one set of hands, one muscle memory.

## 2. Device model

The arbitration layer already distinguishes pointer types per event; this table is its product-level policy:

| Device | Role | Owns |
|---|---|---|
| **Mouse** | Precision pointer, modifier-rich | All canvas verbs; wheel = zoom |
| **Trackpad** | Mouse contract + native gestures | Two-finger pan, pinch zoom replace wheel/Space-pan |
| **Keyboard** | Speed + accessibility layer | Transport, palette, nudge, all shortcuts |
| **Touch (fingers)** | Navigation and direct manipulation | Pan/zoom (always), select/move/wire when no Pencil active |
| **Apple Pencil** | Precision instrument + ink | When present: all precision work; fingers demote to navigation-only (Procreate split) |

**The Pencil split is the single most important adaptation decision:** when a Pencil is in use, *fingers never place, move, or wire* — they only pan, zoom, and tap-select. This is what makes Pencil precision feel "excellent" rather than fighting palm touches, and the existing device policy table was built for exactly this.

---

## 3. Canvas navigation

### 3.1 Panning
| | Contract |
|---|---|
| **Primary** | Mouse: **Space-hold + drag** (spring-loaded, rule 4) or middle-button drag. Trackpad: **two-finger scroll**. Touch: **one-finger drag on empty canvas? No — two-finger drag** (one finger is for manipulation; see §10). Pencil active: fingers drag anywhere. |
| **Alternative** | Scrollbars: none (canvas, not document). Edge-autoscroll during any drag (wiring toward off-screen targets must not require aborting). |
| **Expert** | Space-hold from *inside any in-progress gesture* (mid-wire, mid-marquee) pans without canceling — flow-state critical. |
| **Accessibility** | `Z`-hold + arrows pans (arrows alone never pan — they nudge selections and are otherwise reserved; §8). Palette: "Go to…" commands. |
| **Adaptation** | Identical mental model everywhere: "grab the world." Only the grip differs per device. |

### 3.2 Zooming
| | Contract |
|---|---|
| **Primary** | Mouse: **wheel = zoom to cursor** (no modifier — zooming is the most frequent navigation act on an infinite canvas and a mouse has no pinch). Trackpad: **pinch**. Touch: **pinch**. |
| **Alternative** | `Cmd/Ctrl +` / `−` / `0` (fit) / `1` (100%) / `2` (zoom to selection). Mouse wheel behavior is a setting (`zoom` default ↔ `pan`, for users with Figma muscle memory) — the only input setting we ship in v1. |
| **Expert** | `Shift-2`-style zoom-to-selection chained after ⌘K jump = teleport anywhere in a huge project in two strokes. |
| **Accessibility** | All zoom levels keyboard-reachable; zoom never gates information (glance values, health findings also live in panels). |
| **Adaptation** | Zoom-to-cursor / zoom-to-pinch-center everywhere; never zoom-to-canvas-center. |

---

## 4. Selection

### 4.1 Single selection
- **Primary:** click/tap a part or wire. Clicking a wire selects the *visual segment*; the full electrical net is simultaneously ghost-highlighted (union-find net resolution makes this free) — selection and net-understanding in one act.
- **Alternative:** ⌘K → part name → "Select". Inspector lists are selection surfaces too.
- **Expert:** `Tab` / `Shift-Tab` walks selection through parts in spatial order within the viewport — keyboard-only traversal of the canvas. Arrow keys nudge the selection by one grid step (`Shift`+arrows = larger steps); arrows act *only* on selections (§8 reserves them otherwise).
- **Accessibility:** Tab-traversal *is* the screen-reader path: each focused part is announced (name, type, pin states). Selection is never hover-dependent.
- **Adaptation:** identical on touch/Pencil (tap). Hit targets expand at low zoom (minimum 44px effective on touch — the *hit area*, not the artwork).

### 4.2 Multi-selection
- **Primary:** drag on empty canvas = **marquee (full-enclosure)**; **Shift-click** toggles membership.
- **Alternative:** ⌘A select-all at current hierarchy level; "Select connected" (whole net + attached parts) via context menu / ⌘K.
- **Expert:** Marquee + Shift = additive marquee. "Select connected" then ⌘G is the two-stroke path from "this cluster works" to "this is now a chip" (§6.5).
- **Accessibility:** Shift-Tab traversal extends selection; palette exposes select-connected/select-all.
- **Adaptation:** touch marquee = drag on empty canvas with one finger (when no Pencil) or Pencil-drag on empty; "add to selection" on touch = tap the multi-select chip that appears once ≥1 item is selected (no Shift key exists — a transient on-canvas affordance stands in for the modifier).

---

## 5. Building

### 5.1 Part placement
- **Primary:** drag from palette onto canvas — lands where dropped, snapped to grid.
- **Alternative:** ⌘K → type name → Enter places the part **loaded on the cursor** for placement click.
- **Expert:** **Stamp mode** — single-key hotkeys for the core set (`A` AND, `O` OR, `N` NOT, `X` XOR, `I` input, `U` output, `D` DFF…) load a ghost on the cursor; each click stamps one; **Esc ends** (Escape ladder rung 2). Numeric prefix sets bus width while loaded (type `8` then click = 8-bit input). The fastest builders never open the palette.
- **Accessibility:** palette route is fully keyboard operable: load via ⌘K, position ghost with arrows (grid steps), Enter stamps, Esc ends.
- **Adaptation:** touch/Pencil drag-from-palette is primary; stamp mode via palette "pin part to stylus" — each Pencil tap stamps until dismissed. Pencil Pro **squeeze** summons the palette at the pen tip.

### 5.2 Wiring
- **Primary:** **drag from a pin**; a live wire follows with auto-routed preview; release on a pin or wire to connect. Dropping on a wire creates a **junction** (net merge — engineered). Invalid targets show refusal *during* the drag, never as a post-hoc error.
- **Alternative:** **click-click wiring** — click pin, click intermediate waypoints (each click pins a bend), click target. Required for precision at distance, trackpad comfort, and accessibility; Esc cancels (ladder rung 1).
- **Expert:** start a wire, **Space-hold-pan** mid-wire to reach distant targets (§3.1); release on a *chip body* opens a pin-picker for that chip (no hunting for tiny pins); `Shift` during drag constrains routing to the axis of travel. Drag from a pin that's already wired = start a *new branch* of the net.
- **Accessibility:** click-click is the keyboard-translatable route: Tab to source pin, Enter starts, arrows move the head pin-to-pin (snapping between valid targets, not pixels), Enter commits. Announced at each hop ("FullAdder.Cin — connect?").
- **Adaptation:** Pencil is the *best* wiring instrument in the app — tip precision onto dense pin rows, fingers free to pan mid-wire (the split, §2). Finger wiring (no Pencil) gets enlarged pin hit zones and magnified head feedback. Routing personality (orthogonal-auto vs free) is still an open visual question — *this contract holds under either*: drag defines endpoints and optional waypoints; the router draws the path.

### 5.3 Buses
- **Primary:** buses are not drawn differently — **width flows from pins**. Wiring two multi-bit pins of equal width creates a bus wire; the wire's rendering announces its width. Width itself is set on parts (IO pins, registers, splitters) via inspector stepper or the numeric-prefix stamp (§5.1).
- **Alternative:** splitter/merger parts for bundling and breakout, placed like any part; dragging a bus wire onto a 1-bit pin offers "insert splitter" rather than refusing.
- **Expert:** numeric prefix everywhere widths appear; `8I` stamps an 8-bit input. Width *mismatch* during wiring shows inline refusal with both widths labeled — fix by retargeting or accepting the offered splitter.
- **Accessibility:** widths are inspector-editable text fields; mismatch explanations are text, not color alone.
- **Adaptation:** identical everywhere; width entry on touch via inspector stepper.

### 5.4 Duplication
- **Primary:** **Alt-drag** a selection = duplicate-and-move (Figma's verb).
- **Alternative:** ⌘C/⌘V (paste offset near cursor), ⌘D duplicate-in-place-offset.
- **Expert:** **⌘D repeats the last duplicate's offset** — duplicate a full-adder, nudge it one slot down, then ⌘D ⌘D ⌘D rapid-builds the ripple-carry column. This single behavior is the register-file builder's best friend.
- **Accessibility:** all three routes keyboardable; paste lands at viewport center when no cursor.
- **Adaptation:** touch = long-press → Duplicate from context menu, or copy/paste via the selection chip (§4.2); Pencil + finger-tap-modifier chord is *not* used (chords across hands are undiscoverable; Procreate avoids them too).

### 5.5 Chip creation — and the no-group decision
- **Primary:** selection → **⌘G**. QuadState deliberately has **no "group" concept**: the only way to bundle parts is to make them a *real chip* — named, pinned, reusable, simulatable. ⌘G (every tool's "group" key) is reassigned to Create Chip because chips *are* QuadState's grouping. One abstraction instead of two; the signature gesture (product doc §4, stage 4) inherits the most famous shortcut in creative software.
- **Alternative:** context menu "Create chip from selection"; ⌘K "Create chip".
- **Expert:** "Select connected" → ⌘G → type name → Enter: working cluster to placed, named chip in under three seconds. Boundary-crossing wires become pins automatically (engineered: `createChipFromSelection` net-boundary analysis); the naming prompt is inline at the new chip, not a dialog.
- **Accessibility:** fully keyboard-driven end-to-end (the expert path *is* the accessible path); pin auto-naming derives from attached IO labels so screen-reader users get meaningful pins without extra steps.
- **Adaptation:** touch/Pencil: selection chip shows **Create Chip** as a first-class action (it's the signature move — it earns persistent placement, not a menu burial).

---

## 6. Hierarchy

### 6.1 Dive (into an instance, live)
- **Primary:** **double-click / double-tap** a chip → zoom-through transition into the live instance (motion doc: structural, 200–350ms, interruptible).
- **Alternative:** breadcrumb; ⌘K jump by name; "continue inside" while tracing a net (carries the trace highlight — sim doc §5.1).
- **Expert:** ⌘K accepts dotted paths (`alu.adder4.fa2`) — teleport to any depth.
- **Accessibility:** Enter on a focused chip dives; breadcrumb is a standard focusable control; depth changes are announced ("Inside Adder4 — instance 2 of 4, viewing live signals").
- **Adaptation:** identical; double-tap with finger or Pencil.

### 6.2 Surface (back out)
- **Primary:** **Esc** (Escape ladder rung 4 — only when nothing is selected and no mode is active, which is exactly when it feels right).
- **Alternative:** breadcrumb click on any ancestor; pinch-out-past-fit on touch (zoom out "through" the chip boundary) — the inverse of the dive metaphor.
- **Expert:** `Home` surfaces to top regardless of depth. (Originally ⌘Esc — rejected by the platform audit: Ctrl+Esc opens the Windows Start menu and cannot be intercepted.)
- **Accessibility:** breadcrumb keyboard path; announcements mirror dive.

### 6.3 X-ray peek
- **Primary:** **Alt-hover** a chip (spring-loaded, rule 4) → translucent live interior; release Alt to dismiss.
- **Alternative:** "Peek" in context menu (sticky until Esc) for users who can't hold modifiers (also the accessibility route — a toggle, not a hold, satisfying no-timing-dependence).
- **Expert:** Alt held while *sweeping* across several chips peeks each in turn — scan a datapath's interiors in one pass.
- **Accessibility:** the sticky variant + inspector "interior signals" list (peek information is never hover-only — rule: hover reveals, panels retain).
- **Adaptation:** touch: **long-press** a chip = peek while held. Pencil with hover (M2+ iPads): **Pencil-hover + finger-touch-hold** is rejected (cross-hand chord); instead Pencil **long-press-without-moving** peeks. Pencil Pro squeeze while over a chip = peek toggle.

### 6.4 Edit definition (vs live instance)
- **Primary:** from inside an instance (or with a chip selected): explicit **"Edit definition"** affordance; **⌘Return** on a selected chip. Never accidental — the live/edit distinction is doctrine (sim doc §5.2).
- **Alternative:** ⌘K "Edit definition of…".
- **Expert:** ⌘Return, edit, Esc back to live instance view — the loop is three strokes.
- **Accessibility:** mode change loudly announced ("Editing ALU definition — affects 3 instances"); visually unmistakable per sim doc.

---

## 7. Inspection & debugging

### 7.1 Glance
- **Primary:** **hover** any wire/pin → transient value readout, gated on *stillness*: the pointer must rest ~250ms before the readout appears, and sweeping motion never leaves a tooltip trail (calm-canvas guard — a glance is something you do, not something that happens to you). Dwell time is a passive observation item in the prototype. No modifier, no click, no commitment (inspection gradient level 1).
- **Alternative / Accessibility:** selected wire's value always shown in inspector (hover-only information is forbidden); Tab-traversal announces values.
- **Expert:** glance honors the active number base (hex/bin/dec) set per-watch or globally.
- **Adaptation:** touch/Pencil: **touch-and-hold** a wire = glance while held (long-press on *wires* glances; on *chips* it peeks — target decides, rule 2). Pencil hover (M2+) = true hover glance, the premium path.

### 7.2 Probe (pinned readout)
- **Primary:** **Alt-click** a wire/pin → on-canvas pinned readout; click its ✕ to dismiss.
- **Alternative:** context menu "Probe"; ⌘K "Probe selection".
- **Expert:** `P` probes whatever is hovered/selected — probe five nets in five keystrokes while never leaving the keyboard-pan flow.
- **Accessibility:** `P` on focused wire; probes are focusable, announced, dismissible by Delete.
- **Adaptation:** touch: glance-hold → slide up to "pin" (one continuous gesture from glance to probe); Pencil: same, or squeeze while glancing.

### 7.3 Watch (persistent)
- **Primary:** **"+watch" on any probe readout** — promotion, not creation (gradient level 3).
- **Alternative:** `W` on hovered/selected net; "Watch" in context menu; from inspector.
- **Expert:** `W` straight from hover skips the probe stage entirely. Click a watch in the list = camera flies to its net at any depth (watches as navigation — sim doc §3.2).
- **Accessibility:** the watch *list* is a standard accessible table (name, value, mini-trace described in text: "high for 12 cycles"); it is the primary non-visual debugging surface.
- **Adaptation:** identical promotion model; on touch the watch list is also where bus bit-strips expand (fingers are better at lists than at dense canvas targets).

### 7.4 "Why?" diagnostics
- **Primary:** any readout showing X/Z carries a **Why?** affordance — one click/tap → causal path highlight + plain-language verdict (sim doc §4.2).
- **Alternative:** `?` key with a strange net hovered/selected; ⌘K "Why is this X?" when selection qualifies.
- **Expert:** `?` chains with Tab-traversal: walk nets, interrogate each, never touch the pointer. Following the highlighted path to a chip and pressing Enter dives *with the trace carried*.
- **Accessibility:** the verdict is text-first by design — the same sentence the canvas shows is announced and listed in the inspector with each cause as a focusable jump target. Why? is the *most* accessible debugging feature, by construction.
- **Adaptation:** identical; the affordance rides the readout on all devices.

### 7.5 Health navigation
- **Primary:** click the health indicator → camera cycles through findings in place (sim doc §4.3).
- **Alternative / Accessibility:** findings as a focusable list in the inspector; each is a fly-to target.
- **Expert:** `H` next finding / `Shift-H` previous — lint-walk the whole project from the keyboard.

---

## 8. Simulation transport

- **Primary:** **Space-tap = play/pause** (rule 4: tap toggles). **Space-hold = pan** (§3.1). The tap/hold threshold (~180ms) is the one place this contract leans on timing — flagged as a prototype-validation item (§13.1), with the fallback assignment reserved (`Shift-Space` pan) if it tests badly.
- **Step:** **`S`** steps one clock cycle while paused; **Alt-S** micro-steps one delta (progressive disclosure per sim doc §2.2). **`←` and `→` are reserved for time scrubbing** (Tier 3) and deliberately unbound in the transport — the most valuable keys on the keyboard are being saved for the north-star feature. Arrows therefore have exactly one editor meaning: nudge the selection (§4.1). (The earlier draft triple-booked the arrows across pan, nudge, and step; the system review withdrew the pan and step assignments.)
- **Rate:** `,` / `.` slower/faster (log steps); on-canvas transport control for pointer/touch.
- **Reset:** **Shift-R** with inline confirm (destructive to state — friction is intentional); undoable as a time event.
- **Trace mode:** `T` toggles (announced mode, Esc exits — ladder rung 2); stepping inside trace mode uses `S` / `Shift-S` per event — same key, finer granularity, and the arrows stay reserved.
- **Accessibility:** every transport state change is announced ("Paused at cycle 1,204"); transport is a standard focusable control cluster; no action is gesture-only.
- **Adaptation:** touch/Pencil get the on-canvas transport as primary (no spacebar); **two-finger double-tap = play/pause** mirrors Space-tap for hands-on-canvas flow.

---

## 9. Command palette

- **Primary:** **⌘K** → one fuzzy field over four result classes: **parts** (load for stamping), **places** (chips/nets/watches — jump), **actions** (every command in the app, each showing its shortcut), **explanations** ("why is this X?" when selection qualifies).
- **Alternative:** all palette actions also exist in menus/context menus — the palette is an accelerator, never the only home of a command (except deliberately: obscure expert commands may be palette-only to keep chrome calm).
- **Expert:** dotted-path jumps (`cpu.alu.fa2`), numeric-prefixed part loading (`8 input`), verb-first muscle memory ("watch pc", "edit alu"). The palette is the expert's whole UI.
- **Accessibility:** the palette is the keyboard/screen-reader gateway to literally everything — this is rule 5's floor, and it's why every action *must* be registered in it. Standard combobox semantics.
- **Adaptation:** touch: persistent search affordance in chrome; Pencil Pro: squeeze on empty canvas summons it at the tip. Same index, same results everywhere.

---

## 10. Consolidated touch contract (no Pencil present)

> **Provisional** — §10 and §11 cannot be validated until the iPad build runs on hardware (known backlog: Capacitor leg needs macOS). Treat both as a considered draft, not a settled contract; expect revision on first contact. Known watch-item for that session: the two-finger gesture space (drag, pinch, tap, double-tap) is crowded and needs the same discrimination scrutiny Space gets on desktop.

One finger manipulates, two fingers navigate, holds reveal:

| Gesture | Meaning |
|---|---|
| Tap | Select (part, wire) / activate affordance |
| Double-tap chip | Dive |
| One-finger drag: empty / part / pin | Marquee / move / wire |
| Long-press wire / chip / part | Glance / peek / context menu (target decides) |
| Two-finger drag / pinch | Pan / zoom (always, even mid-gesture) |
| Two-finger tap / three-finger tap | **Undo / redo** (Procreate's gift to humanity, adopted verbatim) |
| Two-finger double-tap | Play/pause |
| Pinch-out past fit | Surface one hierarchy level |

Selection chip (appears with any selection) carries the modifier-replacing actions: add-to-selection, duplicate, Create Chip, probe, watch.

## 11. Consolidated Pencil contract (Pencil present)

Fingers demote to: pan, zoom, tap-select, undo/redo taps, two-finger double-tap transport. Pencil owns:

| Pencil action | Meaning |
|---|---|
| Tap / drag (by target) | Select / move / wire / marquee — full precision contract |
| Double-tap chip | Dive |
| Long-press (stationary) | Glance (wire) / peek (chip) |
| **Pressure drag in Ink mode** | Annotation ink (existing pressure pipeline) |
| Apple double-tap gesture (Pencil 2+) | Toggle Ink ↔ previous tool (system convention, user-remappable per HIG) |
| Squeeze (Pencil Pro) | Palette at tip (empty canvas) / context actions (on target) |
| Hover (M2+ iPads) | True glance + pin-target preview before committing a wire |

Ink is a **mode** (announced, Esc/double-tap exits — ladder rung 2): in Ink, the Pencil draws annotation strokes and *cannot* accidentally rewire the circuit. Paused-machine annotation (sim doc workflow 8) is this mode plus the transport.

## 12. Accessibility commitments (cross-cutting)

The honest version, including the hard parts:

1. **The palette is the floor:** every action keyboard-reachable via ⌘K; canvas object traversal via Tab/Shift-Tab with spatial ordering and full announcements (name, type, state, values).
2. **No hover-only, no gesture-only, no timing-only:** everything revealed by hover/hold also lives in a panel; every hold-gesture has a toggle variant; the single timing-dependent input (Space tap/hold) has a reserved fallback.
3. **Four-state never by color alone** (visual doctrine) — and never by *canvas* alone: values are text in inspector, watches, and announcements.
4. **Keyboard wiring** (§5.2) snaps between valid targets, not pixels — discrete, announced steps.
5. **Honest limitation:** a freeform canvas will not be fully screen-reader-equivalent in v1. The committed accessible surfaces are: palette, inspector, watch list, health findings, transport, breadcrumb, and Why? verdicts — which together form a complete *non-spatial* debugging and inspection workflow. Spatial *editing* parity is a stated aspiration, not a v1 commitment.
6. Reduced-motion collapses dive/peek transitions to crossfades (motion doc); all hit targets ≥44px effective on touch; modifier-free operation possible throughout (context menus + selection chip carry all modifier verbs).

---

## 13. Contestable decisions — **ratified 2026-06-12**

> All five carried as written into the prototype after the four-document system review, subject to their named test gates. The review's keymap amendments (arrows, `Home`, `H`, the §1.1 platform audit, the glance stillness gate) are folded into the sections above.

1. **Space-tap = play/pause vs Space-hold = pan.** Elegant, doctrine-consistent (rule 4), and the riskiest call in the document — it must survive a prototype test with real hands. Fallback reserved: pan moves to Shift-Space/middle-drag, Space becomes transport-only.
2. **⌘G = Create Chip, and no group concept at all.** Strong simplification with a real cost: users who want loose visual bundling without abstraction don't get it. I believe chips-as-the-only-grouping *is* the product's point of view; if real projects later demand casual grouping, ink lasso + canvas regions are the pressure valve — not a group object.
3. **Mouse wheel = zoom (not scroll).** Right for an infinite canvas and CAD-adjacent muscle memory; wrong for some Figma immigrants. Shipping as the lone input setting acknowledges it's a preference, not a truth.
4. **Fingers fully demote when Pencil is active.** Procreate-proven but strict — some users wire with finger and Pencil interchangeably. The policy table makes this a one-flag experiment during iPad adaptation testing.
5. **`←`/`→` left unbound in the transport, reserved for time scrubbing.** Spending prime keys on a future feature is unusual; it prevents retraining muscle memory when the north star ships. (Amended by the system review: both arrows are now reserved, and stepping moved to `S`.)

## 14. Next steps

1. Review/contest, especially §13 — items 1 and 2 shape everything downstream.
2. **Interactive input prototype** (not a wireframe — a gray-box canvas with the §3–5 contract live) to validate Space tap/hold, stamp mode, and wiring feel before any visual design. This is the one place where planning genuinely cannot substitute for hands.
3. Then low-fi wireframes with this contract as given: Home, Editor chrome (transport, watch list, health, breadcrumb), Create Chip flow, Share sheet.

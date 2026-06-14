# QuadState — Low-Fi Wireframes

**Phase:** Product Design & UX Planning — document 6
**Date:** 2026-06-12
**Status:** Draft for review
**Fixed inputs:** PRODUCT_DEFINITION.md (IA §5–7, journey §4), SIMULATION_DEBUGGING_UX.md (transport, gradient, Why?), EDITOR_INTERACTION_MODEL.md (provisionally accepted contract), INTERACTION_PROTOTYPE_PLAN.md (harness findings to date).
**Level:** structure, IA, and workflow only. Boxes are regions, not designs. No color, type, branding, motion, or styling — those are the next phase. Where a doc already ratified a decision, the wireframe implements it; new decisions raised here land in each screen's Open Questions.

Legend: `[Button]` action · `(...)` annotation · `▤` collapsible panel · `⌂` home/top · boxes are layout regions.

---

## Global shell map

```
            ┌──────────────┐   continue / open / new / template
   cold ───▶│     HOME     │ ─────────────────────────────────▶ ┌──────────────┐
  launch    │   (shell A)  │ ◀───────────────────────────────── │    EDITOR    │
            └──────┬───────┘        app mark (⌂) click          │   (shell B)  │
                   │ gear                                       └──┬───────┬───┘
            ┌──────▼───────┐                                       │       │
            │   SETTINGS   │◀── gear (same overlay, both shells) ──┘       │
            │   (overlay)  │                            ┌──────────────────▼─┐
            └──────────────┘                            │ SHARE SHEET (overlay)│
                                                        └────────────────────┘
   ⌘K command palette: overlay, available in both shells.
   Warm launch: skips Home, restores last Editor state (doc 1 §4 stage 0).
```

---

## 1. Home screen

**Purpose:** get a Builder back into their long-lived project in one action; make starting and finding work secondary but effortless. (Doc 1 §6: hero is Continue, not New; Settings is an overlay, not a tile.)

**Primary user tasks:** resume last project · open a recent · start blank / from template · import a project file from disk · reach settings.

**Layout regions:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ [mark] QuadState                                          [⚙] [⌘K]  │ top bar
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐  ┌────────────────┐ │
│  │              CONTINUE  (hero)               │  │  START NEW     │ │
│  │  ┌───────────────────────────────┐          │  │ [ + Blank ]    │ │
│  │  │   canvas thumbnail            │ name     │  │ ───────────── │ │
│  │  │   (static, captured at save)  │ modified │  │ TEMPLATES      │ │
│  │  │                               │ [Resume] │  │ [Half-adder]   │ │
│  │  └───────────────────────────────┘          │  │ [SR latch]     │ │
│  └─────────────────────────────────────────────┘  │ [Counter]      │ │
│  RECENTS                                          │ [7-seg]  (4–8) │ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              └────────────────┘ │
│  │thumb │ │thumb │ │thumb │ │ ...  │   [Open from disk…]             │
│  │name  │ │name  │ │name  │ │      │                                 │
│  └──────┘ └──────┘ └──────┘ └──────┘                                 │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  (reserved region: COMMUNITY LIBRARY — absent in v1, IA slot only)   │
└──────────────────────────────────────────────────────────────────────┘
```

**Navigation paths:** Resume/recent/blank/template → Editor. `[⚙]` → Settings overlay. `[Open from disk…]` → OS picker → Editor. ⌘K → palette (recents + actions searchable).

**State transitions:**
- *First launch (no projects):* hero region is replaced by a single "Start your first circuit" card → opens the onboarding starter project (doc 1 §7.8 — onboarding happens *in* the editor, never as a slideshow). Recents hidden.
- *Normal:* as drawn. Hero = most recent project.
- *Returning via ⌂ from editor:* current project becomes the hero.

**Open questions:** recents capacity (one row vs. grid+scroll); does "Open from disk" deserve its drawn prominence on web (where FS access is the only way to reach old files) vs. desktop (recents cover it)? Template count and final lineup (doc 1 §11.5 — content decision, ties to standard-library chips in doc 5).

---

## 2. Project creation flow

**Purpose:** make creation feel like *nothing* — doc 1 stage 2: land on a canvas, name it later, configure it never. There is deliberately no wizard, so this "flow" is a transition, not a screen.

**Primary user tasks:** start building within seconds; optionally start from a teaching template.

**Flow:**

```
HOME                                EDITOR (untitled)
[ + Blank ] ──────────────────────▶ ┌──────────────────────────────┐
                                    │ header: "Untitled" (click to │
                                    │ rename, inline — no dialog)  │
[Template card] ─────────────────▶  │ canvas: empty (blank) or     │
   (card shows: name, mini         │ template content + its ink    │
    diagram, "teaches X")          │ annotations                   │
                                    │ palette: open                │
                                    │ first-run only: ghost hint   │
                                    │ "drag a part from the        │
                                    │  palette" (dies on first      │
                                    │  placement, forever)         │
                                    └──────────────────────────────┘
```

**Layout regions:** none of its own — reuses Home (entry) and Editor (destination). The template card is the only dedicated element: thumbnail diagram + one-line "teaches X".

**Navigation paths:** Home → Editor. Esc/⌂ returns to Home (project persists as a draft in recents).

**State transitions:** blank → first-run hint (once ever, per profile) → normal editing. Template → normal editing (template ink/annotations present). Untitled → named via inline header rename; autosave keeps the draft in Recents either way.

**Open questions:** autosave policy for untitled drafts (silent draft slot vs. prompt on close — doc 1 stage 6 promises "quiet autosave-to-draft", mechanics undefined); do templates open with their own one-time hint ("poke the inputs")?; is duplicate-template-on-open implicit (templates must never be editable in place)?

---

## 3. Main editor

**Purpose:** the surface where 95% of all time goes (doc 1 §7.2). Canvas is the product; everything else is furniture that collapses to zero.

**Primary user tasks:** place/wire/edit (contract §5) · run/pause/step (transport) · probe and watch (gradient) · create chips · navigate hierarchy · share.

**Layout regions:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [⌂] Project-name(✎) │ ⌂ top ▸ ALU ▸ [Adder4]   │ ▶LIVE ⏸ [S]tep  rate ─┤│ A
│                     │ (breadcrumb, only >0 deep)│ t=1,204    ⚠2  [Share]││
├───────┬──────────────────────────────────────────────────────┬───────────┤
│ ▤ PALETTE                                                    │ ▤ INSPECTOR│
│ ┌─────┐│                                                     │┌─────────┐│
│ │BUILT-││                                                    ││selection ││ D
│ │ IN   ││                 C  CANVAS                          ││props /   ││
│ │ AND  ││                 (full-bleed; panels float          ││chip pins/││
│ │ OR…  ││                  above it, both sides              ││empty =   ││
│ ├─────┤│                  collapse to zero)                  ││overview  ││
│ │MY    ││                                                    │├─────────┤│
│ │CHIPS ││     (transient on-canvas elements:                 ││▤ WATCHES ││ E
│ │ HA   ││      stamp ghost · marquee · wire preview ·        ││name val ▁▂│
│ │ ALU  ││      probe flags · inline chip-name field ·        ││pc  0x1F ▃▅│
│ ├─────┤│      first-run hint · Why? verdict card)            ││carry 1  ▁▁│
│ │IMPORTED│                                                   ││[+ watch] ││
│ │ …    ││                                                    │└─────────┘│
│ │[+Import]                                                   │           │
│ └─────┘│                                                     │           │
│   B    │                                                     │     D/E   │
└───────┴──────────────────────────────────────────────────────┴───────────┘
 A header: identity/nav | breadcrumb | transport cluster | health ⚠ | share
 B palette: drag = place one · click = arm stamp (validated in prototype)
 C canvas: all editing, all debugging-in-place
 D inspector zone (contextual; empty selection = project overview, never blank)
 E watch zone (persistent, independent of selection; doc 2 §3.2)
```

**Navigation paths:** `[⌂]` → Home. Breadcrumb/double-click/Esc/Home-key → hierarchy (§7). `[Share]` → share sheet (§8). `⚠` health → camera cycles findings (`H`/`Shift-H`). ⌘K → everything. Gear lives in ⌘K + Home (not in editor chrome — contestable, see Open Qs).

**State transitions:**
- *Live ↔ Paused:* transport chip + Space; paused state must be visible at a glance from anywhere (Card C's silent-pause risk — the chip alone may not be enough; see Open Qs).
- *Stamp armed:* ghost on cursor + banner near top of canvas; Esc disarms (ladder rung 2).
- *Wiring in progress:* path preview; Esc cancels (rung 1).
- *Diving:* see §7 — same surface, different chrome state.
- *Panels:* each of B, D, E independently collapsible to zero → "flow state" = header + canvas only.
- *Building (construction dampening):* `⚠` suppressed for recently-touched nets (doc 2 §4.3).

**Open questions:** Is the transport in the header (as the prototype has it) or floating at canvas bottom-center? Header keeps chrome consolidated; floating is closer to the thumb/eye on iPad — flag for the adaptation pass. Does paused state need a canvas-edge treatment in addition to the chip (silent-pause mitigation — wireframe-level placeholder: a thin full-width "paused" strip under the header)? Palette collapsed form: icon rail vs. fully hidden? Where do compile errors (invalid circuit) surface — health indicator or status text in header?

---

## 4. Create Chip flow

**Purpose:** stage the signature moment (doc 1 §4 stage 4): selection → abstraction in one gesture, comprehensible pins, instantly reusable.

**Primary user tasks:** collapse a working cluster into a named chip; immediately place more of them; trust that it's reversible.

**Flow (three beats, all on-canvas):**

```
BEAT 1: selection                BEAT 2: ⌘G collapse           BEAT 3: named + reusable
┌────────────────────┐          ┌────────────────────┐        ┌────────────────────┐
│  ╔════════════╗    │          │                    │        │                    │
│  ║ XOR──┐     ║    │   ⌘G     │   ┌──────────┐     │ Enter  │   ┌──────────┐     │
│  ║ AND──┴─…   ║    │ ───────▶ │ ─▶│  ▯▯▯▯    │─    │ ─────▶ │ ─▶│   HA     │─    │
│  ╚════════════╝    │          │   └──────────┘     │        │   └──────────┘     │
│  (marquee/sel.)    │          │   [Chip1____](✎)   │        │  palette MY CHIPS  │
│  sel. count + hint │          │   inline name      │        │  gains "HA" (flash)│
│  "⌘G create chip"  │          │   field, focused;  │        │  chip is live —    │
│                    │          │   pins auto-derived│        │  signals flowing   │
└────────────────────┘          │   from boundary    │        └────────────────────┘
                                └────────────────────┘
```

**Layout regions:** no new surface. Selection affordance (count + "⌘G" hint near selection, also on touch selection chip); inline name field anchored to the new chip; My Chips palette section.

**Navigation paths:** context menu "Create chip" and ⌘K route here too (contract three-lanes). Double-click new chip → dive (§7). "Dissolve chip" available on the chip's context menu (undo's trustworthy cousin — Card E fallback 2, promoted to baseline).

**State transitions:** selection → collapsing → naming (Esc keeps the provisional name; Enter/blur commits) → done. *Refusal states render at the selection, not as dialogs:* "IO pins can't live inside a chip — leave them out" anchored to the offending pin; "selection has no external connections — a chip needs at least one pin."

**Contingency (from prototype Card E gates):** if pin-prediction testing fails (<75 %), Beat 2 gains a one-confirm **pin review**: derived pins rendered on the collapsing boundary with names editable before finalize. Wireframe reserves the inline field's position either way.

**Open questions:** pin *ordering* control (defer to edit-definition, or allow drag-reorder in the pin-review variant?); does Beat 3 auto-arm the new chip as a stamp (fast ripple-building) or leave the cursor free (calmer)? Naming collision with an existing chip name — silent suffix or inline warning?

---

## 5. Watch / inspection surfaces

**Purpose:** implement the inspection gradient (doc 2 §3) — glance is free, probe is one click, watch is one more — with the watch list as the project's debugging memory and navigation map.

**Primary user tasks:** read a value instantly · pin a readout while working · build a persistent watch set (saved in the file) · inspect buses per-bit · jump to watched locations.

**Layout regions:**

```
GLANCE (transient, stillness-gated)     PROBE (pinned on canvas)
      ┌─────────────┐                      ┌──────────────────────┐
 ─────┤ carry = 1   ├──                ────┤ alu.carry  1   [hex] │──
      └─────────────┘                      │ [+watch] [why?] [×]  │
 (near cursor; gone on move;               └──────────────────────┘
  value only, no chrome)               (survives pan/zoom; why? only
                                        shown when value is X or Z)

WATCH PANEL (editor zone E)
┌────────────────────────────────────┐
│ WATCHES                        [▤] │
│ ┌────────────────────────────────┐ │
│ │ pc      0x1F  hex▾  ▂▃▅▂▁▂▃   │ │  row: name(✎) · value · base ·
│ │ carry   1     bin▾  ▁▁▆▆▁▁▁   │ │  mini-trace (last N cycles) ·
│ │ bus_a   0xZX  hex▾  ▂▂▂▂▂▂▂ ⊕ │ │  click row = fly-to (any depth)
│ │  └ bit strip (expanded ⊕):     │ │
│ │    [0][1][X][1][Z][0][0][1]    │ │  bus digits: X/Z rendered as
│ │ in2 ⚠ missing (net removed)    │ │  letters per nibble (doc 2 §3.1)
│ └────────────────────────────────┘ │
│ (empty state: "probe a wire and    │
│  press +watch — watches save with  │
│  the project")                     │
└────────────────────────────────────┘
```

**Navigation paths:** glance → probe (`+pin` / Alt-click) → watch (`+watch` / `W`). Watch row click → camera flies to the net, diving hierarchy as needed (doc 2 §5.4). Probe `why?` → §6. Inspector zone (D) shows selected part's props/pins; watch zone (E) is independent of selection.

**State transitions:** transient → pinned → persistent (the gradient); bus row ⊕ collapsed ↔ expanded; *stale watch* ("missing") when its net no longer exists after an edit — row stays, flagged, removable (stable IDs make matches survive most edits); paused vs. live changes nothing structurally (values freeze).

**Open questions:** probe-flag density management on a busy canvas (max count? auto-decay oldest? cluster?); mini-trace window length (fixed N cycles vs. zoomable — Tier 1 history, doc 2 §2.5); do watches get user-defined names by default or inherit net names; per-watch base picker vs. global default with per-watch override (drawn: per-watch).

---

## 6. Why? diagnostic experience

**Purpose:** the product's contract — every strange state answers "why?" in one click, rendered causally and spatially (doc 2 §4.2), honest at clock boundaries.

**Primary user tasks:** interrogate an X/Z · see the causal path on the circuit · jump to the origin · follow trails through chips.

**Layout (a canvas *mode*, not a screen):**

```
┌──────────────────────────────────────────────────────────────────┐
│ (header unchanged; transport still visible)                      │
│                                                                  │
│   ░░░░░░░░░░░░░░ everything else dimmed ░░░░░░░░░░░░░░░░░░░░░░   │
│                                                                  │
│   [probed wire]══════════╗  causal path: full-strength,          │
│                          ║  upstream from probe to origin        │
│        ░░░░              ║                                       │
│   ┌──────────────────────╨───────────────┐                       │
│   │ ✸ ORIGIN                             │ verdict card,         │
│   │ "X originates here: two outputs      │ anchored at origin    │
│   │  drive this net with different       │ (auto-pans into view) │
│   │  values."                            │                       │
│   │  driver 1: XOR.y (=1)  [jump]        │ both drivers also     │
│   │  driver 2: NOT.y (=0)  [jump]        │ highlighted on canvas │
│   │                              [done]  │                       │
│   └──────────────────────────────────────┘                       │
│                                                                  │
│   path through a chip:  ══════▶ [ ALU ▸ continues inside ]       │
│                                  (click = dive, trail carried)   │
└──────────────────────────────────────────────────────────────────┘
   Mirrored in inspector zone D: same verdict as a focusable list
   (accessibility-first surface, doc 3 §7.4).  Exit: Esc / [done] /
   click-away — ladder rung 2 (Why? is an announced mode).
```

**Navigation paths:** entry from any X/Z readout's `[why?]` (probe, watch row, glance long-affordance, `?` key on hover/selection). `[jump]` pans/dives to a cause. Trail-through-chip → dive with highlight carried (§7).

**State transitions / verdict variants (each is a wireframe state):**
1. *Contention* — two+ drivers listed, both highlighted (drawn above).
2. *Floating input* — "this AND input is connected to nothing" → path to the floating pin.
3. *Uninitialized state* — "this DFF has never been reset" → [reset] affordance on the card?  (open q).
4. *Sequential boundary (v1 honest scope)* — "this register captured an unknown value at an earlier clock edge — its history isn't recorded (yet)." Trail ends at the register, stated plainly.
5. *Cross-hierarchy* — path pierces chips with continue-inside affordances.

**Open questions:** does entering Why? auto-pause the sim (a moving X-source could re-route the path mid-read — recommendation: freeze the *display* of the path at invocation, leave the sim running, and say so on the card)? Multiple independent causes (an X from two merged unknowns): one card with cause list vs. sequential walking? Verdict card max size before it scrolls? Does the card offer "watch this net" as a follow-up action?

---

## 7. Hierarchy navigation

**Purpose:** depth without drowning (doc 1 principle 4): always know where you are, how you got there, how to get out — and never confuse a live instance with its definition.

**Primary user tasks:** dive into instances · surface · peek without committing · jump to any depth by name · enter/exit definition editing deliberately.

**Layout (editor chrome states):**

```
TOP (depth 0)                          DIVING (depth ≥1, live instance)
header: no breadcrumb                  header: ⌂ top ▸ ALU ▸ [Adder4]   "live instance"
                                       ┌────────────────────────────────────┐
                                       │ in1 ▷│  interior, live signals,    │
                                       │ in2 ▷│  read-only (probe/watch OK, │
canvas: project circuit                │      │  edits refused w/ hint:     │
                                       │      │  "this is a live instance — │
double-click chip ─────▶ dive          │      │  [Edit definition]")        │
Esc (ladder rung 4) ◀─── surface       │ out ◁│  boundary pins at edges     │
Home ◀────────────────── to top        └────────────────────────────────────┘

PEEK (transient, no navigation)        EDIT DEFINITION (explicit, ⌘Return)
┌────────────┐                         header: ⌂ … ▸ ALU   ┌──────────────────┐
│  ┌╌╌╌╌╌╌┐  │  Alt-hover chip:        │ "EDITING DEFINITION │
│  ╎interior╎ │  translucent live      │  — affects 3 instances"  [Done]     │
│  ╎signals ╎ │  interior in place;    │ live-signal layer OFF ("on the      │
│  └╌╌╌╌╌╌┘  │  release = gone;        │  bench"); full editing contract     │
└────────────┘  one level only         │  active; pins editable in inspector │
                                       └──────────────────────────────────────┘
```

**Navigation paths:** double-click = dive · breadcrumb click = jump up · Esc = one up (rung 4) · Home = top · ⌘K dotted paths (`alu.adder4.fa2`) = teleport · trace/Why? trails carry highlights through dives · `[Edit definition]` ⇄ `[Done]` between instance and definition.

**State transitions:** top ⇄ instance (depth n) ⇄ instance (depth n+1); instance → definition (explicit only) → back to the *same* instance view; peek is a held state, never a navigation. Prototype-validated detail: **dive entry clears canvas selection** (the double-click's first click selects; without clearing, Esc rung 3 silently eats a press — harness finding, now baseline).

**Open questions:** "inside a chip" canvas treatment at wireframe level — boundary ring vs. edge vignette (visual phase decides the form; wireframe reserves boundary-pin rendering at the edges). Editing a definition reached from instance #2 of 3: do the *other* instances render anywhere (ghost count chip "×3" in header is drawn — enough?)? Peek depth (one level only, confirmed?) and peek-while-diving?

---

## 8. Share / export flow

**Purpose:** one surface for everything outbound (doc 1 §7.5), structured by intent; pride stage of the journey. The Recipient persona's experience starts here.

**Primary user tasks:** save/share the project file · export a chip bundle · export a canvas image · (later) publish to community.

**Layout (overlay sheet over the editor):**

```
┌──────────────────────────────────────────────┐
│  SHARE  "ALU-8"                         [×]  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ PROJECT FILE                .quadstate │  │  whole project: doc + chips
│  │ everything: circuit, chips, watches,   │  │  + watches + ink (instrumen-
│  │ ink                         [Export ▾] │  │  tation travels, doc 2 §3.2)
│  ├────────────────────────────────────────┤  │
│  │ CHIP BUNDLE                            │  │
│  │ [HA ▾]  (picker: My Chips)             │  │  bundle = chip + transitive
│  │ contains: HA + 0 dependencies          │  │  deps, hash-verified (M6);
│  │ "verified identical everywhere"        │  │  deps summary shown before
│  │                            [Export ▾]  │  │  export
│  ├────────────────────────────────────────┤  │
│  │ IMAGE                                  │  │
│  │ region: (•)selection ( )view ( )all    │  │  doc 1 §10.8 — new scope,
│  │ format: (•)PNG  ( )SVG                 │  │  recommended; signal-state
│  │ signals: (•)as shown ( )schematic only │  │  language intact
│  │                            [Export ▾]  │  │
│  ├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤  │
│  │ (reserved: PUBLISH TO COMMUNITY)       │  │  IA slot only, absent in v1
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Navigation paths:** `[Share]` in editor header; chip bundle export also reachable from a chip's context menu and the palette (pre-selects that chip in the picker). `[Export ▾]` resolves per platform: native save dialog (Tauri/FS-Access) or download (web fallback) — the storage adapters exist (M5).

**State transitions:** closed → open (sheet) → per-row pickers → exporting → success toast ("saved to …" / "downloaded") → sheet stays open (multiple exports in one visit) → close. Cancel at the OS dialog returns to the sheet silently.

**Open questions:** file extensions and naming (doc 1 §11.4 still open: `.quadstate`? bundle extension?); image export defaults (selection vs. viewport when a selection exists?); does the sheet show a thumbnail preview of the image export before saving? Should the project row offer "include watches/ink" toggles, or is "everything always travels" the simpler promise (drawn: always — recommend keeping it)?

---

## What these wireframes deliberately exclude

Visual design (color, type, iconography, the 4-state visual language, part symbol art), motion specs (doc 1 §8 governs when that phase starts), the waveform view (Tier 2 reserved surface — the watch panel's mini-traces are its IA placeholder), the Community Library (reserved slots drawn only as regions), settings overlay contents, onboarding script content, and the iPad layout pass (the contract's touch/Pencil sections are provisional pending hardware; these wireframes are the desktop-lead structure they will adapt from).

## Next steps

1. Review: the per-screen Open Questions are the decision queue — the editor's transport placement (§3) and Create Chip's auto-arm question (§4) have the most downstream coupling.
2. Bus UX planning (doc 5 §4 tier-1 parts + splitter/bus interactions) — it will add elements to §3 and §5 surfaces and should land before visual design freezes the inspector/watch layouts.
3. Then the visual design phase: the 4-state language, part symbology, and the design tokens — applied to these structures.

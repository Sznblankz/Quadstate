# QuadState — Create Chip Visual Design

**Phase:** Visual design — document 10
**Date:** 2026-06-13
**Status:** Draft for review
**Fixed context (do not redesign):** VISUAL_EDITOR.md (signal language, tokens, divable-chip identity, Why? patterns), BUS_UX.md (bus pins, width tags), the bus/memory + gate symbology, WIREFRAMES.md §4 (the three-beat flow), EDITOR_INTERACTION_MODEL.md §5.5 (⌘G, *no group concept*, inline name), the prototype Card E findings (pin-prediction gate, "dissolve" promoted to baseline). **Engine:** `createChipFromSelection` — boundary-crossing nets become pins ("out" if any inside port drives the net, else "in"); one undoable command; centroid placement.
**Mandate:** design the *full* experience of turning a selected cluster into a reusable chip, as a signature QuadState moment, reusing the approved language. No new colors; signal colors stay reserved; indigo only for focus/selection; **no modal wizard.**

**The feeling to land:** a messy working circuit becomes a clean, reusable idea — in one gesture, comprehensibly, and reversibly. The "wow" is the *clean result and the smoothness*, never effects.

---

## 1. Selected-cluster state (before ⌘G)

The moment a chip-eligible cluster is selected, the canvas quietly previews the chip it could become — this is what makes the result feel *earned*, not arbitrary (and directly answers the prototype's pin-prediction gate).

- **Selection, communicated without hiding the work:** each selected part gets the indigo selection ring (editor §3); **internal wires keep their signal colors** so the cluster stays visibly *alive* — we never recolor live wires indigo, because signal stays the loudest thing. The cluster reads as "selected" via part rings + a **soft indigo hull** (a low-opacity rounded outline around the selection bounds, `--accent` at ~10%, no hard box).
- **Pin preview — the comprehension aid:** small **pin-marker dots** appear on the hull exactly where nets cross the selection boundary — **left for inputs, right for outputs** (mirroring the chip layout to come). A bus-crossing shows the **bus mark** (thick stub + slash + width tag). The user *sees the future interface before committing.*
- **The invitation:** a single quiet pill anchored above the hull — `⌘G  Create chip · 4 parts` — indigo affordance text, calm, not a big button. (On touch, the selection chip carries **Create chip** as a first-class action — it earns that, per the interaction doc.)
- Hovering the pill (or the hull) gently emphasizes the boundary-crossing nets, so "these become the pins" is legible on demand.

## 2. The ⌘G collapse moment

The signature transition — structural motion, **~280ms ease-out, interruptible** (motion doctrine), one smooth contraction. No particles, no flash.

- The cluster's parts and internal wires **contract toward the centroid**; the soft indigo hull **shrinks into the new chip's rounded-rect body**; the boundary-crossing nets **snap to pins** at the body edges — landing exactly where the preview dots were. Promise kept = magic earned.
- Internal live signals **fade as they're absorbed** (they continue *inside* the chip; the canvas now shows the body). The result is clean by construction.
- The body arrives wearing the **divable-chip identity** — double-outline + `⤢` corner glyph — so it instantly reads as "a chip you can dive into." It lands **selected** (indigo ring).
- Reduced-motion: the contraction collapses to a quick crossfade (cluster → chip), same end state.

## 3. Inline chip naming state

Immediately after collapse, an **inline name field** — never a dialog.

- A small `--surface-1` input with hairline + **indigo focus ring**, anchored just above the chip body, **auto-focused**, pre-filled with a selected provisional name (`Chip1`) so Enter-immediately works and typing replaces it. The **chip body shows the name live** as you type — the field *is* the body's label being edited in place.
- **Enter / blur commits; Esc keeps the provisional name** (never discards the chip — Esc here is "stop naming," not "undo"). 
- The derived **pins are visible and labeled** during naming; **pin labels are click-to-rename** (light control without a review modal — see §10). Primary focus stays the chip name.
- The rest of the canvas stays live and undimmed; only the field holds focus. Calm, in-place, fast.

## 4. Auto-derived pins (bus-aware)

Derived by the engine's boundary analysis, rendered in the approved symbology:

- **Inputs left, outputs right** (a net is an *output* if any inside port drives it, else an *input*). Each pin is a node with a small mono label on the body edge.
- **Bus-aware:** a multi-bit boundary net becomes a **bus pin** — thick stub + slash + width tag (`a[4]`, `sum[8]`) — identical to the bus-port symbology. The pre-collapse preview already showed these as bus markers, so width is never a surprise.
- **Names:** auto-derived, preferring meaningful names inherited from attached IO labels / net labels (so screen-reader users and humans both get sense, per the interaction doc); fallback `in1/out1`. Editable inline (§3).
- Because §1 previewed them and §3 lets you rename them, the interface feels *authored by you*, not imposed.

## 5. Refusal states (prevented first, explained in place)

Refusals are **prevented before they happen** and, when hit, explained **at the cause** — never a modal.

- **Preemptive eligibility:** the §1 invitation pill reflects eligibility. Eligible → `⌘G Create chip`. Ineligible → the pill states the fix quietly: *"Exclude the IN/OUT pins to make a chip"* or *"Select a part — wires alone can't be a chip."* Most refusals never occur because the user is told the path first.
- **On pressing ⌘G anyway**, the reason emphasizes and the **offending element is outlined** in a **neutral attention treatment** — a dashed `--text-2` ring, *not red* (red is reserved for signal X; a refusal isn't a signal state). The two engine cases:
  - **IO pins inside selection:** pill at the offending pin — *"IO pins can't live inside a chip — leave them out of the selection."* The IO pin(s) get the neutral ring.
  - **No external connections:** pill at the selection — *"This selection has no external connections — a chip needs at least one pin."*
- Calm, specific, anchored, dismissible by fixing the selection. Refusal is information, not alarm.

## 6. The new chip on the canvas

- A **divable chip** at the cluster's centroid: rounded-rect body, **double-outline + `⤢`**, the name on the body, auto-derived pins on the edges (bus pins thick+slashed), **live signal dots on its pins** (it's running — always-alive doctrine). Sized to fit its pins legibly.
- It lands **selected** (indigo ring), so the obvious next gestures work immediately: Alt-drag to duplicate, ⌘D to repeat-offset (the editor's ripple-build path), or double-click to dive in and verify.

## 7. The new chip in My Chips

- The palette's **MY CHIPS** section gains a row: a mini **chip silhouette tile** (tiny body + `⤢`) + the name, behaving like any part (drag = place one, click = arm stamp).
- **Arrival cue:** the new row gives a single brief indigo highlight (motion: *feedback*, ~once, then settles) — connecting "I made a thing" to "it's now in my toolbox, here." This is the only celebratory beat, and it's a whisper, not a confetti burst.

## 8. Auto-arm as stamp, or cursor free?

**Decision: leave the cursor free.** Rationale:
- Right after the naming beat, an armed cursor would mean a stray click *stamps another chip* — surprising, and a likely accident when you click to deselect. That violates "calm / no surprise."
- The fast-placement need (register files, repeated cells) is already served well by the **selected** chip: Alt-drag duplicates, ⌘D repeats the last offset (the editor's drumroll), or drag from My Chips. No need to auto-arm to be fast.
- So: create → name → cursor free, chip selected, ready for the next deliberate action. *(Auto-arm could later be a power-user preference; not the v1 default.)*

## 9. Undo & Dissolve Chip — the safety net, made visible

The fear to kill (Card E's "un-chip anxiety"): that chipping is a one-way door. Two clearly-different reversals, both using the same **expand** visual (chip → cluster), so the metaphor is consistent:

- **Undo (⌘Z):** the entire Create Chip is **one command** (engine). Undo *reverses the moment you just did* — the chip **expands back into the exact cluster** (positions, wires, signals restored), playing the collapse in reverse. The immediate safety net.
- **Dissolve to parts:** an **explicit forward verb** available **anytime, on any chip instance** (context menu + ⌘K) — not just right after creation. It **expands this instance back into its constituent parts in place**; the cluster lands selected. The chip *definition stays in My Chips* (other instances may exist; removing the definition is a separate "Delete from My Chips").
- **Why both:** Undo is time-reversal (only works as the last action); Dissolve is a standing operation (un-chip something you made weeks ago). Together with the reverse animation, they make chipping feel *safe and reversible* — which is what lets a Builder commit to the gesture freely.

## 10. Open questions & recommended decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Is a dedicated **pin-review beat** needed (confirm pins before finalize)? | **No for v1.** The always-on §1 pin preview + §3 click-to-rename give comprehension and control without a modal. Validate against the prototype's pin-prediction metric; add the review beat only if it fails. |
| 2 | **Auto-arm** the new chip as a stamp? | **No** (cursor free, §8). Revisit as a power-user preference. |
| 3 | **Pin reordering** at creation? | **Defer to edit-definition.** Naming-state allows *rename*, not *reorder* — keeps the moment light. |
| 4 | **Name collision** (two chips same display name)? | **Soft-allow** with a quiet inline hint ("a chip named X exists") — names are display metadata (engine note), structurally-identical chips legitimately share identity. No hard block. |
| 5 | Internal signals during collapse — keep or fade? | **Fade** (absorbed inside) — the clean result is the point. |
| 6 | Default provisional name | `Chip1` **selected** in the field (Enter-immediately works; typing replaces). |

## 11. Extension audit

- **New colors:** none. Signal colors reserved; refusals use neutral, not red.
- **Indigo usage:** selection ring, soft hull, pin-preview affordance, name-field focus ring, palette arrival cue — all *focus/selection*, consistent.
- **New elements:** the soft selection hull, pin-preview dots, the `⌘G` invitation pill, the inline name field (reuses the inspector input style), the palette arrival cue, the neutral refusal ring. All small, all within the approved language.
- **No modal** anywhere. Everything is on-canvas or in the existing palette.
- Reuses verbatim: divable-chip identity, bus-pin symbology, motion doctrine, inspection-free calm chrome.

## 12. Next steps

1. Review; confirm §8 (cursor-free) and §10.1 (no pin-review beat) — the two decisions with downstream weight.
2. Then the remaining surfaces — **Share sheet** and **Settings** — which inherit all of the above with little new invention, completing the core visual phase.

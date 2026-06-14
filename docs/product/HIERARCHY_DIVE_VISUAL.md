# QuadState — Hierarchy / Chip Dive Visual Design

**Phase:** Visual design — document 11
**Date:** 2026-06-13
**Status:** Draft for review · **refined 2026-06-13 (pass 1.1)** — live-instance state promoted to a visible mode badge; edit-exit relabeled "Back to instance". Provisionally approved.
**Fixed context (do not redesign):** VISUAL_EDITOR.md (breadcrumb, divable-chip identity, signal language, tokens, Why? card + placement), CREATE_CHIP_VISUAL.md (chip identity, refusal style), BUS_UX.md (bus pins), SIMULATION_DEBUGGING_UX.md §5 (instance vs definition, Why? trails), EDITOR_INTERACTION_MODEL.md §6 (dive/surface/peek/edit-definition keys, Escape ladder), prototype Card F (dive clears selection; read-only interior; breadcrumb; Home key; zoom-through).
**Mandate / north star:** *depth without confusion.* At every moment the user must know three things — **where they are, what they're editing, and how to get back out.** No new colors; signal colors reserved; indigo only for focus/selection; no modal.

**The governing cue:** the reserved signal language does the heaviest lifting by its *presence or absence*. **Live instance = signals on (the circuit is alive, you're watching a run). Editing definition = signals off (a neutral blueprint, because a definition has no single live state — it's shared by N instances).** That truth *is* the visual distinction; everything else reinforces it.

---

## 0. Tokens (neutrals only — no new colors)

| Token | Value | Use |
|---|---|---|
| `--wire-neutral` | `#5A6573` | Unpowered wire in **definition edit** (no live state to show) |
| `--bench` | `#0C0F15` | Definition-edit canvas tint — a hair cooler than `--bg`, the "on the bench" surface |
| `--boundary` | `rgba(255,255,255,0.10)` | The interior boundary frame (the chip's shell, seen from inside) |

All three are neutral; the signal palette, indigo accent, and chrome are untouched.

---

## 1. Double-click to dive

- **Double-click a chip** (or breadcrumb / ⌘K dotted-path / "continue inside" while tracing) → a **zoom-through** transition: the canvas zooms *into* the chip body until its boundary becomes the frame of the interior. Containment is *felt*, not just stated (structural motion, ~300ms ease-out, interruptible; reduced-motion → crossfade).
- The interior is the **same editor surface**, one level down — never a new window or tab. Depth is navigated, not multiplied (principle 4).
- **On entry, selection clears** (prototype Card F: the double-click's first tap selects; clearing keeps the Escape ladder honest so a later Esc surfaces cleanly).
- You land in **live-instance view** (§3) by default — watching this instance run.

## 2. Breadcrumb behavior

The breadcrumb is the primary "where am I" anchor — it lives in the header-left and **appears only at depth >0**:

```
⌂ top ▸ ALU ▸ Adder4 ▸ FullAdder        [ ● LIVE INSTANCE · 2 of 3 ]
```

- Ancestors are clickable (jump up any number of levels); the **current** level is `--text-1`, ancestors `--text-2`, separators `--text-3`, with the `⌂` home glyph at the root.
- **Deep nesting truncates the middle** (`top ▸ … ▸ Adder4 ▸ FullAdder`), the ellipsis expanding on click — the head and current level always stay visible.
- **Mode badge (refined — more visible).** Instance mode is no longer a faint tail; it's a distinct **pill badge** at the breadcrumb's right end: `--surface-2` fill, `--text-1` label `LIVE INSTANCE`, a small live dot, and the instance position spelled out — `2 of 3` (clearer than `2/3`). It reads as a *mode chip*, deliberately legible because which instance you're inside is load-bearing. The `· N of M` is shown only when >1 instance exists (hidden when unique — no clutter). In definition mode this badge is replaced by the mode bar (§3).

## 3. Live instance vs editing definition — the heart

Two modes of the *same* interior surface, made unmistakable:

| | **Live instance** (default on dive) | **Editing definition** (explicit) |
|---|---|---|
| Signals | **On** — full 4-state language, alive | **Off** — wires render `--wire-neutral`; no live state |
| Canvas | `--bg` (a live window) | `--bench` tint (on the bench) |
| Editable? | **No** — probe/watch yes, structural edits refused (§10) | **Yes** — full editing contract |
| Boundary pins | lit with this instance's live values | the editable interface (rename/reorder/width) |
| Header | breadcrumb `· live instance 2/3` | a persistent **mode bar** (below) |
| Scope | this one instance | **all N instances** |

The **definition-edit mode bar** is the standing, unmissable signal that you're changing a shared blueprint:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✎ Editing definition: FullAdder · affects 3 instances   [Back to instance] │
└──────────────────────────────────────────────────────────────────────┘
```

Neutral chrome (`--surface-2`), not indigo (indigo stays for focus), with the **"affects N instances" count** as the persistent warning. The exit reads **"Back to instance"** (refined — names the destination, clearer than a bare "Done"; "Done editing" is an acceptable alternate). Signals-off + bench tint + mode bar = three reinforcing cues that you are *not* watching a run, you are editing the thing all instances share.

## 4. Boundary pins inside the chip

- The interface pins dock to a faint **boundary frame** (`--boundary`) at the interior edges — **inputs on the left edge, outputs on the right**, mirroring the exterior layout so orientation carries inward. The frame *is* the chip's shell seen from the inside.
- **Live-instance view:** each boundary pin shows this instance's **live value** (what the parent is feeding in / what the interior drives out) — the bridge between parent and interior. Bus pins render thick + slashed + width-tagged (bus symbology).
- **Definition-edit view:** boundary pins are the **editable interface** — click to rename, drag to reorder, adjust width. This is the only place pin order/identity is changed (Create Chip deferred reorder here, §10.3 of that doc).

## 5. Signals carrying through the interior

- In live-instance view, the interior is just another live circuit: boundary inputs carry the parent's values, propagate through the interior gates in full 4-state color, out to the boundary outputs. You see **this instance's actual computation**.
- **Probe / glance / watch work at depth** (engine `bridge.probe` through hierarchy) — interior nets show this instance's live values, watchable like any net.
- **Instance identity matters:** instance 2 and instance 3 of the same chip share structure but show *different* live values — the breadcrumb's `· instance 2/3` answers "whose signals am I seeing?" This is also the honest answer to "why does this chip read differently in different places?" — independent instance state.

## 6. Why? trails through hierarchy

The flagship scales across depth with no new machinery (sim doc §5.1):

- When a Why? causal path (or a manual net trace) reaches a **chip boundary pin**, that pin shows a **"continue inside"** affordance. Activating it **dives with the trace carried** — zoom-through, the highlighted path resuming from the corresponding interior pin, the rest dimmed by the Why? scrim.
- The breadcrumb enters a **tracing state** (the path's state color tints the current crumb) so you know you're following a thread, not just browsing.
- **Buses:** the per-bit bus Why? (bus doc §10) traces a *specific bit* through a splitter and across the boundary into the interior.
- **Exit keeps the trail intact** — Esc backs out one level with the highlight preserved, so you can walk a fault up and down the hierarchy.

## 7. Exiting to the parent

Multiple consistent routes, all reversing the zoom-through:

- **Esc** → surface one level (Escape ladder rung 4: only when nothing's selected and no mode is active — exactly when it feels right).
- **`Home`** → surface to the top, any depth.
- **Breadcrumb** → click any ancestor to jump there.
- **Touch:** pinch-out-past-fit zooms "through" the boundary back to the parent — the inverse of the dive metaphor.
- Surfacing **restores the parent's viewport** (each level stores its return view) and lands with the chip body where you left it — no disorientation, no "where did I come from?"

## 8. Edit Definition — enter & exit

A deliberate **mode switch**, visually distinct from navigation:

- **Enter** (never accidental): from live-instance view, the **"Edit definition"** affordance (offered in the inspector, in the refusal hint §10, on the chip's context menu, or **⌘Return** on a selected chip). The label always names the consequence: *"Edit FullAdder — affects 3 instances."*
- **The transition is a crossfade mode switch, not a zoom** — signals fade out → bench tint fades in → mode bar slides in. *Different motion = different meaning:* dive/surface are zoom-through (navigation, changing *where*); instance↔definition is a crossfade (changing *what you're doing* at the same place). Keeping these two motions distinct is a core anti-confusion decision.
- **Exit:** `Back to instance` in the mode bar, **⌘Return** again, or Esc (the ladder treats active edit-definition as a rung above deselect). Returns to the **same instance** you were viewing, signals back on. The label naming the destination ("Back to instance") reinforces that exiting edit mode is a return, not a discard.

## 9. Changes affecting multiple instances

- The mode bar's **"affects N instances"** is the persistent, honest warning throughout the edit. It's the answer to "will this change other places?" — yes, and the count says how many.
- **Optional clarity affordance:** clicking the count **flashes/lists where the instances are** (navigate to them) — recommended as a light touch, not required for v1.
- **On exit**, all instances re-elaborate with the change (engine: full re-elaboration), each keeping its own independent live state. A brief, quiet confirmation may note "3 instances updated" (feedback motion, once) — reassurance that the shared change propagated, expected not surprising.

## 10. Refusing direct edits to a live instance

The guardrail that keeps instance/definition unambiguous:

- In live-instance view, structural edits (drag a part, delete, wire) are **gently refused** — you're watching a run, not editing the blueprint. The attempted target gives a brief **neutral pulse** (no destructive action), and an in-place hint appears at the cursor:

  > *This is a live instance — edit the definition to change it.  [Edit definition]*

- **Neutral, in-place, offers the path** (consistent with Create Chip refusals; never red — red is reserved for signal X). The `[Edit definition]` button is the one-click bridge into §8.
- **Inspection is always allowed** — glance, probe, watch are not edits; they work freely at depth. The line is *editing vs inspecting*, drawn clearly so probing a live instance never feels blocked while editing it never happens by accident.

---

## 11. The clarity model (how the three questions are always answered)

| The question | Always answered by |
|---|---|
| **Where am I?** | Breadcrumb path + the zoom-through that made containment felt + restored viewport on exit |
| **What am I editing?** | Signals **on** = watching a live instance (read-only); signals **off** + bench tint + mode bar = editing the definition (all N instances) |
| **How do I get out?** | Esc (one level) · Home (to top) · breadcrumb (any level) · pinch-out (touch) · `Done` (exit edit mode) — all reversing their entry motion |

Three reinforcing cues per distinction, never one alone — depth stays legible at any nesting.

## 12. Open questions & recommendations

| # | Question | Recommendation |
|---|---|---|
| 1 | Show the **other instances** while editing a definition? | Count in the mode bar for v1; clicking it to flash/navigate instances is a fast-follow, not required. |
| 2 | **Peek** (Alt-hover live interior, editor §6.3) relationship to dive | Peek = transient one-level preview (signals on, no nav); dive = committed. Keep distinct; peek never enters edit mode. |
| 3 | Instance **identity in breadcrumb** (`2/3`) when many instances | Show it when >1 instance exists; hide the `/N` when unique (no clutter). |
| 4 | Definition edit reachable from the **palette** (My Chips) too? | Yes — "Edit definition" on the My Chips row opens the definition directly (top-level bench), same mode, no instance context. Recommend. |
| 5 | Confirmation on **destructive definition edits** (deleting a pin used by instances) | A neutral inline warning at exit ("removing pin `cin` will disconnect 3 instances") — not a modal; recommend. |

## 13. Next steps

1. Review; confirm §3 (signals-off + bench + mode bar as the instance/definition distinction) and §8 (crossfade-not-zoom for mode switch) — the two anti-confusion load-bearers.
2. Then the remaining inherited surfaces — **Share sheet** and **Settings** — to complete the core visual phase.

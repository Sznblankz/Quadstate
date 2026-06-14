# QuadState — Settings & Command Palette Visual Design

**Phase:** Visual design — document 13 (the last core surface — completes the visual phase)
**Date:** 2026-06-13
**Status:** Draft for review · **refined 2026-06-13 (pass 1.1)** — Reduced motion lives only under "Appearance & Accessibility"; Input & devices is input-only; Dark-only v1 with no disabled "Light soon" shown. Provisionally approved.
**Fixed context (do not redesign):** VISUAL_EDITOR.md (tokens, scrim, indigo-for-focus, the quiet option-control style), EDITOR_INTERACTION_MODEL.md §9 (⌘K command palette — four result classes, the accessibility floor) + §13 (the input settings: wheel, Space, finger demotion), PRODUCT_DEFINITION.md §5–6 (Settings is an app-level overlay reachable from Home *and* Editor; project settings are almost nothing — rename/thumbnail are inline).
**Mandate:** two utility overlays, fully inherited. No new colors; indigo only for focus/selection; quiet chrome; dismissable; instant.

Both are **overlays, not destinations** (the two-shell model has no third place). They share one visual frame: centered, dark, scrim-dimmed, Esc/click-away to close.

---

## A. Command Palette (⌘K)

### A1. Rationale
The palette is three things at once (interaction doc §9): the **expert's whole UI** (verb-first muscle memory), the **discoverability surface** (every action shows its shortcut, which is how beginners become experts), and the **accessibility floor** (every command reachable by keyboard). So it must be *fast* (Linear-grade, instant) and *legible* (each row teaches). It is the most-used non-canvas surface in the app.

### A2. Layout

A centered overlay (~580px) sitting in the **upper third** (results need room below), over a light scrim (`rgba(11,13,17,0.55)`).

```
        ╭────────────────────────────────────────────────╮
        │  ⌕  create chip|                                │   search field (focused)
        ├────────────────────────────────────────────────┤
        │  ACTIONS                                         │
        │  ⤢  Create chip from selection           ⌘G    │ ← selected (indigo tint)
        │  ✎  Edit definition…                     ⌘↩    │
        │  ⎵  Pause simulation                      ⎵     │
        │  PARTS                                           │
        │  ▷  AND gate                                     │
        │  ▦  Register · width 8                           │
        │  PLACES                                          │
        │  ⌖  pc  (watch)                  top ▸ ALU      │
        │  ⤢  Adder4  (chip)              top ▸ ALU      │
        │  EXPLAIN                                         │
        │  ?  Why is the selected net X?                   │
        ├────────────────────────────────────────────────┤
        │  ↑↓ navigate   ↵ run   esc close                │   quiet footer hint
        ╰────────────────────────────────────────────────╯
```

### A3. The four result classes
One fuzzy field, ranked across all; grouped by class with small section labels:
- **ACTIONS** — every command, each with its **keyboard shortcut** right-aligned (mono). The teaching mechanism: you searched for it, now you see its shortcut, next time you'll skip the palette.
- **PARTS** — load a part for stamping (with width where parametric: `Register · width 8`). The part's **silhouette** is its icon.
- **PLACES** — jump to a chip / net / watch by name or dotted path (`alu.adder4.fa2`); a small **path hint** (breadcrumb) on the right shows where it lives.
- **EXPLAIN** — "Why is this X?" surfaced only when the selection qualifies — the flagship, one keystroke away.

### A4. Behavior & states
- **Selected row:** `--accent-quiet` fill (the calm indigo tint, not a loud bar) + the label in `--text-1`. Arrow keys move; **Enter runs**; Esc closes.
- **Empty query:** shows **recent + suggested** (your last few actions, common verbs) — never a blank panel.
- **No match:** a single quiet line — "No matches" — never an error.
- **Instant:** results update per keystroke with no spinner; this surface must never feel like it's thinking.
- **Touch/Pencil:** a persistent search affordance in chrome opens the same palette; Pencil Pro squeeze on empty canvas summons it at the tip. Same index everywhere.

---

## B. Settings overlay

### B1. Rationale
Settings is **app-level and modest** — appearance, input, canvas, simulation, about. Reached from the **Home gear and the Editor's ⌘K / overflow**, the *same overlay in both shells*. **Project settings barely exist** by design (principle: configure it never) — renaming a project and its thumbnail are inline in the editor header, *not here*. The job is to make a small set of preferences calm and obvious, not to build a control panel.

### B2. Layout

A centered overlay (~720px), **two-pane**: a left section list, a right controls pane. Scrim-dimmed, `[×]` / Esc close.

```
        ╭──────────────────────────────────────────────────────╮
        │  Settings                                        [×] │
        ├───────────────┬──────────────────────────────────────┤
        │ Appearance &  │  Input & devices                     │
        │  Accessibility│                                      │
        │ ▸ Input        │  Mouse wheel      [ Zoom | Pan ]     │
        │ ▸ Canvas       │  Space            (•) Tap=play/pause │
        │ ▸ Simulation   │                       + Hold=pan     │
        │ ▸ About        │                   ( ) Transport only │
        │               │  Pencil active    [✓] Fingers pan    │
        │               │                       only           │
        │               │  (Reduced motion lives under         │
        │               │   Appearance & Accessibility)        │
        ╰───────────────┴──────────────────────────────────────╯
```

### B3. Sections & contents
- **Appearance & Accessibility** — Theme: **Dark** (the committed identity default; Light is deferred and **not shown as a disabled "soon" option** — it appears only when implemented). **Reduced motion** toggle (mirrors the OS, overridable) — this is the *single home* for motion/accessibility prefs; it does not also appear under Input.
- **Input & devices** — *input choices only*: **Mouse wheel** `Zoom (default) · Pan` (the one input setting shipped for Figma-immigrant muscle memory); **Space** `Tap=play/pause + Hold=pan (default) · Transport only` (the Card C fallback, exposed); **Pencil active → Fingers pan only** toggle (the §13.4 demotion experiment). Reduced motion is intentionally *not* here. This is the most substantive pane.
- **Canvas** — Show grid dots, Snap to grid, default new-part width.
- **Simulation** — Default speed, Start Live on open.
- **About** — version, links (docs), and the **determinism trace digest** surfaced quietly as a "✓ verified" line — the brand's honesty signature, a footnote here rather than a banner.

### B4. Components
- **Overlay:** `--surface-1`, radius 16, `--shadow-hover`, scrim. Left nav: section rows, selected = `--accent-quiet` tint + `--text-1`. Right pane: setting rows (label `--text-1` left, control right).
- **Controls (all quiet, one accent):** **segmented** (`--surface-2`, selected segment `--text-1` + subtle indigo underline/tick), **radio** groups, **toggle** switches (off neutral, on `--accent`). Identical to the Share option-control style — no loud fills.
- **Setting row:** 13–14px label + a one-line `--text-3` description where helpful; hairline dividers between groups.

---

## C. Shared frame

Both overlays use the **same visual grammar**: centered, `--surface-1`, radius 16, soft elevation, scrim, `[×]`/Esc dismiss, indigo only for the selected/focused element, quiet everything else. They feel like two utilities cut from one cloth — and from the same cloth as Share, which is also a centered sheet. Consistency *is* the polish.

## D. Alternatives considered and rejected
1. **Settings as a full page/destination.** *Rejected* — the two-shell model has no third place; an overlay keeps Settings reachable from both shells without inventing a screen. Also reinforces "Settings is a utility, not somewhere you go" (product doc §6).
2. **Palette as a small dropdown under a search box.** *Rejected* — the palette is the expert's whole UI; it deserves a confident centered surface with room for typed result groups, not a cramped menu.
3. **Loud selected-row bar in the palette.** *Rejected* — the calm `--accent-quiet` tint reads clearly without shouting; a heavy bar would fight the "instant, light" feel.
4. **Project settings panel.** *Rejected* — almost nothing belongs there (rename/thumbnail are inline); a project-settings tab would be a page of emptiness contradicting "configure it never."
5. **Tabbed settings across the top.** *Rejected* — two-pane left-nav scales better as sections grow and is the familiar premium pattern (Linear/Arc).

## E. Open questions & recommendations
| # | Question | Recommendation |
|---|---|---|
| 1 | **Light theme** in v1? | **Dark only.** Do *not* show a disabled "Light · soon" option — omit it entirely until implemented. Dark is the identity default. (Confirmed.) |
| 2 | Palette **scope of "Actions"** | Register *every* command (the accessibility floor demands it); obscure ones can be palette-only. |
| 3 | Settings **persistence** | Local (local-first); per-device, not synced in v1. |
| 4 | Palette **recents** seeding | Last ~5 actions + a small curated set of common verbs for first use. |
| 5 | Where does **About's determinism digest** link? | A quiet "what's this?" → a one-paragraph explainer; not load-bearing. |

## F. Visual phase status (this completes the core)

With Settings & Palette, the core visual phase spans the **whole journey**:

`Home → Editor (signal language · symbology · transport · panels) → Create Chip → Hierarchy/Dive → Bus → Share/Export → Settings/Palette`

All built on **one token system, one reserved 4-state signal language, one indigo focus accent, one quiet-chrome philosophy** — no surface invented a new system. Remaining design work is *depth, not breadth*: the brand mark exploration, the part-symbology illustration finish, the motion-spec phase (product doc §8), and the iPad adaptation pass — each its own effort, all inheriting this foundation.

## G. Next steps
1. Review Settings & Palette; confirm §E.1 (Dark-only v1) and the input-settings set (§B3).
2. Optional: a short **visual-system summary doc** consolidating the tokens, signal language, and component inventory now that all core surfaces exist — useful as the single reference before any build or the motion phase.

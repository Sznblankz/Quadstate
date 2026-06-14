# QuadState — Visual Design: Home Screen

**Phase:** Visual Design — document 7 (first screen of the visual phase)
**Date:** 2026-06-13
**Status:** Draft for review
**Fixed structure:** WIREFRAMES.md §1 (Home). **Governing taste:** PRODUCT_DEFINITION.md §9 (visual philosophy) and §8 (motion, deferred). **Persona:** the Builder.
**Scope discipline:** this designs the Home screen only. Because Home is the first surface, it necessarily *seeds* the foundational tokens (color, type, spacing, elevation) that later screens will inherit — those are defined in §0 as provisional and extensible, not as the finished system. No editor, no other screen.

---

## 0. Foundations seeded by Home (provisional design tokens)

These exist because Home needs them; later screens will extend, not replace. The one hard rule from the product doc that shapes everything: **the 4-state signal colors are reserved — they appear only *inside* project thumbnails, never as chrome.** The brightest, most saturated pixels on the Home screen are the live wires inside a thumbnail. The chrome around them is monochrome neutral plus a single non-signal accent.

### Color — dark-first neutral ramp + one accent

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0D11` | App background (near-black, faintly cool) |
| `--surface-1` | `#13161C` | Cards at rest |
| `--surface-2` | `#1A1E26` | Hover / raised |
| `--surface-3` | `#222732` | Pressed / active chip |
| `--hairline` | `rgba(255,255,255,0.07)` | Default separations |
| `--hairline-strong` | `rgba(255,255,255,0.12)` | Hover edge, focuslessly drawn borders |
| `--text-1` | `#E8EBF1` | Primary text (never pure white) |
| `--text-2` | `#9AA2B1` | Secondary / metadata |
| `--text-3` | `#626A79` | Micro-labels, hints |
| `--accent` | `#6C72FF` | Indigo — the *only* saturated chrome color; primary action, focus ring |
| `--accent-hover` | `#7E83FF` | |
| `--accent-press` | `#5A60E6` | |
| `--accent-quiet` | `rgba(108,114,255,0.14)` | Selected/focus tint fills |

Accent is deliberately **indigo, not blue** — engine signal LO (`0`) is a desaturated blue (`#3F72B0`), so a blue accent would muddy the reserved signal language. Indigo reads "modern creative tool" (Linear/Arc lineage) and stays clear of all four signal hues.

Signal colors (reference only; used **inside thumbnails**, consistent with the engine): `0`=`#3F72B0`, `1`=`#43D689`, `X`=`#E8554E`, `Z`=`#8A93A3` (dashed treatment for Z).

### Type

- **UI sans:** `Inter` today; aspiration is a characterful grotesque (General Sans / Geist) when brand type is commissioned. `system-ui` fallback.
- **Mono:** `Geist Mono` / `JetBrains Mono` / `ui-monospace` — for dates, counts, and any value. **Tabular figures everywhere numbers live** (product doc §9: numbers are content).

| Role | Size / weight / tracking |
|---|---|
| Wordmark | 15 / 600 / -0.01em |
| Hero project name | 24 / 600 / -0.015em |
| Section micro-label ("RECENTS") | 11 / 600 / +0.10em / UPPERCASE / `--text-3` |
| Card title | 14 / 550 |
| Metadata (mono, tabular) | 13 / 450 / `--text-2` |
| Button label | 14 / 550 |
| Empty-state headline | 32 / 600 / -0.02em |

### Spacing, radius, elevation

- **8-pt grid** (4-pt sub-steps): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
- **Radii:** card `16` · thumbnail `10` · button `10` · chip/pill `8` · search & template pills `999`.
- **Elevation = surface step + soft shadow, not borders** (product doc §9 "depth through elevation"). Cards lift by going `--surface-1`→`--surface-2` on hover; a hairline appears only on hover. Shadows are subtle on dark:
  - `--shadow-card`: `0 1px 2px rgba(0,0,0,.45), 0 6px 20px rgba(0,0,0,.30)`
  - `--shadow-hover`: `0 2px 4px rgba(0,0,0,.5), 0 14px 34px rgba(0,0,0,.40)`

---

## 1. Design rationale

**The screen has one job: get the Builder back into a long-lived project in one glance and one click.** Everything else is subordinate. The Builder doesn't browse a launcher — they return to *the* project they've been building for weeks. So the design is organized around a single dominant **Continue** card and exactly one filled accent button on the whole screen (`Resume`). That lone accent is the visual hierarchy: your eye lands on it before anything else.

**It must read as a creative gallery, not a file manager.** The reference is Procreate's gallery and Arc's spaces — work shown as *images of itself*, on a calm dark ground, with generous space. The thumbnails are real renders of the circuit on the editor's own dark canvas, so Home feels like looking through windows into the workshop. This is also where the product's identity literally shows: the only saturated color on the screen is signal state inside those windows. A green `1` wire glowing in a thumbnail is the brand, delivered without a single decorative flourish.

**Calm and dark because the Builder lives here for hours.** Dark-first is not a theme choice; it's an ergonomic one (long sessions) and an identity one (signal colors bloom on dark). The chrome recedes to near-monochrome so that nothing competes with the work. Borders are mostly absent — separation comes from surface lightness and space, which feels more expensive and less "engineering CAD" than boxes-in-boxes.

**Hierarchy of intent, top to bottom:** Resume (hero) → find another recent (gallery grid) → start something new (quiet right rail) → learn via templates (subordinate in the rail) → community (reserved, absent). This maps the Builder's actual frequency: resume constantly, create occasionally, learn rarely. The wireframe's instinct (hero = Continue, not New) is honored and sharpened.

**Restraint as luxury.** One accent color. Two type families. No gradients, no glassmorphism, no icon zoo. The premium feel comes from spacing discipline, tabular numerics, soft elevation, and the quality of the thumbnails — not from ornament. This is the Linear/Apple-HIG lesson: confidence reads as calm.

---

## 2. Refined layout

Desktop reference **1440 × 900**; content column **capped at 1200px and centered** (premium screens don't stretch edge-to-edge). Below 1200 the column goes fluid with 32px gutters; the hero/rail split collapses to stacked at <900.

```
┌──────────────────────────────────────────────────────────────────────────┐ 56px top bar
│  ◴ QuadState                              [ Search…  ⌘K ]   [⚙]            │  (bar is full-bleed,
├──────────────────────────────────────────────────────────────────────────┤   its contents align
│  ‹———————————————— 1200px content column, centered ————————————————›       │   to the 1200 column)
│                                                                            │  40px
│   JUMP BACK IN                                                             │  ← eyebrow micro-label
│  ┌───────────────────────────────────────────┐  ┌──────────────────────┐  │
│  │  ░░░░░░░ thumbnail (16:9) ░░░░░░░░░░░░░░░░  │  │  + New circuit       │  │  hero spans 8 of 12
│  │  ░░ real schematic render, signal glow ░░  │  │  (quiet raised card) │  │  rail spans 4 of 12
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  ├──────────────────────┤  │  gap 24
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │  TEMPLATES           │  │
│  ├───────────────────────────────────────────┤  │  ▣ Half-adder        │  │
│  │  8-bit ALU                       [Resume ▸]│  │    teaches gates→sum │  │
│  │  edited 2h ago · 142 parts · 9 chips · d4  │  │  ▣ SR latch          │  │
│  └───────────────────────────────────────────┘  │  ▣ 4-bit counter     │  │
│                                                  │  ▣ 7-segment         │  │
│                                                  │  ─────────────────── │  │
│                                                  │  ⤓ Open file…        │  │  quiet ghost
│                                                  └──────────────────────┘  │
│                                                                            │  48px
│   RECENTS                                                  sort: Recent ▾  │  ← micro-label + control
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ ░thumb░░░░ │  │ ░thumb░░░░ │  │ ░thumb░░░░ │  │ ░thumb░░░░ │            │  4-up grid
│  │ ░░░░░░░░░░ │  │ ░░░░░░░░░░ │  │ ░░░░░░░░░░ │  │ ░░░░░░░░░░ │            │  card minmax(248,1fr)
│  ├────────────┤  ├────────────┤  ├────────────┤  ├────────────┤            │  gap 24
│  │ 4-bit CPU  │  │ Mux tree   │  │ UART rx    │  │ Shift reg  │            │
│  │ yesterday  │  │ 3d ago     │  │ last week  │  │ Mar 2      │            │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘            │
│                                                                            │
│  ┄┄┄┄┄┄┄ (reserved band: COMMUNITY LIBRARY — not rendered in v1) ┄┄┄┄┄┄┄   │
└──────────────────────────────────────────────────────────────────────────┘
```

Key refinements over the wireframe:
- The hero's info **shelf sits below the thumbnail inside the same card** (not an overlay scrim) so text never fights signal colors in the render — and the only accent button on the screen lives here.
- Stat chips on the hero (`142 parts · 9 chips · d4` = depth 4) give the Builder a glanceable sense of scale — a small thing that says "this tool respects ambitious projects."
- The hero project is **excluded from Recents** (no duplication); Recents begins at the second-most-recent.
- Templates are a **vertical list in the rail**, not a section competing with Recents — correctly subordinate for the Builder.

---

## 3. High-fidelity screen description

**Top bar (56px, full-bleed, `--bg` with a 1px `--hairline` bottom edge).** Left: a small **mark** — a 2×2 dot glyph representing the four states 0/1/X/Z (one filled, one hollow, one accent, one dashed) — followed by the wordmark "QuadState" at 15/600. Right cluster: a **search pill** (`Search… ⌘K`), pill radius, `--surface-1` fill, `--text-3` placeholder, a leading magnifier glyph; and a **settings gear** icon button (32×32, `--text-2`, hover lifts to `--surface-2`). No avatar (no accounts in v1).

**Eyebrow + hero.** 40px below the bar, the micro-label `JUMP BACK IN` (11/600/uppercase, `--text-3`). Beneath it, the **Continue card**: spans 8 columns, ~420px tall, `--surface-1`, radius 16, `--shadow-card`.
- **Thumbnail region** (top, 16:9): a real render of the project on the editor's dark canvas — faint dot-grid, rounded-rect components, hub-routed wires, with signal colors live as of last save. A barely-perceptible inner vignette focuses the eye; a 1px inset `--hairline` frames it. This region carries the only saturated pixels on screen.
- **Info shelf** (bottom, ~92px, solid `--surface-1`): project name "8-bit ALU" at 24/600 on the left; below it a metadata line in **mono/tabular** — `edited 2h ago · 142 parts · 9 chips · d4` in `--text-2`. Right-aligned, vertically centered: the **`Resume ▸` button** — the single filled `--accent` element on the whole screen, 14/550, radius 10, with a subtle press state. Clicking anywhere on the card resumes; the button is the focal affordance.

**Right rail (4 columns).** A stack with 16px internal rhythm:
- **`+ New circuit`** — a quiet raised card (`--surface-1`, hairline on hover), leading `+` glyph, 14/550. Subordinate to Resume by having no fill.
- **`TEMPLATES`** micro-label, then a vertical list of 4 rows. Each row: a 40×40 **mini-diagram tile** (`--surface-2`, radius 8, containing a tiny schematic glyph), then title (14/550) + a one-line "teaches…" subtitle (12/400 `--text-3`). Rows hover to `--surface-2`. A `Browse all ▸` link appears only if >4 templates exist.
- A hairline divider, then **`⤓ Open file…`** as a quiet ghost row (`--text-2`) — the only path to off-recents files on web.

**Recents (full width, 48px below hero).** Micro-label `RECENTS` left; a quiet `sort: Recent ▾` control right (Recent / Name / Created). Below: a responsive grid, `minmax(248px, 1fr)`, gap 24, 4-up at 1200. Each **recent card**: thumbnail (16:10, same render treatment, radius 10 top), then a compact text block — name (14/550, single line, ellipsis) and a relative modified date (13/450 mono `--text-2`). **Hover**: card lifts `--surface-1`→`--surface-2`, `--shadow-hover`, a hairline edge appears, and a `⋯` overflow button fades in top-right of the thumbnail (menu: Rename, Duplicate, Export…, Reveal in folder, Delete). Whole card is the open target; `⋯` stops propagation.

**Reserved community band.** At the very bottom, the layout reserves a full-width region for the future Community Library. In v1 it is **not rendered** — the page simply ends after Recents with comfortable bottom padding (64px). The slot exists in the layout grid only.

**Focus & keyboard.** Tab order: search → gear → Resume → New → each template → Open → each recent. Focus ring = 2px `--accent` at 2px offset, never color-only. ⌘K opens the palette overlay (recents and actions searchable) from anywhere.

**Overall feel:** a quiet, dark, gallery-like room. Lots of air. One thing glows (your work, inside the thumbnails) and one thing beckons (Resume, in indigo). Nothing else asks for attention.

---

## 4. Alternatives considered and rejected

1. **Sidebar-nav app shell (VS Code / Linear layout).** A persistent left sidebar with Home / Projects / Templates / Community.
   *Rejected:* over-structures a screen the Builder visits for two seconds. A launcher isn't a workspace; permanent nav chrome contradicts "canvas is the product." The two-shell model (Home ⇄ Editor) already rejects in-app nav scaffolding.

2. **Equal-tile grid of all entry points (the literal wireframe read as six equal cards).**
   *Rejected:* treats every visit as a first visit and gives `New`/`Settings` the same weight as resuming a CPU you've built for a month. Fails the Builder's actual frequency. The hero/rail asymmetry encodes intent.

3. **Thumbnail-as-scrim hero** (text overlaid on the render with a gradient scrim, Procreate-detail style).
   *Rejected:* signal colors inside the render would fight the overlaid text, and a scrim means either dimming the work or risking unreadable metadata. The separate info shelf keeps both the render honest and the text crisp — and respects the reserved-color rule.

4. **Light theme (or light Home → dark editor).**
   *Rejected:* a light Home then a dark editor is a jarring world-switch every launch, and signal colors lose their bloom against light thumbnails. Dark-first is an identity and ergonomic commitment, not a per-screen toggle. (A light *option* may come later; the default is dark.)

5. **Blue brand accent** (matching the prototype's `#4f9cf9`).
   *Rejected:* collides with signal LO (`0` = desaturated blue), muddying the reserved 4-state language the moment a thumbnail sits next to a blue button. Indigo stays clear of all four signal hues and reads more "creative tool."

6. **Dense, information-rich rows (Notion/database table of projects).**
   *Rejected:* maximizes projects-per-screen but kills the gallery feeling and buries the work itself. The Builder has few, deep projects — not hundreds of shallow ones — so visual richness per project beats density.

---

## 5. Figma-recreatable text mockup

Frame `Home / Desktop` — **1440 × 900**, fill `#0B0D11`. Inner content frame `Content` — width **1200**, centered (x = 120), auto-layout vertical, item-spacing 0, the children positioned per below. All numbers in px.

```
FRAME  Home/Desktop  1440×900  fill #0B0D11
│
├─ FRAME  TopBar  1440×56  fill #0B0D11  stroke-bottom 1px #FFFFFF@7%
│   ├─ GROUP  Brand            x120 y18  (aligned to content-left)
│   │   ├─ VECTOR  StateMark  20×20  — 2×2 dots: TL filled #9AA2B1, TR hollow stroke #626A79,
│   │   │                              BL filled #6C72FF, BR dashed stroke #8A93A3
│   │   └─ TEXT   "QuadState"  Inter 15/600 -0.01em  #E8EBF1   x+28
│   ├─ FRAME  SearchPill  220×34  x900 y11  fill #13161C  radius 999
│   │   ├─ ICON  search  16  #626A79  pad-left 12
│   │   └─ TEXT  "Search…"  Inter 13/450  #626A79
│   │   └─ TEXT  "⌘K"  GeistMono 12  #626A79  right-aligned pad-right 12
│   └─ BUTTON  Gear  32×32  x1288 y12  icon ti-settings 18 #9AA2B1  radius 8  (hover fill #1A1E26)
│
├─ TEXT   "JUMP BACK IN"  Inter 11/600 +0.10em UPPER  #626A79   x120 y96
│
├─ FRAME  HeroRow  1200×420  x120 y120  auto-layout horizontal  gap24
│   ├─ CARD  Continue  768×420  fill #13161C  radius16  shadow(0 6 20 #000@30 / 0 1 2 #000@45)
│   │   ├─ FRAME  Thumb  768×328  radius16(top)  fill #0B0D11
│   │   │     • dot-grid 24px spacing  #222732@60%
│   │   │     • schematic render: rounded-rect parts #1D2733 stroke #3B4A5D,
│   │   │       wires hub-routed; signal wires #43D689 (1), #3F72B0 (0), one #E8554E (X);
│   │   │       inner vignette + 1px inset stroke #FFFFFF@7%
│   │   └─ FRAME  Shelf  768×92  fill #13161C  pad 20/24  auto-layout horizontal space-between
│   │         ├─ STACK left
│   │         │   ├─ TEXT  "8-bit ALU"  Inter 24/600 -0.015em  #E8EBF1
│   │         │   └─ TEXT  "edited 2h ago · 142 parts · 9 chips · d4"  GeistMono 13/450  #9AA2B1
│   │         └─ BUTTON  Resume  fill #6C72FF  radius10  pad 10/16
│   │               TEXT "Resume"  Inter 14/550 #FFFFFF  + icon ti-chevron-right 16
│   └─ FRAME  Rail  384×420  auto-layout vertical  gap16
│       ├─ CARD  NewCircuit  384×64  fill #13161C  radius12  (hover stroke 1px #FFFFFF@12)
│       │     ICON ti-plus 18 #9AA2B1 + TEXT "New circuit" Inter 14/550 #E8EBF1
│       ├─ TEXT "TEMPLATES"  Inter 11/600 +0.10em UPPER #626A79
│       ├─ LIST  Templates  auto-layout vertical gap4
│       │   └─ ROW (×4)  384×56  radius10  pad 8/12  (hover fill #1A1E26)
│       │        ├─ TILE  40×40  fill #1A1E26  radius8  + mini schematic glyph
│       │        └─ STACK  TEXT title Inter 14/550 #E8EBF1
│       │                  TEXT "teaches gates → sum" Inter 12/400 #626A79
│       │        (titles: Half-adder, SR latch, 4-bit counter, 7-segment)
│       ├─ DIVIDER 1px #FFFFFF@7%
│       └─ ROW  OpenFile  pad 8/12  ICON ti-download 16 #9AA2B1 + TEXT "Open file…" 14/450 #9AA2B1
│
├─ FRAME  RecentsHead  1200×20  x120 y588  space-between
│   ├─ TEXT "RECENTS"  Inter 11/600 +0.10em UPPER #626A79
│   └─ DROPDOWN "sort: Recent ▾"  Inter 13/450 #9AA2B1
│
├─ GRID  Recents  1200 wide  x120 y620  columns 4  gap24  (card minmax 248)
│   └─ CARD (×4)  276×216  fill #13161C  radius12  (hover → fill #1A1E26 + shadow-hover + stroke 1px #FFFFFF@12)
│        ├─ FRAME Thumb  276×155  radius12(top)  fill #0B0D11  (render as hero thumb, smaller)
│        │     └─ BUTTON ⋯  28×28  top-right  opacity 0 → 1 on card hover
│        └─ FRAME Meta  276×56  pad 12/14
│              ├─ TEXT name  Inter 14/550 #E8EBF1  (truncate)  (4-bit CPU / Mux tree / UART rx / Shift reg)
│              └─ TEXT date  GeistMono 13/450 #9AA2B1  (yesterday / 3d ago / last week / Mar 2)
│
└─ (bottom padding 64;  reserved Community band not rendered in v1)
```

Interactive states to define as Figma variants/components: `RecentCard` { default, hover, focused } · `Resume` { default, hover #7E83FF, pressed #5A60E6, focus-ring } · `TemplateRow` { default, hover } · `SearchPill` { default, focus }. Thumbnail is a component `ProjectThumb` with a `signalsVisible` boolean and a `placeholder` variant (dot-grid + centered ghost mark) for never-saved projects.

---

## 6. Empty state (first launch, no projects)

Replaces hero **and** Recents with a single centered welcome — warm and inviting, selling the product before any work exists. The screen must feel like a beginning, not an absence.

```
┌──────────────────────────────────────────────────────────────┐
│  ◴ QuadState                          [ Search… ⌘K ]   [⚙]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                         ◴  (mark, large)                     │
│                                                              │
│               Build your first circuit                       │  32/600 -0.02em
│      Design logic by hand, fold it into chips, and           │  16/400 --text-2
│      watch real signals — including the unknowns.            │  (≤2 lines, centered)
│                                                              │
│        ┌───────────────────────┐   ┌───────────────────┐     │
│        │  + Start a blank canvas│   │  ⤓ Open a file    │     │  primary accent / ghost
│        └───────────────────────┘   └───────────────────┘     │
│                                                              │
│      OR START FROM A TEMPLATE                                │  11/600 micro-label, centered
│   ┌────────────┐   ┌────────────┐   ┌────────────┐           │
│   │ ▣ diagram  │   │ ▣ diagram  │   │ ▣ diagram  │           │  3 starter cards
│   │ Half-adder │   │ SR latch   │   │ 4-bit count│           │
│   │ learn the  │   │ memory in  │   │ counting & │           │
│   │ basics     │   │ a loop     │   │ clocks     │           │
│   └────────────┘   └────────────┘   └────────────┘           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- The composition is vertically centered in the content area, max-width ~720px, everything center-aligned.
- Copy is the product's voice: honest about the 4-state hook ("including the unknowns") without jargon. Two CTAs — `Start a blank canvas` (the only accent fill) and a quiet `Open a file`.
- Three template starter cards double as the onboarding curriculum (per product doc §7.8: you learn *in* a real document). Each opens a duplicated, editable template into the editor with its own one-time in-canvas hint.
- This is the natural home for a future entrance animation (the mark assembling from four states) — motion phase, deferred.

---

## 7. Open questions

1. **Mark design.** The 2×2 four-state glyph is a concept, not a finished logo — does the brand mark warrant a dedicated exploration before it's load-bearing across screens? (Recommend: yes, but Home can ship with the placeholder glyph.)
2. **Thumbnail freshness.** Static capture at save time is the wireframe decision. Acceptable that a thumbnail can lag the true last state until next save? (Recommend: yes for v1; note it.)
3. **Template lineup & count** — final 4 for the rail / 3 for empty state (ties to doc 5 standard-library chips and doc 1 §11.5). Content decision, not visual.
4. **Recents capacity** — single 4-up row with "show all", or a scrolling multi-row grid once a Builder has many projects?
5. **Web vs. desktop affordance weight** — does `Open file…` deserve more prominence on web (only path to non-recent files) than on desktop (recents + OS)? Possible per-platform variant.
6. **Density preference** — confirm the gallery-over-density bet with a Builder who has 30+ projects; the design assumes few-and-deep.

## 8. Next steps

1. Review; resolve §7, especially the mark (1) and template content (3).
2. Bus UX planning (doc 5 §4) before the editor's visual design, so inspector/watch layouts aren't designed twice.
3. Then the editor visual design — where the 4-state language and part symbology get their full treatment (Home only previews them, inside thumbnails).

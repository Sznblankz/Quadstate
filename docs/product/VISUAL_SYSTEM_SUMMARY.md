# QuadState — Visual System Summary

**The single build-ready reference.** Consolidates docs 7–13 (Home, Editor, Create Chip, Hierarchy, Bus, Share, Settings/Palette). Source docs hold rationale; this holds the spec. Date: 2026-06-13.

**Three laws (everything derives from these):**
1. **Signal colors are reserved** — `0/1/X/Z` appear only on the canvas, in watch values, and inside image previews. Never as chrome.
2. **Indigo is only focus/selection.** Refusals are neutral, never red. The most saturated pixels on screen are always *signal state*.
3. **No new system per surface** — one token set, one signal language, one accent, one quiet-chrome frame across all screens.

---

## 1. Tokens

### Color — neutrals + one accent (chrome)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0D11` | App / canvas background |
| `--surface-1` | `#13161C` | Cards, panels, overlays at rest |
| `--surface-2` | `#1A1E26` | Hover / raised / selected-nav tint base |
| `--surface-3` | `#222732` | Pressed / active segment |
| `--hairline` | `rgba(255,255,255,0.07)` | Default separations |
| `--hairline-strong` | `rgba(255,255,255,0.12)` | Hover edge |
| `--text-1` | `#E8EBF1` | Primary text |
| `--text-2` | `#9AA2B1` | Secondary / metadata |
| `--text-3` | `#626A79` | Micro-labels, hints |
| `--accent` | `#6C72FF` | Indigo — focus/selection only |
| `--accent-hover` / `--accent-press` | `#7E83FF` / `#5A60E6` | |
| `--accent-quiet` | `rgba(108,114,255,0.14)` | Selected-row / focus tint fill |

### Color — canvas/part (editor)
| Token | Value | Use |
|---|---|---|
| `--part-fill` | `#14181F` | Component body |
| `--part-edge` | `rgba(255,255,255,0.12)` | Chip-rect outline |
| `--part-stroke` | `rgba(255,255,255,0.16)` | Gate silhouette outline (slightly stronger) |
| `--pin` | `#7E93AB` | Pin nodes |
| `--label` | `#AEB6C4` | Part labels |
| `--grid-dot` | `rgba(255,255,255,0.05)` | Canvas dot grid |

### Color — hierarchy neutrals (no new hues)
| Token | Value | Use |
|---|---|---|
| `--wire-neutral` | `#5A6573` | Unpowered wire in definition-edit |
| `--bench` | `#0C0F15` | Definition-edit canvas tint ("on the bench") |
| `--boundary` | `rgba(255,255,255,0.10)` | Interior shell frame |

### Color — RESERVED signal palette (canvas / watch / image only)
| State | Color | Non-color channel |
|---|---|---|
| `1` high | `#43D689` | solid **+ halo** (only state that glows) |
| `0` low | `#3F72B0` | solid, flat, ~85% opacity (no glow) |
| `X` unknown | `#E8554E` | **dash-dot** `9 4 2 4` (looks wrong) |
| `Z` disconnected | `#8A93A3` | **even dash** `6 5`, ~70% opacity |

---

## 2. Signal state language (FINAL)

- **Channel allocation:** color = hue identity; **pattern + glow = the redundant, grayscale-safe channel; stroke thickness = bus width, reserved.** States never use thickness.
- **Never color alone** — every state reads from pattern/glow too (colorblind + grayscale safe).
- **Transition motion:** ~110ms crossfade at the moment a wire changes; otherwise fully static. At max sim speed, states snap (no queued animation).

---

## 3. Bus visual rules (FINAL)

- **Width → thickness:** 1-bit base · 2–8 bit +60% · 9–64 bit +120%. Plus a **mono width tag** (buses only; 1-bit none).
- **Aggregate precedence** (stroke shows *drive-health*; value lives in panel):
  1. any bit **X** → red dash-dot
  2. else any bit **Z** → gray even-dash
  3. else all **1** → green + halo
  4. else all **0** → blue (matches scalar `0`)
  5. else **mixed driven** → green solid, **no halo**
- **Bus pin mark:** thick pin + diagonal **slash** + width tag (1-bit pin = plain node).
- **Watch:** 4-state-honest digits (a hex nibble with any X → `X` red; any Z → `Z` gray); dec/signed show `—` if any X/Z. **Expandable bit-strip** = per-bit cells (state fill + literal `0/1/X/Z` digit), nibble-grouped, wrap-at-16, per-bit `→ why?`. Bus mini-trace = change-tick band.
- **Width mismatch:** inline `N ✗ M` + offer **insert splitter** (repair, not refuse).
- **Net label:** small `--surface-1` pill, mono, on the wire (named nets; hover/selection otherwise).

---

## 4. Typography

- **UI sans:** Inter (aspiration: General Sans / Geist), `system-ui` fallback.
- **Mono:** Geist Mono / JetBrains Mono / `ui-monospace` — all values, **tabular figures**.
- **Two weights only** in spirit: 450/550/600 used; never heavier.

| Role | Size / weight / tracking |
|---|---|
| Empty-state headline | 32 / 600 / -0.02em |
| Hero / chip name | 24 / 600 / -0.015em |
| Section / dialog title | 15 / 600 |
| Card title · button | 14 / 550 |
| Body · breadcrumb · meta (mono) | 13 / 450 |
| Micro-label | 11 / 600 / +0.10em / UPPERCASE / `--text-3` |

---

## 5. Spacing · radii · elevation

- **Grid:** 8-pt (4-pt sub-steps): `4 8 12 16 20 24 32 40 48 64`.
- **Radii:** card `16` · thumbnail/preview `10` · button `10` · chip/tile `8` · pill/search `999`.
- **Elevation = surface step + soft shadow, not borders.** Hover lifts `--surface-1`→`--surface-2`; hairline appears on hover.
  - `--shadow-card`: `0 1px 2px rgba(0,0,0,.45), 0 6px 20px rgba(0,0,0,.30)`
  - `--shadow-hover`: `0 2px 4px rgba(0,0,0,.5), 0 14px 34px rgba(0,0,0,.40)`

---

## 6. Core components

| Component | Spec |
|---|---|
| **Signal wire** | `{state, width}` — §2/§3. The shared root symbol. |
| **Gate** | Drawn silhouette (AND D-body, OR/XOR shields, NOT triangle+bubble, NAND/NOR +bubble, DFF rect+clock-notch). `--part-stroke`, no text on iconic gates. |
| **Chip** | Rounded-rect + **double-outline + `⤢`** (divable tell) + name. |
| **Bus/mem parts** | Splitter (bus-bar + ranged taps), Register (DFF+stacked-top+bus D/Q), Mux (trapezoid+narrow sel), Constant (value-on-body source). |
| **Palette row** | rest / hover (`--surface-2`) / **armed = 2px indigo left-bar + indigo tile border + brighter label, NO fill**. Drag=place one, click=arm stamp. |
| **Transport** | Header-center pill; **LIVE** (advancing `t=` counter = liveness) vs **PAUSED** (`--surface-3`, frozen counter). `S` = step. |
| **Breadcrumb + mode badge** | `⌂ top ▸ … ▸ current` (ancestors clickable, middle truncates) + **`● LIVE INSTANCE · N of M`** pill (when >1 instance). |
| **Definition mode bar** | `--surface-2`: "Editing definition: X · affects N instances · **Back to instance**". |
| **Watch row** | collapsed (name·value·base·mini-trace·×) / expanded bit-strip + base toggle. Expandable from day one. |
| **Why? card** | Tethered by leader line to origin; state token + question + verdict (hero) + cause rows w/ `→ jump` + `Done`. Collision-aware placement (§8). |
| **Health pill** | Monochrome count; click cycles findings (canvas wears the red). |
| **Selection / transients** | indigo ring + 12% glow · marquee (accent-quiet fill) · wire preview · stamp ghost (45% + banner). |
| **Create-chip set** | soft indigo hull · boundary **pin-preview dots** (in left/out right, bus marks) · `⌘G` invitation pill · inline name field (indigo focus). |
| **Refusal** | Neutral pill at the cause + dashed `--text-2` ring (**never red**) + the fixing action. |
| **Net label / width tag** | small mono, monochrome chrome. |

---

## 7. Overlay behavior

- **One frame** for Share, Command Palette, Settings: centered, `--surface-1`, radius 16, `--shadow-hover`, **scrim** `rgba(11,13,17,0.55–0.62)`, `[×]` / Esc / click-away dismiss, indigo only on the selected/focused element.
- **Share:** intent-first rows (Project file `.quadstate` / Chip bundle `.qschip` / Image); **primary follows focus, default = Project file**; "verified identical" visible, hash in details; **multi-shot** (stays open); Publish hidden in v1.
- **Command Palette (⌘K):** upper-third; fuzzy field → **Actions** (show shortcut) / **Parts** (silhouette, load-to-stamp) / **Places** (chips·nets·watches, dotted paths) / **Explain**. Selected = `--accent-quiet`. Empty = recents + curated starters. Every command registered (a11y floor). Instant, no spinner.
- **Settings:** two-pane, app-level (Home gear + Editor); sections **Appearance & Accessibility** (Dark-only; reduced-motion lives here) / **Input & devices** (wheel, Space, Pencil-finger) / Canvas / Simulation / About (determinism digest as quiet `✓ verified`). Project settings stay inline ("configure it never"). Local/per-device persistence.
- **Why? overlay:** scrim + leader line + placement order = **flip** (open away from a near panel) → **shift** (clamp inward) → **auto-pan** (≤300ms) → **dock** to safe-area edge. Safe area = canvas region only, 20px gutter — never clipped by a panel.

---

## 8. Editor shell layout

```
Header 52px:  [⌂ + breadcrumb + mode badge]   |   [transport, centered]   |   [health · Share]
Body:  Palette 212px (→48px rail →Focus Mode hidden)  |  Canvas full-bleed dot-grid  |  Right rail 288px
Right rail = Inspector (top, contextual) over Watches (bottom, persistent) — stacked, draggable divider, NOT tabs.
Both rails collapsible to zero.  Canvas is the product; chrome recedes.
```

**Motion summary (full spec is the deferred motion phase):** structural 200–350ms ease-out, interruptible (dive/surface = **zoom-through** = navigation; instance↔definition = **crossfade** = mode — distinct motions, distinct meaning); feedback ≤150ms; state ~110ms; chrome ≤350ms; trace-mode content replay exempt; reduced-motion → crossfades.

---

## 9. Approved open questions (carried forward)

| Item | Status |
|---|---|
| **Brand mark** | Placeholder 2×2 four-state glyph; needs its own exploration before load-bearing use. |
| **File extensions** | `.quadstate` (project) / `.qschip` (bundle) recommended — confirm. |
| **iPad transport placement** | Header-center on desktop; floating-bottom reserved for the adaptation pass. |
| **Net-label canvas density** | Default: named nets always; others on hover/selection — confirm. |
| **Splitter default mapping** | Per-bit vs high/low-nibble out of the box. |
| **Templates lineup/count** | Home rail (4) + empty-state (3) — content decision. |

---

## 10. Final vs provisional

**FINAL / locked**
- Signal state language + channel allocation (color + pattern/glow; **thickness = bus width**).
- Bus aggregate precedence (all-zero = blue confirmed; mixed = green no-halo).
- Core token palette; the three laws (reserved signal / indigo-only-focus / one system).
- 8-pt grid; elevation-not-borders; reserved-color discipline.

**PROVISIONALLY APPROVED** (refinable if testing surfaces issues)
- All screen layouts: Home, Editor shell, Create Chip, Hierarchy/Dive, Share, Settings, Command Palette.
- The interaction contract (provisionally accepted; gray-box prototype validated the core).
- Cursor-free-after-create; visible Undo/Dissolve; instance/definition via signals-on/off + bench + mode bar.

**DEFERRED / pending** (own phase or hardware)
- Motion spec phase (product doc §8).
- Brand mark; part-symbology illustration finish.
- iPad/touch/Pencil contract (provisional, pending hardware).
- Light theme (Dark-only v1).

---

*Use this as the reference for prototype implementation and the motion-design phase. When a value here conflicts with a source doc, this summary is canonical for tokens/specs; the source doc is canonical for rationale.*

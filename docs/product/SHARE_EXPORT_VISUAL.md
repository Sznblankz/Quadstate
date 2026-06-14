# QuadState — Share / Export Sheet Visual Design

**Phase:** Visual design — document 12
**Date:** 2026-06-13
**Status:** Draft for review · **refined 2026-06-13 (pass 1.1)** — default focus/primary = Project file (no row hard-filled); content hash demoted to details; Publish band hidden in v1. Provisionally approved.
**Fixed context (do not redesign):** VISUAL_EDITOR.md (tokens, indigo-for-focus, scrim), WIREFRAMES.md §8 (the share sheet structure), PRODUCT_DEFINITION.md §10.8 (beautiful exports) + §7 (pride beat, Recipient persona), the signal language + thumbnail treatment from VISUAL_HOME.md. **Engine:** `bundle.ts` (chip + transitive dep closure, hash-verified), cross-platform determinism, storage adapters (FS-Access / download / Tauri / Capacitor).
**Mandate:** design the full outbound experience, inheriting the established language. No new colors; signal colors appear only inside the image preview (a picture of the canvas); indigo only for focus; **no multi-step wizard** — a sheet of independent one-click exports.

**The feeling to land:** the pride beat. A Builder finishes something and sends it out — and what they send behaves *identically* everywhere (determinism), arrives *pre-instrumented* (watches travel), and *looks beautiful* (signal-state image export). For a portfolio product, **the share target is the demo** — this surface is marketing.

---

## 1. Design rationale

**One surface, structured by intent.** Three distinct outbound intents — *share the whole project*, *share a part*, *share a picture* — each its own row with its own one-click export. Not a format dropdown to decode; you pick by *what you want to do*, and the row handles the how. This is the Notion/Linear share-sheet sensibility: a calm panel of clear actions, never a settings dialog.

**Determinism is a quiet selling point, surfaced.** QuadState's hash-verified bundles + cross-platform determinism mean *what you share behaves identically everywhere*. That's quietly radical, and the Recipient persona benefits most — so the sheet shows a small **"verified identical"** mark with the content hash, building trust without shouting.

**The image export is strategic, so it's first-class.** A canvas rendered to crisp PNG/SVG *with the signal-state language intact* is the screenshot people post. The Image row gets a **live preview** so you see the picture before saving — the one place signal colors appear in this chrome, exactly as they do in Home thumbnails.

**Calm, dismissible, multi-shot.** It's an overlay sheet over a dimmed editor (a deliberate outbound action, not a mode you live in). It stays open across several exports in one visit, and Esc / click-away / × dismiss it. One accent: Export buttons are quiet at rest and light indigo on focus/hover — nothing competes until you're about to act.

---

## 2. Refined layout

A **centered overlay sheet** (~520px wide) over the editor dimmed by the standard scrim (`rgba(11,13,17,0.62)`), soft `--shadow-hover` elevation.

```
        ╭──────────────────────────────────────────────────╮
        │  Share  ·  8-bit ALU                          [×] │   header
        ├──────────────────────────────────────────────────┤
        │  ┌────────────────────────────────────────────┐  │
        │  │ ⧉  Project file                .quadstate  │  │   intent 1 (default focus)
        │  │    Everything: circuit, chips, watches, ink │  │
        │  │    ✓ verified identical             [Export]│  │   ← focused: indigo fill
        │  ├────────────────────────────────────────────┤  │
        │  │ ⤢  Chip bundle                    .qschip  │  │   intent 2
        │  │    [ FullAdder ▾ ]  + 2 dependencies        │  │
        │  │    ✓ verified identical          [ Export ]│  │   ← unfocused: outline
        │  ├────────────────────────────────────────────┤  │
        │  │ ⬚  Image                                    │  │   intent 3
        │  │    ┌──────────────┐  region (•)selection    │  │
        │  │    │  thumbnail   │  ( )view ( )all         │  │
        │  │    │  (signals on)│  format (•)PNG ( )SVG   │  │
        │  │    └──────────────┘  signals (•)as shown    │  │
        │  │                                  [ Export ] │  │
        │  └────────────────────────────────────────────┘  │
        ╰──────────────────────────────────────────────────╯
        (Publish to Community: reserved in IA/code, NOT rendered in v1)
```

- **Header:** `Share · <project name>` (the project context, so you know what you're sharing), `[×]` close.
- **Three intent rows** as cards inside the sheet, equal weight (you choose by need). Each: an icon, a title, a format chip, a one-line description, and its own `[Export]`.
- **Default primary = Project file (refined).** On open, focus lands on the **Project file** row, so *its* Export is the single indigo-filled (primary) button and the other two are quiet outlines — no row is hard-coded as special; the primary simply follows focus, and the default focus is the most common intent. Bundle is no longer visually elevated.
- **Publish to Community (refined): hidden in v1.** The slot stays reserved in the IA and code, but the band is **not rendered** in early builds (matching Home's Community tile, which is also slot-only). It appears only when the feature is real — no dimmed "coming soon" placeholder cluttering the calm.

---

## 3. The three export intents

### Project file — "share the whole project"
- Format chip `.quadstate`. Description: *"Everything: circuit, chips, watches, ink."* The honesty that **instrumentation travels** — a shared CPU arrives with the author's watches already pointing at the program counter — is the quiet hook (Recipient persona).
- The **verified-identical** mark + truncated content hash (`#8604af`, mono) sits inline, small.

### Chip bundle — "share a part"
- Format chip `.qschip`. A **chip picker** (`[ FullAdder ▾ ]`, the My Chips list) + a **dependency summary** (`+ 2 dependencies`) so you know exactly what's traveling (bundle = main + transitive closure, `bundle.ts`). Reached pre-selected from a chip's context menu / palette.
- Same verified-identical mark. Recipient imports → it lands in their palette, hash-deduped.

### Image — "share a picture"
- A **live thumbnail preview** of the export (updates with the options), with the **signal-state language intact** — the brand, in the artifact. Options:
  - **Region:** `selection · view · all` (defaults to selection when one exists, else view).
  - **Format:** `PNG · SVG`.
  - **Signals:** `as shown` (live state baked in) · `schematic only` (neutral, for clean diagrams).
- This is the portfolio-critical export; the preview is what makes it feel premium and removes guesswork.

---

## 4. Determinism — the "verified identical" treatment *(refined — less technical)*

- A small, quiet mark: a check glyph + **`verified identical`** (`--text-2`). Appears on the project-file and chip-bundle rows. **The content hash is no longer shown inline** — it's demoted to a **details affordance**: hovering the mark (or an `ⓘ`/"details" disclosure) reveals the tooltip *"Behaves bit-for-bit identically on every platform · #8604af"*, where the hash lives as a technical footnote, not front-of-house.
- Rationale: the *promise* ("verified identical") is the trust signal a human reads; the *hash* is proof for those who want it, not chrome. Keeping the phrase visible and the hash on-demand keeps the row calm and non-technical while preserving the guarantee.
- This is the visible face of the determinism guarantee that nothing else in the category offers — surfaced calmly so the Recipient trusts what they open.

---

## 5. Export resolution & states

- **`[Export]` resolves per platform** via the existing storage adapters: native save dialog (Tauri / FS-Access) or browser download (web fallback). The sheet doesn't expose plumbing; a `▾` on Export offers `Save as… / Download / Copy link` only where each applies.
- **At rest:** Export buttons are **quiet** (outline, `--text-1`); the **focused** row's Export fills indigo. On open, focus defaults to **Project file**, so exactly one primary (indigo) button shows and it's the most common intent — calm, with a clear default action, and no row hard-elevated.
- **Success:** a quiet inline confirmation replaces the button briefly — `✓ Saved · circuit.quadstate` (feedback motion, once) — then settles back. **The sheet stays open** (multi-shot: export a bundle *and* an image in one visit).
- **Cancel** at the OS dialog returns to the sheet silently — no error, no nag.

---

## 6. Component specifications

- **Sheet:** `--surface-1`, radius 16, `--shadow-hover`, ~520px wide, centered; scrim `rgba(11,13,17,0.62)` over the editor. Esc / click-away / `[×]` dismiss.
- **Intent row:** `--surface-1` card with a hairline divider between rows; 16–20px padding. Icon (24, `--text-2`), title (15/600), format chip (mono, `--surface-2`, radius 8, `--text-3`), description (13/450 `--text-2`).
- **Verified mark:** `✓` + `verified identical` (13/450 `--text-2`); the hash lives in a hover tooltip / `ⓘ` details only — not inline.
- **Export button:** radius 10, outline at rest (`--text-1`, hairline), **focused row = `--accent` fill, white text** (default focus = Project file); `▾` split where multiple destinations apply.
- **Chip picker:** a `--surface-2` dropdown (the My Chips list), radius 8; dependency count as `--text-3` beside it.
- **Image preview:** a 16:10 thumbnail, dot-grid ground, real schematic render with signals (or neutral if "schematic only"); 1px inset hairline — identical treatment to Home thumbnails.
- **Option controls:** quiet segmented radios (`--surface-2`, selected = `--text-1` + subtle indigo tick); never loud.
- **Publish to Community:** **not rendered in v1.** Reserved in the IA/code only; the sheet simply ends after the Image row. Appears when the feature ships.

---

## 7. Alternatives considered and rejected

1. **Format-first dropdown** ("Export as: ▾ .quadstate / .qschip / .png…"). *Rejected* — makes the user translate *intent* into *format*. Intent-first rows are clearer and match how people actually think ("send the whole thing" vs "send this part").
2. **Full-screen export workspace.** *Rejected* — a heavyweight surface for a quick action; contradicts canvas-first and the "no wizard" mandate. A centered sheet is the right weight.
3. **Right-edge slide-in sheet.** *Considered* (keeps canvas visible). *Rejected* in favor of centered + image-preview — the preview answers "what will the picture look like?" better than peeking at the canvas, and centered reads as the deliberate pride beat.
4. **Auto-export on click (no options).** *Rejected for Image* — region/format/signals genuinely change the artifact; a preview + three quiet toggles is worth it. Project/bundle stay one-click (no options needed).
5. **Loud "Verified ✓" banner.** *Rejected* — determinism is a quiet trust signal, not a marketing badge; a small inline mark respects the calm.
6. **Account/login for sharing.** *Rejected* — portfolio positioning, local-first; v1 sharing is files and bundles. Publish-to-Community is the reserved slot, not a v1 gate.

---

## 8. Open questions & recommendations

| # | Question | Recommendation |
|---|---|---|
| 1 | **File extensions** (product doc §11.4) | `.quadstate` (project), `.qschip` (bundle) — clear, ownable, readable. Image = standard `.png`/`.svg`. Confirm. |
| 2 | **Image preview thumbnail** before save | Yes — it's the portfolio differentiator and removes guesswork; small render cost. |
| 3 | **"Copy link"** in Export `▾` | Reserve the affordance; inert until the lightweight hosted-link option exists (community-adjacent). |
| 4 | **Default image region** when a selection exists | Selection (most likely intent); fall back to view. |
| 5 | **Project row toggles** ("include watches/ink") | Keep the simpler promise: *everything travels.* No toggles in v1. |
| 6 | Should bundle export show the **dependency list** (not just count)? | Count by default; expand-on-click to list deps (parity with import). |

## 9. Extension audit

- **New colors:** none. Signal colors appear only inside the image preview (a picture of the canvas).
- **Indigo:** Export focus/hover, control selection ticks — focus only.
- **Reuses:** the scrim (from Why?), Home's thumbnail treatment, the divable-chip `⤢`, tokens, soft elevation, the reserved-slot pattern (Home's Community).
- **No wizard, no modal stepper** — independent one-click exports on one calm sheet.

## 10. Next steps

1. Review; confirm §8.1 (extensions) and that the centered-sheet + image-preview direction is right.
2. Then **Settings** — the last core surface, almost entirely inherited — completes the visual phase, after which the system spans Home → Editor → Create Chip → Hierarchy → Bus → Share → Settings.

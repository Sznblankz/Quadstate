# QuadState — Product Definition & UX Direction

**Phase:** Product Design & UX Planning (Phase 1 of design — no screens, no mockups, no implementation)
**Date:** 2026-06-12
**Status:** Amended 2026-06-12 after the four-document system review — motion rule scoped to chrome (§8), bus UX elevated in the roadmap (§11.3)
**Engineering baseline:** All architecture milestones M1–M6 complete (see `.claude/plans/foamy-mixing-whale.md`). The engine, document model, canvas, hierarchy, file format, and bundle/registry contract exist. This document designs the *product* on top of them.

---

## 0. Decisions log

Settled in this session — every section below assumes these:

| Decision | Choice |
|---|---|
| Lead platform | **Desktop/web-first.** iPad + Pencil is a first-class adaptation, not the design origin. |
| Primary persona | **Hobbyist builders.** When beginner needs and power needs conflict, power wins; beginners are served by progressive disclosure, not simplification. |
| Community scope | **Reserve, don't design.** The IA leaves a clean slot for a Community Library so it can be added without restructuring. v1 sharing = files and part bundles. |
| Positioning | **Portfolio/passion project.** Premium feel is the goal in itself; no monetization constraints, no upsell surfaces. |

---

## 1. Target users

### Primary: The Builder
A developer, engineering student, or technically curious person who *already understands* what a gate does and wants to build something ambitious — an adder, an ALU, eventually a CPU. The nand2tetris reader. The person with a half-finished Minecraft redstone computer.

- **Motivation:** the joy of constructing a working machine from first principles; understanding by building.
- **Sessions:** long (1–3 hours), returning to one large project over weeks.
- **Pain with existing tools:** Logisim-class software feels like punishment — dated visuals, clunky hierarchy management, mystery simulation states, no sense of craft. They tolerate it; they don't love it.
- **What winning looks like:** "I built a CPU and the *tool itself* was part of the pleasure."

### Secondary: The Learner
Someone discovering digital logic for the first time (a CS course, a YouTube rabbit hole). Served through onboarding, templates, and an interface that never requires expertise to *read* — but never at the cost of the Builder's depth or speed.

### Tertiary: The Recipient
Someone who receives a QuadState project or chip bundle — a friend, classmate, or future employer viewing the portfolio. They may never build anything. Their experience: open → it works → it's beautiful → poke around safely. Determinism guarantees what they open behaves identically to what was sent. This persona matters disproportionately for a portfolio project: *the share target is the demo.*

### Anti-persona (explicit non-goal)
The professional FPGA/HDL engineer. QuadState will not chase Verilog export, timing closure, or synthesis. Chasing professional EDA features is how tools end up looking like the incumbents we're rejecting.

---

## 2. Product identity

### The name
QuadState refers to the engine's 4-value logic — 0, 1, X (unknown), Z (high-impedance). This is a gift: the name *is* the differentiator. Most hobby simulators are binary and lie to you about floating or contested wires; QuadState tells the truth. The identity should lean into this: **the simulator that shows you what's really happening.**

### Positioning statement
> For people who want to build computers from gates, QuadState is a canvas-first logic simulator that feels like a modern creative tool — fast, truthful, and beautiful — unlike the dated engineering software that has owned this space for twenty years.

### Personality
- **Craftsmanlike, not corporate.** Procreate's warmth, not Vivado's bureaucracy.
- **Calm, not flashy.** The circuit is the show; the chrome recedes.
- **Honest, not magical.** X and Z states, propagation, determinism — the tool reveals mechanism rather than hiding it. This *is* the educational value, delivered as a side effect of truthfulness.
- **Fast as an identity trait.** Linear's lesson: speed is not a feature, it's the personality. A 3–6M events/sec engine deserves an interface that never makes the user wait for it.

### What QuadState is not
Not an EDA tool. Not a classroom administration product. Not a game (no points, no levels). Not a node-graph programming environment.

---

## 3. Core design principles

Seven principles, each with a commitment. These are the tiebreakers for every future design argument.

1. **The canvas is the product.**
   Everything else — palettes, inspectors, toolbars — is furniture that exists to serve the canvas and should be dismissible, collapsible, or translucent. We will measure chrome by how little of it the Builder sees during a flow-state hour. *We will not* add a panel when an on-canvas affordance can do the job.

2. **Truth at a glance, even paused.**
   Every wire's state (0/1/X/Z) must be readable from a static screenshot — no motion required, no hover required, no colorblind exclusion (state encodes in color *and* line treatment, never color alone). *We will not* use ambient animation (pulses, marching ants, flows) to convey steady state.

3. **Motion explains; it never decorates.**
   Animation exists to preserve context (where did that chip go?), confirm causality (my click did this), and smooth state changes. If an animation doesn't answer "what just happened?", it's cut. *We will not* ship any animation that delays input readiness.

4. **Depth without drowning.**
   Hierarchy is QuadState's power feature — chips inside chips inside chips. The user must always know *where they are* in the hierarchy, *how they got there*, and *how to get out*, at any depth. *We will not* open new windows/tabs for chip interiors; depth is navigated, not multiplied.

5. **The fast path is the default path.**
   Every frequent action (place, wire, duplicate, create chip, probe) gets a no-menu route: keyboard, gesture, or single direct manipulation. Menus and palettes are discovery mechanisms; experts should outgrow them. *We will not* require a dialog for anything done more than once a minute.

6. **Beginner-friendly means learnable, not limited.**
   One interface. Beginners and experts see the same canvas; beginners are supported by progressive disclosure, forgiving defaults, undo-everything, and explanations available on demand — never by a "simple mode." *We will not* fork the UI by skill level.

7. **Every input device is deliberate.**
   Mouse+keyboard is the lead instrument; touch and Pencil are not emulated mice. Each gets an explicit interaction contract (the gesture-arbitration layer already exists in `packages/canvas`). Pencil earns "excellent" through precision wiring, pressure-aware ink annotation, and palm rejection — not through parity checklists. *We will not* ship a touch interaction that is merely a worse mouse interaction.

---

## 4. User journey — launch to sharing

Mapped for the primary persona, with the emotional beat each stage must hit.

### Stage 0 — Launch *(beat: "this respects my time")*
Cold launch shows a brand moment **only while the app genuinely needs the time** (see §8 challenge on the startup animation). Warm launch goes straight to where the user was. Target: interactive home in under ~1.5s web, near-instant on Tauri.

### Stage 1 — Home *(beat: "my work is right here")*
The hero is **Continue** — the last project, large, with a live-rendered thumbnail of its canvas, one click from resuming. New Project, Recents, Templates, and (reserved) Community are secondary. The Builder visits home for two seconds; the Learner lingers on Templates. Both are served by the same screen with different gravity.

### Stage 2 — First canvas *(beat: "I know what to do")*
New project lands on an empty canvas with the part palette open and nothing else. No setup wizard, no project-settings dialog — name it later, configure it never. A first-run-only ghost hint ("drag a gate from the palette") that disappears forever after first placement.

### Stage 3 — Building *(beat: flow)*
Place → wire → poke inputs → watch truth propagate. The loop must be uninterruptible: simulation always-on by default (the engine is fast enough), wiring tolerant of imprecision (snap, auto-junction), every action undoable. Errors (contested nets, floating inputs) surface as *canvas annotations* (an X-state wire looks wrong) rather than modal alerts.

### Stage 4 — Abstraction *(beat: the magic trick)*
Select a working cluster → **Create Chip** → the gates collapse into a single named part with auto-derived pins; the new chip appears in My Chips, placeable immediately. This already works in the document layer (`createChipFromSelection`); the design job is making it feel like *the* signature moment — this is QuadState's equivalent of Figma's component creation. Double-click (or breadcrumb) dives inside; live signals remain probe-able at depth (the bridge probing already supports this).

### Stage 5 — Scale *(beat: "it can keep up")*
Hundreds of chips, deep nesting, big buses. Needs: hierarchy breadcrumb, search/jump-to-part (command palette), minimap or zoom-to-fit, multi-select power editing. The lazy resolver and spatial grid already exist; the UX must expose that headroom rather than hide it.

### Stage 6 — Save & return *(beat: trust)*
Local-first, explicit save plus quiet autosave-to-draft. Reopening restores exactly — viewport, selection, sim state (DFF carry-over already verified). Never a "recovering document…" anxiety moment.

### Stage 7 — Share *(beat: pride)*
Two distinct share intents, two flows:
- **Share a part** — export a chip bundle (`.qsb`?) with its dependency closure (built: `bundle.ts`). Recipient imports; it lands in their palette, hash-verified.
- **Share the work** — export the project file, or a rendered artifact (PNG/SVG of the canvas) for posting. For a portfolio product, the *image export* is strategically important and currently unplanned — flagged in §10.

Future: Stage 7 grows a "Publish to Community" branch in the same share surface — the reserved slot.

---

## 5. Information architecture

### Object model (user-facing nouns)
```
Project                     ← the file; one canvas + its chip library
 ├─ Canvas (the document)   ← top-level circuit; the thing you see
 ├─ Chips (My Chips)        ← user-created parts, project-scoped
 └─ Project metadata        ← name, thumbnail, modified date

Parts (placeable things) — one taxonomy, four sources:
 ├─ Built-in                ← gates, IO, DFF… (engine primitives)
 ├─ My Chips                ← created in this project
 ├─ Imported                ← from bundles (hash-verified, deduped)
 └─ [Community]             ← reserved slot; same shape as Imported
```

Key IA decision: **chips are project-scoped, with bundles as the export unit.** No global cross-project library in v1 — it duplicates what bundles do and creates sync questions. If a global "My Library" is ever wanted, it slots in as a fifth part source without restructuring. The Community Library, when it arrives, is *just another part source plus a browse surface* — that's the whole reservation.

### Surface hierarchy
```
App
├─ Home (shell)
│  ├─ Continue / Recents
│  ├─ New (blank, from template)
│  ├─ Templates
│  ├─ [Community Library]        ← reserved tile/section, hidden until real
│  └─ Settings (overlay, not a peer destination — see §6 challenge)
└─ Editor (one project)
   ├─ Canvas + hierarchy breadcrumb (primary)
   ├─ Parts palette (left, collapsible)
   ├─ Inspector / Probe (right, contextual, collapsible)
   ├─ Sim controls (compact, persistent)
   ├─ Command palette (⌘K overlay)
   └─ Share/Export (sheet)
```

### Settings split
- **App settings** (theme, input preferences, canvas defaults) → overlay from Home *and* from Editor, same surface.
- **Project settings** → almost nothing belongs here by design (principle 5: configure it never). Rename and thumbnail live inline, not in a settings page.

---

## 6. Navigation structure

**Two-shell model:** Home ⇄ Editor. One project open at a time per window/tab (the browser or OS provides multi-project multitasking; we don't rebuild tabs inside the app — Arc's lesson is to *use* the browser's nature, not fight it).

**Within the editor, navigation = depth.** The single most important navigational element in the app is the **hierarchy breadcrumb**: `Canvas ▸ ALU ▸ Adder4 ▸ FullAdder`. Always visible while diving, click any ancestor to surface, with a canvas zoom transition that makes containment *felt* (§8). Escape backs out one level.

**Command palette (⌘K) as the universal escape hatch** — Linear's pattern, adopted wholesale: place a part by name, jump to a chip, toggle a panel, run an export, open settings. This is how the design honors "fast workflows" and "powerful" without growing toolbar acreage. It's also the beginner's discovery tool: every command is searchable in plain words.

**Challenged assumption — your home screen list.** You proposed New Project / Open / Recents / Community / Templates / Settings as the home screen contents. Two pushbacks:
1. **The hero should be Continue, not New.** Builders create a project occasionally and *return* to one constantly. A launcher that treats every visit like a first visit (six equal tiles) optimizes for the rarest case. Recents-with-a-dominant-last-project should carry the layout.
2. **Settings is not a destination.** It's a utility overlay reachable from anywhere. Giving it a home tile spends prime real estate on the least canvas-first thing in the app.

---

## 7. Major application screens

The complete v1 surface inventory — eight surfaces, no more. (Detailed screen design is the next phase; this defines *what exists and why*.)

1. **Home** — resume work, start work, find work. Dominant Continue card with a canvas thumbnail (a static capture at save time is sufficient; live rendering is back-of-queue polish); recents grid; New/Templates; reserved Community slot; settings gear.
2. **Editor** — where 95% of all user time goes. Canvas full-bleed; palette left; inspector right; breadcrumb top; sim controls compact and persistent. Both side panels collapsible to zero (principle 1).
3. **Chip interior (edit-in-place)** — not a separate screen: the same editor, navigated one level down, with breadcrumb context and a subtle "inside a chip" canvas treatment (e.g., the chip's boundary/pins rendered at the edges). Editing a chip's definition vs. *viewing an instance with live signals* are two modes of this surface and must be visually unambiguous.
4. **Inspector / Probe panel** — contextual right panel: selected part's properties; live net probing (exists via `bridge.probe`); chip pin definitions. Empty selection = panel collapses or shows project overview, never a blank pane.
5. **Share/Export sheet** — one surface for all outbound: project file, chip bundle, canvas image. Grows the Publish option later.
6. **Library manager** — within-editor surface (palette's expanded mode, not a separate app section) for My Chips + Imported: rename, delete, export, inspect dependencies. Deliberately modest in v1.
7. **Settings overlay** — appearance, input/device, canvas behavior, about. One overlay, both shells.
8. **First-run onboarding** — not a screen: a 60-second guided moment *on the real canvas* of a starter project (place, wire, poke, create chip). Procreate's model — you learn in the document, not in a slideshow. Skippable, never repeats, re-invokable from settings.

---

## 8. Motion & animation philosophy

### Taxonomy — every animation belongs to exactly one class
| Class | Job | Budget |
|---|---|---|
| **Structural** | Preserve context across navigation (dive into chip = zoom *through* it; home→editor = canvas expands from thumbnail) | 200–350ms, ease-out, interruptible |
| **Feedback** | Confirm direct manipulation (part settles on snap, wire completes, selection acquires) | ≤150ms, near-instant |
| **State** | Signal value changes on wires/pins | See below |
| **Brand** | Launch moment only | Once, cold launch only |

### Signal state changes — your "no pulsing" call, extended
Agreed, and made into doctrine via principle 2: **steady state is static.** A wire at 1 simply *is* the 1 treatment. The motion budget is spent only at the *moment of transition* — a fast (~100–120ms) crossfade of the wire's treatment, perceptible as "it changed" without ever becoming ambient noise. At high simulation speeds, transitions faster than perception simply render the new state (no animation queueing, no slow-motion lies — honesty over theater). A separate, *opt-in* "trace mode" could slow simulation deliberately for teaching/debugging — motion as a tool the user reaches for, not a default they endure.

### Challenged assumption — the startup animation
A logo animation *into a loading screen* institutionalizes waiting in an app whose identity is speed (§2). Linear, Arc, and Figma do not run startup theater; they open. Counter-proposal that keeps the brand moment you want:
- The logo animation plays **only during real load time** on cold launch, capped (~800ms), and resolves *into the home screen layout* — the mark morphs into its resting place in the UI rather than cutting from a splash to a different world.
- Warm launches and "reopen last project" skip it entirely.
- It never blocks input: if the app is ready, the user can click through it.
This way the animation is a craftsmanship signature, not a toll booth.

### Hard rules
- 60fps on canvas is non-negotiable; any chrome animation that costs canvas frames is cut.
- No *chrome* animation runs longer than 350ms, ever. (Deliberate content replay — trace mode — is a tool the user invoked, not chrome, and is exempt.)
- `prefers-reduced-motion` collapses structural animations to crossfades and disables the brand moment.

---

## 9. Visual design philosophy

Direction only — the actual design language (tokens, type, exact palette) is a later phase.

- **The canvas recedes; signals speak.** A calm, low-contrast canvas ground (likely dark-first — builders' tool, long sessions, and signal colors bloom on dark) with chrome in quiet neutrals. The most saturated pixels on screen should always be *signal state*.
- **The 4-state visual language is the brand system.** One reserved, untouchable encoding: e.g., 0 = dim/quiet, 1 = the accent at full strength, X = a warning treatment that looks *wrong* (it is), Z = hollow/dashed (absence of drive). Each state pairs color with a line treatment for colorblind safety. No other UI element may borrow these colors. This single decision does more branding than any logo.
- **Custom part symbology.** Distinctive gate symbol art (already on the backlog) drawn as one family — consistent stroke weight, corner language, pin geometry — legible at far zoom, beautiful at close zoom. ANSI/IEC-inspired but ours; this is where "premium vs. Logisim" is most visible per pixel.
- **Depth through elevation, not borders.** Panels float over the canvas with soft shadow and blur (Arc's translucency sensibility), reinforcing that the canvas is the world and panels are instruments held above it.
- **Typography:** one excellent sans for UI, one monospace for values/buses/pin names. Numbers are content in this app — tabular figures everywhere data lives.
- **Ink is a citizen.** Pencil pressure ink (already working) gets a deliberate visual identity — annotation as a sanctioned, beautiful layer, not a debug leftover. No other simulator has this.

---

## 10. Differentiators

Ranked by strategic weight:

1. **Four-state truth, visibly.** Floating and contested wires are real and *look* real. Competitors either don't model X/Z or render it as an afterthought error color. For QuadState it's the name on the door.
2. **Chip creation as the signature gesture.** Select → Create Chip → instant abstraction with live signals preserved through the hierarchy. Make this moment as iconic as Figma's "create component."
3. **It feels like a creative tool.** The entire §8/§9 program — calm canvas, honest motion, custom symbology, premium polish. Against this category's incumbents, *feel* alone is a moat.
4. **Speed as honesty.** Always-on simulation, instant elaboration on edits, no "run" button anxiety. The engine headroom (millions of events/sec) becomes a UX promise: you never wait for truth.
5. **Deterministic sharing.** Hash-verified bundles + cross-platform determinism = what you share behaves *identically* everywhere. Quietly radical; surface it in the share UX ("verified identical").
6. **Pencil ink annotation.** Sketch timing diagrams, circle a bug, leave a note to your future self — on the circuit. A Procreate sensibility no engineering tool has.
7. **⌘K everything.** Linear-grade command palette in a category that still uses menu bars from 2003.
8. **Beautiful exports.** *(New scope, recommended.)* Canvas → crisp SVG/PNG with the signal-state language intact. For a portfolio-positioned product, the screenshots users post *are* the marketing. Currently unplanned in engineering; small lift, outsized return.

---

## 11. Open questions for the next session

1. **Simulation control surface** — always-on sim is the proposal; what does the user-facing time model look like (pause, step, tick rate, future waveform/trace view)? This is the largest unexplored UX area and probably the next planning document.
2. **Wire routing personality** — orthogonal auto-routing vs. free-angle vs. hybrid? Deeply affects canvas feel; also interacts with the multi-segment-wire backlog item.
3. **Buses in the UX** — the engine caps at 64-bit buses; how do bundling/splitting/labeling feel on canvas? **Elevated by the 2026-06-12 system review: first post-prototype planning topic.** A CPU is buses all the way down — this is the thinnest design in the system relative to the Builder's biggest scaling need, and it must be planned before any wireframe that touches the inspector or palette.
4. **Naming** — file extensions (`.quadstate`? `.qs` collides with surnames of nobody), bundle extension, "chip" vs. "part" vocabulary lock.
5. **Template content strategy** — which 5–8 starter projects/templates ship? (Half-adder, 7-segment, SR latch, …) Doubles as the onboarding curriculum.
6. **Editor presence on iPad** — which desktop affordances translate to gestures vs. get a toolbar slot; needs its own adaptation pass once desktop IA is frozen.

## 12. Suggested next steps (in order)

1. Review/contest this document; lock principles and IA.
2. Plan the **simulation time model UX** (open question 1) — it shapes the editor's persistent chrome.
3. Define the **interaction model** for the editor: full input map (mouse/keyboard/touch/Pencil contracts) per tool.
4. Then — and only then — low-fi wireframes: Home, Editor, Create Chip flow, Share sheet.

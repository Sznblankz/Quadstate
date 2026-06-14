# QuadState — Simulation & Debugging UX Philosophy

**Phase:** Product Design & UX Planning — document 2 of the design phase
**Date:** 2026-06-12
**Status:** Amended 2026-06-12 after the four-document system review — "Why?" scoped honestly for v1 (§4.2), construction-time health dampening added (§4.3), §8 decision points ratified
**Depends on:** `PRODUCT_DEFINITION.md` (principles, personas, motion/visual philosophy). This document answers its open question §11.1 and defines the simulation/debugging mental model *before* any editor layout work.
**Engineering grounding:** deterministic delta-cycle discrete-event engine (integer ticks, `(time, delta, seq)`-ordered events, trace-hash-verified determinism), 3–6M events/sec in a Web Worker, union-find net resolution, hierarchy probing via `bridge.probe`/`resolveNet`, DFF state carry-over through structural edits, stable entity IDs. Every UX idea below is checked against what this engine makes cheap or expensive.

---

## 1. Debugging philosophy — five principles

These extend the seven product principles; they are the tiebreakers for everything in this document.

1. **The circuit is always alive.**
   There is no Run button, no compile step, no "simulation mode." A QuadState circuit is a powered breadboard: it has state the moment it exists, and editing it is editing a live machine. Pausing is something *you* do to *time*, not something the tool does to your circuit. (The engine already supports this stance: re-elaboration on edit with DFF carry-over means edits don't reset the world.)

2. **The canvas is the debugger.**
   Debugging happens where the circuit is — on wires, pins, and chips — not in a console, log, or separate "debug perspective." Panels hold *details*; the canvas holds *truth*. No error list that points at the canvas; the canvas itself wears its errors.

3. **Every strange state answers "why?" in one click.**
   A red wire that won't explain itself is a frustration generator. QuadState's contract: any X, Z, or contention can be interrogated, and the answer is causal ("this is X *because* these two outputs disagree, *here*"), spatial (the cause is highlighted on canvas), and plain-language. Diagnosis over symptoms, always.

4. **Inspection is free.**
   Probing never affects the simulation (no observer effect — better than a real scope), never requires setup, never commits you to anything. There is a smooth gradient from a zero-cost glance to a persistent watch, and you can step off the gradient at any point.

5. **Time is honest.**
   Time is integer ticks and clock cycles — the engine's real currency — never fake milliseconds. Propagation visualizations show the *actual* event order from the discrete-event queue, never a decorative animation pretending to be physics. When simulation outruns perception, the UI shows settled truth rather than theatrical slow-motion. (This is principle 2 of the product doc — "truth at a glance" — applied to the time dimension.)

---

## 2. The simulation time model

### 2.1 Mental model: a transport, not a debugger

The user-facing model is a **media-transport metaphor applied to circuit time**: Live ▸ Paused ▸ Step — familiar from every creative tool, mapped onto an honest tick clock. Combinational logic always *appears* instant (it settles within a tick at any speed). The transport governs **clocks** — the only parts that make time observable.

| Transport state | Meaning | Entry |
|---|---|---|
| **Live** *(default)* | Clocks tick at the chosen rate; the circuit runs. New projects start Live. | Spacebar / transport control |
| **Paused** | Time frozen; every signal holds and is inspectable at leisure. Editing while paused is normal and safe. | Spacebar |
| **Step** | Advance time deliberately, one unit per action, then hold. | Step controls / keys (while paused) |

### 2.2 Step granularity — two tiers, progressively disclosed

- **Step one clock cycle** — the default and the 95% case; what a Builder means by "step." One press = one full cycle: clocks fire, everything settles, time holds.
- **Step one delta (micro-step)** — advance the event queue one delta-cycle within a tick, exposing propagation order inside a single moment. This is the tool for race conditions and feedback loops — something Logisim-class tools cannot do honestly because they don't have a real event queue. Hidden behind progressive disclosure (modifier key / command palette); beginners never see it, experts live in it.

### 2.3 Tick rate

One **speed control** on the transport, log-scaled, from ~1 Hz (teaching speed — watch a counter count) through kHz (responsive interactive speed) to **Max** (uncapped; engine free-runs at millions of events/sec — for "let the CPU compute"). The control sets *clock rate*, and the UI displays honest units (Hz of the base clock), not a percentage slider. At Max, per-wire change animation is automatically suppressed (states snap — principle 5); displays like 7-segments and probes update on a render cadence.

### 2.4 Trace mode (slow motion, done honestly)

An **opt-in** propagation visualization, not a default behavior — this is the resolution of the product doc's "no pulsing wires" doctrine with the genuine need to *see* causality:

- Entering trace mode pauses the clock and replays the most recent step **event by event** in the engine's true `(time, delta, seq)` order — each wire transition rendered as it actually occurred, at human speed, with the currently-propagating edge emphasized.
- It's a *tool the user reaches for* (debugging a specific moment), never ambient. Exit returns to honest static rendering.
- Because it replays the real queue, it doubles as the deepest teaching instrument in the app: propagation delay, glitch hazards, and settle order become *visible mechanism*, not animation guesswork.

### 2.5 History, waveforms, and the determinism dividend — tiered

The engine's determinism and ordered event stream make signal history nearly free to capture and *perfectly* reproducible. Tier the ambition:

- **Tier 1 (v1): watch history.** Every watched signal records a rolling window of its value changes (event-sourced ring buffer). Surfaced as **mini-traces** — sparkline-style strips beside each watch showing the last N cycles. This answers "what just happened?" without any new surface.
- **Tier 2: waveform view.** A proper multi-signal timing view (the classic waveform panel, done with QuadState's visual language — X/Z rendered first-class, not as afterthought hatching). A reserved surface, exactly like the Community Library: the IA and the history data model accommodate it from day one; the screen is designed later.
- **Tier 3 (north star): time scrubbing.** Determinism + command log means any past moment can be *recomputed exactly*. Pause, drag back forty cycles, watch the failure again, micro-step through it. No Logisim-class tool can offer this; almost no tool at any price does. Flagged as the flagship long-term differentiator — the design decision *now* is only that the transport's visual design must leave room for a scrub affordance.

### 2.6 Reset semantics

"The circuit is always alive" needs one escape hatch: **Reset** returns all stateful parts (DFFs, registers) to power-on state — which honestly means **X** until initialized (see §4.4). Distinct from pause, deliberately less convenient (it's destructive to state), always undoable as a time event. No "reset on edit" — edits preserve state (already engineered).

---

## 3. Probing — the inspection gradient

A single smooth gradient of commitment. Each level is one gesture more than the last; nothing requires setup.

| Level | Gesture (desktop lead) | What you get | Persistence |
|---|---|---|---|
| **Glance** | Hover any wire/pin | Transient value readout near the cursor | None — gone on move |
| **Probe** | Click with probe behavior (or modifier-click in any tool) | A small on-canvas readout pinned to that net; inspector focuses it | Until dismissed; survives panning |
| **Watch** | Promote a probe (one click) | Entry in the watch list with name, value, **mini-trace history**; optional on-canvas flag | Saved in the project file; survives re-elaboration and structural edits (stable IDs make this cheap) |

Touch/Pencil adaptation: glance = touch-and-hold; the Pencil's precision makes probe-tapping dense pin clusters *better* than a fingertip — a place where Pencil earns its "excellent" rating.

### 3.1 Buses

- Default display **hex**, toggleable per-watch to binary / decimal / signed (remembered per watch). Monospace, tabular figures — values are content.
- **Four-state honesty in numerals:** a hex digit whose nibble contains any X renders as `X`; any Z (with no X) as `Z`. The full per-bit strip is one expansion away — a 64-bit watch expands to a bit-strip where the single X in bit 37 is visually findable (the strip uses the same 4-state visual language as wires).
- Bus *wires* on canvas show aggregate state: clean (all driven), or carrying-X / carrying-Z treatments that say "look inside me."

### 3.2 Watches as infrastructure

The watch list is more than a value table — it's the debugging session's memory and a navigation device (§5.3): each watch is a named bookmark to a location at any hierarchy depth. Watches saved with the project mean a Builder's debugging context survives between sessions, and a *shared* project arrives with its instrumentation intact — the Recipient persona opens a CPU project and the author's watches are already pointing at the program counter and the bus.

---

## 4. Making X and Z understandable — the provenance system

This is the heart of the document. Four-state honesty only becomes a UX advantage if every strange state is *explainable*. The design commitment:

### 4.1 Vocabulary first

Fixed plain-language glosses, used verbatim everywhere (tooltips, inspector, explanations) so they become learned vocabulary:

- **X — "unknown."** *The circuit can't decide what this is.* Causes: conflicting drivers, uninitialized memory, or unknowns feeding logic.
- **Z — "disconnected."** *Nothing is driving this wire right now.* Not an error by itself — it's how shared buses rest.
- **Contention** — *two or more outputs are fighting over this wire.* Always a bug; resolves to X.
- **Floating input** — *this input is connected to nothing (or only to Z), so it reads as unknown.*

Never a bare letter in a tooltip. `X` is the notation; "unknown" is the word; the one-line *why* is always adjacent.

### 4.2 "Why?" — one-click causal diagnosis

Any probed X or Z offers a single affordance: **Why?** The answer is rendered, not written:

- The **causal path upstream is highlighted on canvas** — from the probed wire back to the *origin* of the unknown-ness, dimming everything else.
- The origin gets a plain-language verdict at its location: *"X originates here: two outputs drive this net with different values"* (both drivers highlighted), or *"this DFF is uninitialized — it has never been reset,"* or *"this AND input is floating, so its output is unknown."*
- Across hierarchy, the path pierces chips (§5.1): the highlight runs *through* a chip with an indication that the trail continues inside, and following it dives with context preserved.

Feasibility note: X-origins are identifiable from net/driver analysis (contention, floating, uninitialized state) and upstream traversal of the netlist — the flattened global netlist plus hierarchy map makes the traversal straightforward; this needs a provenance query API on the engine/document side (§7), not engine redesign.

**v1 scope — spatial provenance, honestly** *(added by the system review)*: current-state traversal answers *where* an unknown comes from, fully, for combinational paths. Across a clock edge it necessarily stops: if a register *captured* an X forty cycles ago, v1 can identify the register but not the history that poisoned it — that requires the Tier 3 time machine (§2.5). The v1 verdict says so plainly: *"this register captured an unknown value at an earlier clock edge — its history isn't recorded (yet)"* — an honest boundary instead of a silent one. Sequential-depth provenance is recorded as the first concrete payoff time scrubbing will unlock, and the Why? surface is designed so the deeper answer extends it rather than replacing it.

### 4.3 Circuit health — passive lint, never a nag

A quiet, always-current **health indicator** in the editor chrome (count + severity tint, nothing more) aggregating: contentions (error), floating inputs feeding logic (warning), unconnected chip pins (info). Interacting with it cycles the canvas camera through the findings in place — *no modal list, no panel of doom*. Zero findings = the indicator is nearly invisible. A circuit with issues still runs (honesty over gatekeeping); health is information, not a gate.

**Construction dampening** *(added by the system review)*: during active building, everything legitimately floats — undampened lint would nag through 100% of normal work, violating this section's own promise. Rule: findings attached to nets touched within the last ~10 seconds (or part of an in-progress gesture) are suppressed, and the indicator never escalates visually while edits are in flight. Full strictness applies once the canvas has been quiet for a few seconds, whenever paused, and always on demand — clicking the indicator shows everything, dampened or not. The window length is a tuning item, not a principle.

### 4.4 Teach by encounter

The first time a user *causes* each phenomenon — first contention, first floating input, first uninitialized X at power-on — a one-time, dismiss-forever explainer appears at the site (the product doc's first-run-hint pattern): two sentences and a "show me" that runs the Why? highlight. Encounter-triggered teaching reaches Learners exactly when the concept is concrete, costs Builders one dismissal ever, and replaces any tutorial about 4-state logic.

### 4.5 Emotional reframe — the design's actual job

Logisim-class tools make error states feel like *the tool failing you* (mystery colors, no explanation, "oscillation detected" dialogs). QuadState's stance: **X and Z are the simulator handing you debugging information that binary simulators throw away.** An X isn't the sim breaking — it's automatic taint analysis pointing at your bug; follow it upstream and the bug is at the end. Z isn't an error — it's what makes real tri-state buses buildable at all (and bus-based CPU architecture *teachable*). Every surface in this section exists to make that reframe land: states are honest, explained, and actionable — therefore not frustrating. *This is how the name QuadState becomes a felt advantage rather than an engine trivia fact.*

---

## 5. Debugging across hierarchy

### 5.1 Signals pierce chips

Tracing never dead-ends at a chip boundary. Following a net (or a Why? path) to a chip pin offers **continue inside** — diving via the same zoom-through transition as normal navigation, but *carrying the trace*: the followed net stays highlighted, the breadcrumb gains a "tracing" state, and escape backs out with the trail intact. The flattened netlist means the engine already sees through hierarchy; the UX must too.

### 5.2 Instance vs definition — the live/edit distinction

Debugging happens on **instances** (this ALU, with its live state); editing happens on **definitions** (the ALU, affecting all instances). The two modes of the chip-interior surface (product doc §7.3) get their sharpest test here:

- **Diving from the canvas during simulation = instance view**: live signals, probe-able, *not* directly editable — the surface reads as "powered."
- **Editing the definition** is an explicit step from instance view ("Edit ALU — affects 3 instances"), visually unmistakable (the live-signal layer drops away; the surface reads as "on the bench").
- This distinction is also the honest answer to "why does this chip show different values each place I look?" — instances have independent state; the UX never blurs them.

### 5.3 X-ray peek — seeing without going

For shallow questions ("is the carry chain inside this adder working?"), full dives are too heavy. **Peek**: a hold/hover-with-modifier on a chip renders its interior live signals *in place* — translucent, non-interactive, gone on release. One level deep only (peeking a peek = dive instead). This is a premium signature moment — live circuitry glowing inside a chip under your cursor — and it's cheap: the renderer has the interior geometry and the engine has the values.

### 5.4 Navigating large projects while debugging

- **Watches as anchors** (§3.2): click a watch → camera flies to its net, diving hierarchy as needed. A Builder's watch list *is* their map of the CPU's vital signs.
- **Command palette**: jump to any part/chip/net by name at any depth ("pc", "alu.carry") — the ⌘K surface from the product doc, extended with net search.
- **Health findings** (§4.3) navigate the same way: each finding is a fly-to target.
- Breadcrumb + zoom-to-fit remain the spatial anchors; nothing in debugging introduces a *second* navigation system. One spatial model, multiple entry points into it.

---

## 6. Differentiated debugging workflows — named

The workflows that should make a Logisim-refugee audibly react, ranked:

1. **"Why?"** — one click from any unknown to its highlighted, explained cause (§4.2). The killer feature; no incumbent has causal diagnosis at all.
2. **Time scrubbing** *(north star, Tier 3)* — rewind the deterministic machine and watch the failure again (§2.5). Unique at any price point.
3. **Micro-stepping** — delta-by-delta through a single tick to dissect races and feedback (§2.2), honest because the event queue is real.
4. **X-ray peek** — live interiors under the cursor without leaving context (§5.3).
5. **Trace mode** — true event-order propagation replay as opt-in slow motion (§2.4); teaching and glitch-hunting in one tool.
6. **Instrumentation that travels** — watches (with history sparklines) saved in the project and intact in shared files (§3.2); a shared CPU arrives pre-probed.
7. **Health gutter** — ambient lint that never interrupts (§4.3), versus incumbents' modal "oscillation!" dialogs.
8. **Ink over a paused machine** — pause, then Pencil-annotate directly on the frozen state: circle the glitch, sketch the expected waveform. Pairs the existing ink layer with the transport; no engineering beyond what exists.

---

## 7. What this asks of engineering (flagged, not committed)

The design holds itself to the built architecture; these are the deltas it would request, roughly ordered by size:

- **Provenance/diagnosis API** (§4.2): given a net, classify X/Z origin (contention / floating / uninitialized) and return the upstream causal path. Netlist traversal + driver analysis on the document/bridge side; no engine semantics change. *Medium.*
- **Watch history buffer** (§2.5 Tier 1): rolling per-watch value-change log from the worker's event stream. *Small.*
- **Trace-mode event capture** (§2.4): retain the ordered event list for the last step and replay it to the renderer. *Small-medium.*
- **Health lint** (§4.3): static net analysis (floating inputs, multi-driver nets, unconnected pins) recomputed on elaboration. *Small — most data exists in `nets.ts`.*
- **Transport & clock-rate control** (§2.1–2.3): worker already runs free; needs paced-clock and step messages. *Small.*
- **Time scrubbing** (Tier 3): command-log replay to an arbitrary tick. Deterministic engine makes it *possible*; snapshotting strategy makes it *fast*. Explicitly deferred — design only reserves transport space.

## 8. Decision points — **ratified 2026-06-12** (all four adopted as recommended)

1. **Default time display** — clock cycles (friendlier) vs raw ticks (honest) as the transport's primary readout. Recommendation: cycles primary, ticks available; micro-stepping surfaces deltas.
2. **Tier 2 waveform timing** — design the waveform surface in this phase (it influences editor layout reservations) or after wireframes? Recommendation: after — Tier 1 mini-traces carry v1, and the history data model is the only thing layout needs to assume.
3. **Probe readouts on canvas** — pinned on-canvas value flags risk cluttering the "calm canvas" doctrine at scale. Recommendation: probes on-canvas, watches default to panel-only with opt-in canvas flags. Needs validation at wireframe stage.
4. **Health severity for floating inputs** — warning (current proposal) vs error. Deliberate Z-resting buses make "error" too aggressive; confirm.

## 9. Next steps

1. Review/contest this document; lock the time model and provenance commitment (they shape persistent editor chrome).
2. Proceed to the **editor interaction model** (product doc §12.3): full input maps per tool, now including transport keys, probe gestures, peek, and Why?.
3. Then low-fi wireframes — Home, Editor (with transport + watch list + health), Create Chip flow, Share sheet.

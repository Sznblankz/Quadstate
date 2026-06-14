# QuadState — Interaction Prototype Plan (Gray-Box)

**Phase:** Product Design & UX Planning — document 4; validation plan, not implementation
**Date:** 2026-06-12
**Status:** Amended 2026-06-12 after the four-document system review (silent-pause metric added to Card C, Card D speed gate corrected, keymap amendments propagated) — **ready to build**
**Depends on:** `EDITOR_INTERACTION_MODEL.md` (the contract under test, esp. §13 contestable decisions), `SIMULATION_DEBUGGING_UX.md`, `PRODUCT_DEFINITION.md`.
**Purpose:** discover whether the interaction contract feels as good in hands as it reads on paper — *before* any visual design. The output is not a product; it is **evidence**: each §13 decision either survives, gets amended, or falls to its named fallback, and the amendments are written back into doc 3 before wireframing begins.

---

## 1. Stance and scope

### What this prototype is
A **gray-box input harness**: the existing canvas renderer (`packages/canvas`, unstyled), real engine simulation (so wires carry true values — feel depends on liveness), and the doc-3 contract implemented for **desktop mouse + keyboard only**. No styling beyond what already renders. No new visual work of any kind — if a choice arises between making it pretty and making it honest, honest wins.

### Why desktop-only
Desktop/web is the design lead (decisions log). Touch and Pencil validation requires iPad hardware and the Capacitor build (blocked on macOS — known backlog item); §13.4 (finger demotion) is explicitly deferred to a later hardware session. Nothing in this prototype forecloses it: the gesture arbitration layer keeps the contracts separate by construction.

### What is explicitly out
Probe/watch/Why? interactions (doc 2's gradient — important, but not load-bearing for the six areas under test), the real transport (a LIVE/PAUSED indicator suffices to test Space discrimination), edit-definition mode, buses beyond the numeric stamp prefix, undo polish, touch/Pencil, all visual design.

### Reuse map — why this is small
| Need | Already built |
|---|---|
| Canvas, viewport, spatial hit-testing | `packages/canvas` Viewport + SpatialGrid |
| Input discrimination | GestureRecognizer + device policy table (this prototype is largely *new policy entries*) |
| Live simulation | engine worker, always-on |
| Net merge on wire-drop (junctions) | union-find in `nets.ts` |
| Chip creation with auto-pins | `createChipFromSelection` boundary analysis |
| Hierarchy + live probing through depth | hierarchy map, `bridge.probe`/`resolveNet` |
| Instrumentation hook | `window.__logicsim` E2E controller (extend with an event log) |

The genuinely new work: the Space discriminator, stamp mode, the Escape ladder, marquee, click-click wiring, breadcrumb strip, inline chip naming, and the interaction logger. Estimated shape: a focused few days, hosted in `apps/web` behind a prototype flag — not a new app.

---

## 2. Instrumentation — how "feel" becomes data

Feel is subjective, but its failures leave objective traces. The prototype logs every interaction event (via an extended `__logicsim` controller) with: timestamp, gesture classification, target type, and outcome (completed / canceled / **misfire**). Three instruments:

1. **Misfire counters** — the central metric. A misfire is the system doing something other than intent: moved a part while trying to wire, marquee'd while trying to deselect, paused while trying to pan. Detected automatically where possible (e.g., action immediately undone/canceled within 2s = probable misfire) and confirmed by think-aloud.
2. **The Space histogram** — every Space press logs hold-duration and whether pointer movement occurred during hold. The tap-vs-hold question (§13.1) gets settled by the *shape of this distribution*, not by opinion.
3. **Task timers** — wall-clock per scripted task, compared across repetitions (learnability) and across routes (palette vs stamps).
4. **Passive observations** — logged but ungated: wheel-then-immediate-reverse events (the §13.3 wheel-direction evidence), hover dwell patterns near pins (informs the glance stillness gate, doc 3 §7.1, even though glance itself is out of scope), and Esc-intent narration from think-aloud.

Protocol: **n = 3–5 participants** (you, plus 2–4 people of mixed familiarity — at this fidelity, small-n catches essentially all feel-level failures), think-aloud, each session ~30 minutes running the task script in §4. One session with you alone first to shake out harness bugs before burning real participants.

---

## 3. Test cards — one per area under validation

Each card: the assumption at stake, the minimum build, success criteria, failure criteria, and the pre-committed fallback. Pre-committing fallbacks matters: it prevents post-hoc rationalization ("it'll be fine with polish") when results disappoint.

---

### Card A — Wiring

**Assumptions (doc 3 §5.2):** pin-drag-means-wire is discoverable and doesn't collide with part-move at realistic pin density; drop-on-wire junctions feel natural; Space-pan mid-wire preserves flow; click-click is a sufficient precision alternative.

**Build:** pin hit zones (larger than artwork); drag-from-pin with simple orthogonal preview; drop on pin = connect, on wire = junction, elsewhere = cancel-with-refusal-cue; branch from already-wired pin; click-click mode (click pin → waypoint clicks → click target); Esc cancels (ladder rung 1); Space-pan sustained mid-wire.

**Success:** after 5 minutes of use, pin-vs-part misfire rate < 5% of drag starts on parts with adjacent pins; participants complete a 20-connection task without abandoning a wire unintentionally; at least one participant discovers junction-by-drop without being told; mid-wire pan used successfully when the task forces an off-screen target.

**Failure:** persistent pin/part misfires at DFF-density pin spacing (> ~15% after practice); participants verbalize fear of grabbing ("I don't know what I'm about to drag").

**Fallbacks, in order:** (1) pre-drag affordance — pin highlight + cursor change *before* the drag starts, making the grab predictable rather than the zones bigger; (2) asymmetric zones — pins win ties over part bodies; (3) last resort, a modal wire tool (`E`) — a retreat from modeless doctrine, recorded as such if taken.

---

### Card B — Selection & movement

**Assumptions (doc 3 §4):** empty-canvas-drag = marquee vs part-drag = move disambiguates cleanly; full-enclosure marquee matches expectation; Shift-click toggle and net ghost-highlight on wire selection read instantly.

**Build:** click select; wire-click selects segment + ghost-highlights whole net (free via union-find); Shift-click toggle; marquee (full enclosure); move with grid snap; arrow-key nudge; Esc deselect (ladder rung 3).

**Success:** zero-instruction discovery (these are conventions — anything needing explanation is a failure); marquee misfire rate (< 5% of marquees started when user meant to click/deselect on dense canvas); participants correctly predict enclosure behavior by second use; net highlight is *noticed* and correctly interpreted by at least half of participants unprompted.

**Failure:** dense-canvas marquee accidents (missing a part by pixels and triggering marquee) cause repeated undo churn; enclosure surprises persist ("why didn't it select the wire I crossed?").

**Fallbacks:** (1) drag threshold before marquee commits (~4px — likely needed regardless); (2) marquee includes wires whose *both endpoints* are enclosed (refinement, not reversal); (3) if enclosure itself fails expectation tests, switch to intersect-with-Alt-for-enclose and update doc 3.

---

### Card C — Space: tap = transport, hold = pan *(the headline test, §13.1)*

**Assumption:** one key can serve transport and pan via the tap/hold distinction without false toggles or hesitation.

**Build — test the smart discriminator first, not the naive timer:**
- Space down → **if pointer drags while Space is held: pan** (regardless of duration); 
- Space up with **no pointer movement and duration < threshold (start 180ms): toggle play/pause**;
- Space up, no movement, ≥ threshold: **nothing** (a held-then-abandoned pan).
- Movement, not time, is the primary discriminator; the timer only guards the no-movement case. Visible LIVE/PAUSED chip; the threshold is hot-tunable mid-session.

**Success:** false-toggle rate < 2% of Space presses after 10 minutes (logged: toggles followed within 1s by a re-toggle = probable false positive); **suspect-pause count ≈ 0**, where a *suspect pause* is a paused interval the user never exploits — no step, no inspection, no deliberate edit-while-paused — before resuming (the re-toggle proxy only catches *noticed* mistakes; this second metric exists to catch the card's named worst case, the silently paused sim believed live, and every suspect pause is replayed in the debrief); the duration histogram for intended taps vs intended pans is **bimodal with clean separation**; no participant reports hesitation before pressing Space; mid-gesture pan (Card A) unaffected.

**Failure:** overlapping histogram lobes at any threshold; participants pause the sim while reaching for a pan and *notice* (a paused sim silently believed live is the worst outcome this prototype can produce — it violates "truth at a glance"); anyone develops a workaround habit (e.g., only panning via middle-drag) to avoid Space.

**Fallbacks, pre-committed ladder:** (1) keep Space-pan, move transport to a dedicated key (`K` or Enter) — pan is the higher-frequency act and keeps the famous key; (2) keep Space-tap transport, pan via middle-drag/Shift-Space only; (3) both lose Space: Space does nothing, transport on Enter, pan on middle/Shift-Space — admit defeat gracefully. Whichever lands is written into doc 3 §8 with the histogram attached.

---

### Card D — Stamp mode

**Assumptions (doc 3 §5.1):** single-key load + click-to-stamp + Esc-to-end is learnable in minutes and measurably faster than the palette; the loaded state is never forgotten (no accidental stamps); the numeric width prefix parses intuitively.

**Build:** hotkeys `A O N X I U D`; ghost part on cursor while loaded; click stamps (repeatable); Esc ends (ladder rung 2); numeric prefix on `I`/`U` only (e.g., `8 I` = 8-bit input — minimal bus-creation probe); a basic palette list for the comparison route; **focus discipline** — keys are inert while any text field (chip naming) has focus, and this is itself under test (Card E creates the collision).

**Success:** learnability is the primary gate — second-attempt stamp time ≥ 30% faster than first attempt (the gray-box palette is deliberately bare, so stamp-vs-palette deltas are directional evidence only, never a gate — comparing against a rigged baseline proves nothing); accidental-stamp rate < 1 per session after the first 5 minutes; ≥ half of participants correctly guess what `4 I` will do before pressing it; Esc reliably read as "put the stamp down."

**Failure:** participants repeatedly stamp when they meant to click-select (forgot the loaded state) — the ghost cursor is insufficient signaling; or single-key hotkeys fire during naming despite focus rules (a bug class, but one that erodes trust fast).

**Fallbacks:** (1) louder loaded-state signaling (cursor badge + chrome banner) — signal failure, not model failure; (2) invert persistence: a stamp places once and unloads, **Shift-click stamps repeatedly** — flow becomes opt-in rather than opt-out; (3) hotkeys require a leader (`Q` then `A`) if bare letters prove too hot — recorded as a real cost to the expert ceiling.

---

### Card E — Create Chip (⌘G)

**Assumptions (doc 3 §5.5):** selection → ⌘G → inline name → placed chip lands as *the magic trick* (product doc stage 4); auto-derived pins match user expectation; nobody reaches for a "group" that doesn't exist during realistic tasks.

**Build:** ⌘G invokes existing `createChipFromSelection`; collapsed chip appears in place with an **inline name field** (focus discipline per Card D); "Select connected" on context menu (feeds the two-stroke expert path); the new chip is immediately stampable/placeable; double-click dives into it (Card F).

**Success:** first-time users complete creation with at most one hint; when asked *before* the collapse "what pins will this chip have?", predictions match the boundary analysis ≥ 75% of the time (this tests whether auto-pins feel *derived* or *arbitrary* — the heart of the trick); at least one unprompted positive reaction (this is the feature that should make people audibly react; silence is signal); no participant asks "can I just group these?" during tasks.

**Failure:** pin surprise — users can't predict or post-hoc explain the derived pins; the inline rename collides with stamp hotkeys; users want the cluster back and don't trust undo to do it ("un-chip" anxiety).

**Fallbacks:** (1) a **pin-review beat**: ⌘G shows the derived pins on the collapsing boundary for one confirm-click before finalizing — costs the instant magic, buys comprehension; test both variants in-session if time allows (the build difference is small); (2) "Dissolve chip" as an explicit inverse verb (undo's trustworthy cousin); (3) if group-hunger appears in *this* short protocol, that's strong evidence against §13.2 — escalate to a doc-3 amendment discussion rather than patching silently.

---

### Card F — Hierarchy navigation

**Assumptions (doc 3 §6, §1.3):** double-click dive + breadcrumb + the Escape ladder keeps users oriented at depth ≥ 3; the ladder's rung order (cancel → mode → deselect → surface) matches intuition rather than surprising it.

**Build:** double-click dive into live instance (read-only interior — edit-definition is out of scope); a plain-text breadcrumb strip (`top ▸ Adder4 ▸ FullAdder`), clickable; full Escape ladder exactly as specified; `Home` to top (amended from ⌘Esc — Windows reserves Ctrl+Esc); a simple zoom-through transition (even linear/unpolished — presence matters for orientation, polish doesn't); ⌘K with jump-to-chip as the third lane.

**Success:** at depth 3, participants answer "where are you?" and "how do you get to the top?" correctly without looking for help; **Esc-expectation misfires** (Esc did something other than the participant's stated intent) < 1 per session after first use; breadcrumb used spontaneously by at least some participants; nobody gets *lost* (defined: > 15s of stated disorientation).

**Failure:** the ladder's rung 3/4 boundary surprises (users with a selection press Esc expecting to surface, and deselect instead — twice is a pattern); dive transitions disorient rather than orient; depth is mistaken for "a different file" (instance/document confusion).

**Fallbacks:** (1) give surface a dedicated always-works key (Backspace) alongside Esc — the ladder survives but loses exclusivity; (2) merge rungs 3+4 (Esc with selection at depth both deselects *and* surfaces is wrong; instead: deselect happens on the *first* Esc, but the breadcrumb pulses to teach "again to go up") — a teaching fix before a structural one; (3) if zoom-through actively disorients, replace with a fast crossfade and note it for the motion doc.

---

## 4. Task script (one ~30-minute session)

Ordered to interleave the cards naturally rather than test them in isolation — feel failures live in the *seams*:

1. **Warm-up (Cards B, A):** "Place these three parts from the palette and wire them into [a NAND-pair latch]. Now select all of it and move it left." — first-touch discovery, no instruction.
2. **Stamp drill (Card D):** "Build a half-adder using only the keyboard to get parts." Then: "Build it again, faster." (Timer comparison.)
3. **Density test (Cards A, B):** a pre-built dense canvas (DFF bank): "Add these four wires" — misfire collection at realistic density. Forces one off-screen target (mid-wire pan, Card C seam).
4. **The trick (Card E):** "This half-adder works. Make it a chip called HA." Pre-collapse pin prediction question. "Place two of them and wire a full adder."
5. **Depth walk (Card F):** "Go inside one HA. Deeper into [nested part]. Where are you? Get back to the top." Esc-intent narration throughout.
6. **Transport stress (Card C):** with the sim visibly LIVE: "Pan around the whole circuit, then pause it, step it twice (`S`), resume." Then a 2-minute free-build with Space histogram quietly recording.
7. **Debrief (5 min):** worst moment, best moment, "did anything ever do something you didn't mean?" — replay logged misfires and ask what they expected.

## 5. Decision gates — what the evidence settles

| Doc 3 §13 decision | Settled by | Gate |
|---|---|---|
| 13.1 Space tap/hold | Card C histogram + false-toggle rate | Survive / fallback ladder rung 1–3 |
| 13.2 ⌘G, no groups | Card E (group-hunger, pin prediction) | Survive / add pin-review beat / reopen group discussion |
| 13.3 Wheel = zoom | Passive: logged wheel-then-immediate-reverse events across all tasks | Survive / flip default, keep setting |
| 13.5 `←`/`→` reserved | Not testable here (no scrubbing); unaffected | Carries forward |
| 13.4 Pencil demotion | **Out of scope** — requires iPad hardware session | Deferred, contract unchanged |
| Doc 3 §1.3 Escape ladder | Card F Esc-intent misfires | Survive / Backspace addition / rung merge |

**Exit criteria for the whole prototype:** every card resolved to *survive* or a *named fallback*; doc 3 amended accordingly (a short "validated amendments" section appended, with the Space histogram as an artifact); no open feel-questions that wireframes would have to gamble on. Then — low-fi wireframes, designing chrome around a contract that hands have actually ratified.

## 6. Sequencing

1. **Build** the harness in `apps/web` behind a prototype flag (reuse map §1) — the Space discriminator, stamp mode, Escape ladder, marquee, click-click wiring, breadcrumb, inline naming, event logger.
2. **Self-session** (you, instrumented) — shake out harness bugs, tune pin zones and the marquee threshold to plausible baselines, sanity-check the logger.
3. **Sessions** with 2–4 more hands, script per §4.
4. **Adjudicate** each card against its gates; amend `EDITOR_INTERACTION_MODEL.md`; archive the log data and histogram in `docs/product/validation/`.
5. **Proceed to low-fi wireframes** with the ratified contract as a fixed input.

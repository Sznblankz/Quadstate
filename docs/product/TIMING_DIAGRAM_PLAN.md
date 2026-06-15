# QuadState Timing Diagram / Logic Analyzer — Build-Ready Implementation Plan

Hand this directly to a coding AI. Every file path is real; every type/signature reuses
names already in the codebase. Build in the order of **§9 Implementation sequence**
(Worker history → SimBridge API → TimingDiagram.svelte → Tap-to-probe → App integration).
Verify after each step with `pnpm -r typecheck`, and at the end `pnpm --filter @logicsim/web build`.

**What we are building:** a collapsible, height-resizable **bottom drawer** in the editor.
The user taps a wire (or clicks "Add to scope" in the Inspector) to start tracking that
signal's 0/1/X/Z history over time. The drawer draws step-style waveforms using the exact
4-state visual language of the canvas, a tick grid, and a scrub cursor that reports each
signal's value at the cursor tick. Digital only — **transitions-only** history, sampled at
**settled tick boundaries**, deterministic under pause/step/run.

## QuadState rules baked into this design

- Signal colors (`sig0`/`sig1`/`sigX`/`sigZ`) are used **only** for waveform traces. All drawer
  chrome (handle, header, labels, grid, axis, cursor) is monochrome (`--surface*` / `--hairline`
  / `--text*`). `--accent` (#6C72FF) is reserved for the **focused lane** and the **scrub cursor**
  only — never as a value color.
- Visual encoding mirrors `renderer.ts` verbatim: `1` = green solid **+ halo** (the only glowing
  state), `0` = blue flat, `MIXED`(=5) = green solid **no halo**, `X` = red dash-dot, `Z` = gray dashed.
- **No wire-pulse / decorative motion.** Edges are instantaneous steps. The only motion is the
  time window scrolling as the sim advances.

## Known v1 behaviors (decide before building — surfaced by review)

1. **Captured history restarts on every structural edit.** Engine net indices are allocated by a
   global declaration-order DFS (`elaborate.ts resolveNet`), and net names are derived from wire/io
   identity, so adding/deleting/renaming **any** net re-sorts the allocation and shifts unrelated net
   indices. Therefore every structural mutation triggers `recompile()`, which resets the worker's
   recorder. **The lanes persist** (they are keyed by stable identity and re-subscribed automatically),
   but their drawn history begins again from the recompile tick. This is acceptable for a "build, then
   observe" workflow. The v2 upgrade to *carry history across edits* is specified in §11 (mirrors the
   existing DFF carry-over protocol). Do **not** present recompile-reset as a rare edge case to users.
2. **Tracking identity is stable, value follows the live net.** A tracked wire follows whatever
   electrical net it is on now (through merges/splits). The lane label is re-derived live, so a rename
   only updates the label; tracking is unbroken. See §8 for the label/merge nuance.

---

## 1. Architecture overview

```
                 worker.ts (engine; samples each settled integer tick)
                 ┌──────────────────────────────────────────────┐
                 │ ScopeRecorder: subscribed engine nets only    │
  scopeSubscribe │ series[netIdx] = [{tick,value}, ...]          │ snapshot()
  scopeUnsub  ──►│ transitions-only; per-series ring cap         │──┐ TraceMsg
                 │ sampled AFTER sim.run(t) (post-settle)        │  │ (posted right
                 └──────────────────────────────────────────────┘  │  after snapshot)
                                                                    ▼
  bridge.ts (main) ──► scopeHistory: Map<netIdx, Transition[]>;  simTime
     scopeSubscribe / scopeUnsubscribe / scopeResubscribe;  onTrace?()
     compile() clears scopeHistory synchronously (no stale frame)
                                                                    ▼
  controller.ts: tracked: TrackedSignal[]  = ONE shared list (Watches panel + scope lanes)
     - resolve each tracked entry -> net indices via bridge.wireBus / elab.resolveNet EVERY recompile
     - (re)subscribe the worker; build UiState.watches AND UiState.timeline in pushUi()
                                                                    ▼
  App.svelte: <main> → flex column: .canvas-region (flex:1) + TimingDiagram (flex:0 0 auto)
  TimingDiagram.svelte: <canvas> step waveforms, tick grid, scrub cursor
```

**Why record in the worker, per settled tick.** Snapshots are throttled to ~30/s and each
`sim.run(target)` jumps many integer ticks (~66 ticks/snapshot at the 2000 t/s default). Sampling on
the main thread would alias a fast clock down to 0–1 transitions per frame. So we sample inside the
worker. **The per-tick loop is only a uniform sampling cadence — not an engine-fidelity mechanism.**
The engine already resolves *all* transitions at integer ticks (gate delays are integer `delay[node]`;
clock toggles self-schedule at integer ticks), and `sim.run(t)` fully drains every delta cycle for all
events with `minTime <= t` before returning. So a value sampled after `sim.run(t)` is always settled,
and there are no sub-tick transitions to miss. The loop exists so `scopeSample` observes each integer
tick boundary; for moderate circuits its cost is N× cheap function calls (empty-heap ticks drain
instantly), bounded by a catch-up cap (§2.3).

**Why transitions, not dense frames.** Digital signals are piecewise-constant. Recording `{tick,value}`
only on change is naturally run-length compressed, matches step-edge rendering, and bounds memory.
Binary search over transitions gives O(log n) value-at-tick for the scrub cursor.

**Why a dedicated `TraceMsg` (not fattening `SnapshotMsg`).** `SnapshotMsg.values` is *transferred*
(its buffer is neutered on send) — history must not entangle with that transfer. Trace deltas are sent
only when something is subscribed **and** changed, so most snapshots carry no trace payload. Keeping
`SnapshotMsg` byte-for-byte unchanged means nothing else that consumes it must change. The `TraceMsg`
is posted **immediately after** each `snapshot()`, so the timeline updates on the same cadence with no
new polling loop.

---

## 2. Task A — Worker signal history

**File:** `apps/web/src/lib/sim/worker.ts`

### 2.1 New message types

Add two inbound messages and one outbound message; slot them into the existing `WorkerIn` (~line 27)
and `WorkerOut` (~line 41) unions.

```ts
// inbound — add after StepMsg (~line 26)
/** Start recording per-tick history for these ENGINE NET indices. Idempotent. */
interface ScopeSubscribeMsg { type: "scopeSubscribe"; nets: number[] }
/** Stop recording these engine net indices and drop their buffers. */
interface ScopeUnsubscribeMsg { type: "scopeUnsubscribe"; nets: number[] }

export type WorkerIn =
  | LoadMsg | PokeMsg | RunMsg | SpeedMsg | SmokeMsg | StepMsg
  | ScopeSubscribeMsg | ScopeUnsubscribeMsg;

// one transition record — export so bridge/UI share the type
export interface Transition { tick: number; value: number } // value ∈ 0|1|2|3

// outbound — trace deltas since the previous TraceMsg, per subscribed net
export interface TraceMsg {
  type: "trace";
  /** sim.time when emitted (matches the SnapshotMsg.time just sent). */
  time: number;
  /** NEW transitions appended since the previous TraceMsg (per net; may be empty). */
  deltas: Array<{ net: number; transitions: Transition[] }>;
  /** Recorder was reset this emit (load/recompile) — bridge clears its mirror first. */
  reset: boolean;
}

export type WorkerOut = SnapshotMsg | SmokeResultMsg | TraceMsg;
```

### 2.2 ScopeRecorder state

Add alongside the existing module pacing state (~after line 49):

```ts
const SCOPE_CAP = 20000;       // max transitions retained per net (ring); long window
const MAX_CATCHUP = 4096;      // cap per-tick sampling per frame; beyond this, sample coarsely

interface Series {
  trans: Transition[];          // ring of transitions for ONE net (oldest evicted past cap)
  last: number | undefined;     // last recorded value (undefined = no sample yet)
  shipped: number;              // index of first transition not yet sent to main
}

const scope = new Map<number, Series>(); // key = engine net index
let scopeReset = false;                    // set on load; cleared after the next emit

/** Append a sample for `net` at settled tick `t`. Transitions-only, with same-tick coalescing. */
function recordSample(net: number, s: Series, t: number, v: number): void {
  if (v === s.last) return;                // dedupe: no change
  const n = s.trans.length;
  // coalesce: a poke + step landing on the SAME tick must not produce two samples at one x
  if (n > 0 && s.trans[n - 1].tick === t) {
    s.trans[n - 1].value = v;
  } else {
    s.trans.push({ tick: t, value: v });
    if (s.trans.length > SCOPE_CAP) {
      const drop = s.trans.length - SCOPE_CAP;
      s.trans.splice(0, drop);
      s.shipped = Math.max(0, s.shipped - drop);
    }
  }
  s.last = v;
}

/** Sample all subscribed nets at settled tick `t`. */
function scopeSample(t: number): void {
  if (scope.size === 0 || !sim) return;
  for (const [net, s] of scope) recordSample(net, s, t, sim.value(net));
}

/** Post a TraceMsg with everything not yet shipped. No-op if nothing to send. */
function emitTrace(): void {
  const deltas: TraceMsg["deltas"] = [];
  for (const [net, s] of scope) {
    if (s.shipped < s.trans.length) {
      deltas.push({ net, transitions: s.trans.slice(s.shipped) });
      s.shipped = s.trans.length;
    }
  }
  if (deltas.length === 0 && !scopeReset) return;
  const msg: TraceMsg = { type: "trace", time: sim?.time ?? 0, deltas, reset: scopeReset };
  scopeReset = false;
  postMessage(msg);
}
```

### 2.3 Sampling at the settle boundary

The only safe sample point is **after `sim.run(t)` returns** — `run(until)` drains every queued event
with `minTime <= until` (each `processTime` completes all delta read/apply rounds) and only then sets
`this.time = until`. `sim.value(net)` is a pure read of settled `netVal`, so sampling can never observe
mid-delta state and can never perturb the simulation.

**Run loop** (~lines 123–133):

```ts
setInterval(() => {
  if (!sim) return;
  if (running) {
    const now = performance.now();
    tickFloat += ((now - lastWall) / 1000) * ticksPerSecond;
    lastWall = now;
    const target = Math.floor(tickFloat);
    if (target > sim.time) {
      if (scope.size > 0 && target - sim.time <= MAX_CATCHUP) {
        // recording: settle & sample EACH integer tick (uniform cadence)
        for (let t = sim.time + 1; t <= target; t++) { sim.run(t); scopeSample(t); }
      } else {
        // fast path (nothing tracked) OR extreme catch-up: one jump + one sample
        sim.run(target);
        if (scope.size > 0) scopeSample(target); // coarse sample, avoids worker stall
      }
    }
    snapshot();
    emitTrace();
  }
}, 33);
```

**`step`** (paused; ~lines 103–109) — capture each stepped tick:

```ts
case "step": {
  if (!sim || running) return;
  const target = sim.time + msg.ticks;
  if (scope.size > 0 && msg.ticks <= MAX_CATCHUP) {
    for (let t = sim.time + 1; t <= target; t++) { sim.run(t); scopeSample(t); }
  } else {
    sim.run(target);
    if (scope.size > 0) scopeSample(target);
  }
  tickFloat = sim.time;
  snapshot();
  emitTrace();
  return;
}
```

**`poke`** (~lines 89–97) — paused poke settles in place; record at the current tick:

```ts
case "poke": {
  if (!sim) return;
  for (const node of msg.nodes) sim.setInput(node, msg.value, sim.time);
  if (!running) {
    sim.run(sim.time);                 // settle, no time advance
    if (scope.size > 0) scopeSample(sim.time); // coalesces with any seed at this tick
    snapshot();
    emitTrace();
  }
  return;
}
```

> **Running-poke timing (deterministic, document it):** a poke while running is scheduled at the
> current settled tick `sim.time`; its resulting transition is recorded at the next sampled tick
> (`sim.time + 1`). This is a deterministic one-tick attribution offset, not a glitch.

**`load`** (~lines 66–88) — net indices are invalid across re-elaboration; reset the recorder:

```ts
// inside case "load", after `sim = next; ...`, before snapshot():
scope.clear();
scopeReset = true;     // tell the bridge to clear its mirror on the next TraceMsg
// ... existing snapshot();
emitTrace();           // ships reset:true even with no series yet
```

**New handlers** (after `case "step"`):

```ts
case "scopeSubscribe": {
  for (const net of msg.nets) {
    if (!scope.has(net)) {
      const s: Series = { trans: [], last: undefined, shipped: 0 };
      if (sim) recordSample(net, s, sim.time, sim.value(net)); // seed at the current tick
      scope.set(net, s);
    }
  }
  emitTrace();   // ship the seeded sample immediately
  return;
}
case "scopeUnsubscribe": {
  for (const net of msg.nets) scope.delete(net);
  return;
}
```

> **Message ordering invariant (FIFO).** `postMessage` is FIFO, so on recompile the worker processes
> `load` (sets `scopeReset`, emits a `reset:true` TraceMsg) strictly *before* any subsequent
> `scopeSubscribe` (which emits the seeded sample). The seeded initial transition uses `tick = sim.time`
> (= the post-load origin tick). The bridge therefore clears its history before ingesting the first
> seeded sample. (Belt-and-suspenders: the bridge also clears `scopeHistory` synchronously inside
> `compile()` — §3.4 — closing any cross-thread race entirely.)

---

## 3. Task B — SimBridge API

**File:** `apps/web/src/lib/sim/bridge.ts`

### 3.1 Imports & state

```ts
import type { WorkerIn, WorkerOut, Transition } from "./worker.js";
```

Add to the class (after `onSnapshot?`, ~line 32):

```ts
  /** Per-net transition history for subscribed nets, keyed by ENGINE NET INDEX.
   *  Cleared on every compile() (net indices are not stable across recompiles). */
  scopeHistory = new Map<number, Transition[]>();
  /** Fired after each TraceMsg is ingested (same cadence as onSnapshot). */
  onTrace?: () => void;
  /** Currently subscribed net indices (so we can resubscribe after recompile). */
  private subscribedNets = new Set<number>();
```

### 3.2 Ingest `TraceMsg`

Extend the `worker.onmessage` handler (~lines 38–47):

```ts
this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
  if (e.data.type === "snapshot") {
    this.netValues = e.data.values;
    this.simTime = e.data.time;
    this.onSnapshot?.();
  } else if (e.data.type === "trace") {
    if (e.data.reset) this.scopeHistory.clear();
    for (const d of e.data.deltas) {
      let arr = this.scopeHistory.get(d.net);
      if (!arr) { arr = []; this.scopeHistory.set(d.net, arr); }
      for (const t of d.transitions) arr.push(t);
    }
    this.onTrace?.();
  } else if (e.data.type === "smokeResult") {
    const digest = e.data.digest;
    for (const resolve of this.smokeWaiters.splice(0)) resolve(digest);
  }
};
```

### 3.3 Subscribe / unsubscribe / resubscribe

```ts
  scopeSubscribe(nets: number[]): void {
    const add: number[] = [];
    for (const n of nets) if (!this.subscribedNets.has(n)) { this.subscribedNets.add(n); add.push(n); }
    if (add.length) this.post({ type: "scopeSubscribe", nets: add });
  }

  scopeUnsubscribe(nets: number[]): void {
    const del: number[] = [];
    for (const n of nets) if (this.subscribedNets.has(n)) { this.subscribedNets.delete(n); del.push(n); }
    for (const n of del) this.scopeHistory.delete(n);
    if (del.length) this.post({ type: "scopeUnsubscribe", nets: del });
  }

  /** Replace the whole subscription with a fresh net-index set after a recompile. */
  scopeResubscribe(nets: number[]): void {
    this.scopeHistory.clear();
    this.subscribedNets = new Set(nets);
    if (nets.length) this.post({ type: "scopeSubscribe", nets });
  }
```

### 3.4 Clear history synchronously in `compile()`

`compile()` already clears `wireNets` / `wireBus` / `netValues` / `elab` (~lines 64–69). **Add
`this.scopeHistory.clear();` there too.** Without this, the `SnapshotMsg` from `load` arrives one frame
before the reset `TraceMsg`, and for that one frame `timelineState()` would index the *new* `wireBus`
indices into the *old* history → a ~16 ms wrong-signal flash. Clearing in `compile()` closes the window;
the worker's `reset` flag then only governs the worker's own buffers.

---

## 4. Task C — TimingDiagram.svelte

**File (create):** `apps/web/src/lib/TimingDiagram.svelte`

### 4.1 Data contract (built in `controller.pushUi`, §5.4)

Add to `UiState` (controller.ts, after `watches:` ~line 42):

```ts
  /** Timeline lanes for the scope drawer (one per tracked signal). */
  timeline: {
    now: number;                  // authoritative current sim tick
    lanes: Array<{
      key: string;                // stable lane key (wire:<id> | path:<path>) — shared with tracked list
      label: string;
      width: number;              // bit-count (1 = single net)
      /** value ∈ 0|1|2|3 or MIXED(5). oldestTick = first authoritative tick (ring horizon). */
      transitions: Array<{ tick: number; value: number }>;
      oldestTick: number;         // history before this is not authoritative (ring-evicted)
      gone: boolean;              // identity no longer resolves to a net
    }>;
  };
```

### 4.2 Component

```svelte
<script lang="ts">
  import { signalColor, TOKENS, MIXED } from "@logicsim/canvas";
  import type { AppController, UiState } from "./controller.js";

  let { ctrl, timeline, collapsed = $bindable(false), height = $bindable(180) }:
    { ctrl: AppController; timeline: UiState["timeline"]; collapsed?: boolean; height?: number } = $props();

  let canvas: HTMLCanvasElement;
  let cursorTick = $state<number | null>(null);   // null = follow live
  let focusedKey = $state<string | null>(null);    // accent only

  const LANE_H = 26, LABEL_W = 130, PAD = 8, AXIS_H = 18;

  // Verbatim from renderer.ts (px-space; no /z divide here). HI/LO/MIXED solid.
  function dashFor(v: number): number[] {
    if (v === 2) return [9, 4, 2, 4];   // X dash-dot
    if (v === 3) return [6, 5];         // Z even dash
    return [];
  }
  function alphaFor(v: number): number {
    if (v === 1) return 1;              // HI core (halo drawn separately)
    if (v === MIXED) return 0.9;        // defined bus value, no halo
    if (v === 0) return 0.9;            // LO flat
    if (v === 2) return 1;              // X
    return 0.7;                         // Z
  }
  const colorFor = (v: number) => signalColor(v === MIXED ? 1 : v); // MIXED renders green, no halo

  /** value-at-tick via binary search; returns null before the lane's authoritative horizon. */
  function valueAt(trans: Array<{tick:number;value:number}>, oldest: number, tick: number): number | null {
    if (trans.length === 0 || tick < oldest) return null;
    let lo = 0, hi = trans.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (trans[mid].tick <= tick) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans < 0 ? null : trans[ans].value;
  }

  /** trailing visible window auto-scaled to a round gridline step (1/2/5 ×10^n). */
  function windowFor(now: number, plotW: number) {
    const ticksWanted = Math.max(20, Math.round(plotW / 6));
    const t1 = (cursorTick !== null && cursorTick > now) ? cursorTick : now;
    const t0 = Math.max(0, t1 - ticksWanted);
    const span = Math.max(1, t1 - t0);
    const pxPerTick = plotW / span;
    const raw = 80 / pxPerTick, pow = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / pow;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
    return { t0, t1, step, pxPerTick };
  }

  function draw() {
    if (!canvas || collapsed) return;
    const dpr = devicePixelRatio || 1, cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);

    const plotW = cssW - LABEL_W - PAD;
    const { t0, t1, step, pxPerTick } = windowFor(timeline.now, plotW);
    const xOf = (t: number) => LABEL_W + (t - t0) * pxPerTick;

    // time grid (monochrome)
    ctx.strokeStyle = TOKENS.hairline; ctx.fillStyle = TOKENS.text3;
    ctx.font = "10px ui-monospace, monospace"; ctx.textBaseline = "top"; ctx.setLineDash([]);
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const x = xOf(t); ctx.beginPath(); ctx.moveTo(x, AXIS_H); ctx.lineTo(x, cssH); ctx.stroke();
      ctx.fillText(String(t), x + 2, 3);
    }

    timeline.lanes.forEach((lane, i) => {
      const yMid = AXIS_H + PAD + i * LANE_H + LANE_H / 2, yHi = yMid - 8, yLo = yMid + 8;
      ctx.fillStyle = lane.key === focusedKey ? TOKENS.accent : TOKENS.text2;
      ctx.textBaseline = "middle"; ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(lane.label + (lane.width > 1 ? ` [${lane.width}]` : ""), PAD, yMid);

      if (lane.gone) {
        ctx.strokeStyle = TOKENS.text3; ctx.setLineDash([2, 4]); ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(LABEL_W, yMid); ctx.lineTo(LABEL_W + plotW, yMid); ctx.stroke();
        ctx.globalAlpha = 1; ctx.setLineDash([]); return;
      }
      drawWaveform(ctx, lane.transitions, Math.max(t0, lane.oldestTick), t1, xOf, yHi, yLo, yMid);
    });

    if (cursorTick !== null) {
      const x = xOf(cursorTick); ctx.strokeStyle = TOKENS.accent; ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, AXIS_H); ctx.lineTo(x, cssH); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  }

  // step waveform: horizontal hold + vertical edge at each transition. drawStart clamps to oldestTick.
  function drawWaveform(ctx, trans, drawStart, t1, xOf, yHi, yLo, yMid) {
    if (trans.length === 0) return;
    const yFor = (v: number) => v === 1 ? yHi : v === 0 ? yLo : yMid;
    const drawSeg = (xa, xb, v) => {
      ctx.setLineDash(dashFor(v)); ctx.strokeStyle = colorFor(v); ctx.lineCap = "round";
      const y = yFor(v), stroke = (lw, a) => { ctx.lineWidth = lw; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); };
      if (v === 1) { stroke(7, 0.28); stroke(2, 1); } else stroke(2, alphaFor(v)); // HI halo + core; only glow
    };
    let i = 0; while (i + 1 < trans.length && trans[i + 1].tick <= drawStart) i++;
    let curT = Math.max(drawStart, trans[i].tick), curV = trans[i].value;
    for (; i < trans.length; i++) {
      const segEnd = (i + 1 < trans.length) ? trans[i + 1].tick : t1;
      const xa = xOf(Math.max(curT, drawStart)), xb = xOf(Math.min(segEnd, t1));
      if (xb > xa) drawSeg(xa, xb, curV);
      if (i + 1 < trans.length) {
        const nv = trans[i + 1].value, xe = xOf(trans[i + 1].tick);
        ctx.setLineDash([]); ctx.strokeStyle = colorFor(nv); ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xe, curV === 1 ? yHi : curV === 0 ? yLo : yMid);
        ctx.lineTo(xe, nv === 1 ? yHi : nv === 0 ? yLo : yMid); ctx.stroke(); ctx.globalAlpha = 1;
        curV = nv; curT = trans[i + 1].tick;
      }
      if (segEnd >= t1) break;
    }
  }

  $effect(() => { void timeline; void height; void collapsed; void cursorTick; void focusedKey; draw(); });

  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect(), plotW = r.width - LABEL_W - PAD;
    const { t0, pxPerTick } = windowFor(timeline.now, plotW), x = e.clientX - r.left;
    cursorTick = x < LABEL_W ? null : Math.max(0, Math.round(t0 + (x - LABEL_W) / pxPerTick));
  }
  function onLeave() { cursorTick = null; }

  // resize handle (mirrors the right-rail drag pattern)
  let resizing = false, startY = 0, startH = 0;
  function startResize(e: PointerEvent) {
    resizing = true; startY = e.clientY; startH = height;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizeMove(e: PointerEvent) {
    if (!resizing) return;
    height = Math.max(80, Math.min(window.innerHeight * 0.6, startH + (startY - e.clientY)));
  }
  function endResize(e: PointerEvent) { resizing = false; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); }

  const VAL = ["0", "1", "X", "Z"];
</script>

<div class="td" class:collapsed style="--td-h: {height}px">
  <div class="td-handle" onpointerdown={startResize} onpointermove={onResizeMove} onpointerup={endResize}
       role="separator" aria-label="Resize timeline"></div>
  <div class="td-head">
    <span class="td-title">TIMING</span>
    <span class="td-tick">t = {cursorTick ?? timeline.now}</span>
    <div class="td-spacer"></div>
    {#if cursorTick !== null}
      <span class="td-readouts">
        {#each timeline.lanes as l (l.key)}
          {@const v = valueAt(l.transitions, l.oldestTick, cursorTick)}
          <span class="ro" title={l.label}>{l.label}:
            <b style="color:{v === null ? 'var(--text3)' : colorFor(v)}">{v === null ? "—" : (VAL[v] ?? "∗")}</b>
          </span>
        {/each}
      </span>
    {/if}
    <button class="td-collapse" onclick={() => collapsed = !collapsed}>{collapsed ? "▴" : "▾"}</button>
  </div>
  {#if !collapsed}
    <canvas bind:this={canvas} onpointermove={onMove} onpointerleave={onLeave}></canvas>
  {/if}
</div>
```

Styling: `.td` background `--surface1`, `.td-head` `--surface2` with a `--hairline` top border;
title/tick `--text3`, readouts `--text2`; `.td-handle` is a 6px grab strip (`cursor: ns-resize`).
`--accent` only on the focused-lane label and scrub cursor. When `collapsed`, the root collapses to the
header bar height (canvas unmounted) so the canvas region reclaims the space. Add `overflow-y:auto` to
`.td` so >N lanes scroll (see §8 "many tracked nets").

---

## 5. Task D — Tap-to-probe + one shared tracked-signals list

### 5.1 The model: one list, two derived views

There is **one** source of truth: `controller.tracked: TrackedSignal[]`. Both the **Watches panel**
(`UiState.watches` objects) and the **scope** (`UiState.timeline` lanes) are *derived* from it in
`pushUi()`. The TimingDiagram consumes `ui.timeline`; the Watches panel consumes `ui.watches`; neither
holds its own list.

A tracked signal is a discriminated union so a canvas wire-tap (id space) and an Inspector probe
(path space) are both first-class, both persistable, and both re-resolved on recompile:

```ts
// controller.ts (near other types)
export type TrackedSignal =
  | { kind: "wire"; wireId: number }   // a wire EntityId (stable across edits/save/load)
  | { kind: "path"; path: string };    // a probe path (stable: based on stable component ids)

const trackKey = (t: TrackedSignal) => t.kind === "wire" ? `wire:${t.wireId}` : `path:${t.path}`;
```

> **Migration of the existing `watches: number[]`.** Replace the private field `watches: number[]`
> with `tracked: TrackedSignal[]`. Update the existing consumers — `watchRows()`, `canWatch`,
> `addWatchSelected()`, `removeWatch()` — to operate on `tracked` (wire-kind entries only for the
> Watches panel). The public `UiState.watches` shape is unchanged, so `App.svelte`'s
> `{#each ui.watches as w (w.id)}` keeps working.

### 5.2 Controller: add / remove

```ts
  /** Add a wire to the shared tracked list (Watches + scope). Idempotent. */
  addTrackedWire(wireId: number): void {
    if (!this.doc.wires.has(wireId)) return;
    const key = trackKey({ kind: "wire", wireId });
    if (this.tracked.some((t) => trackKey(t) === key)) return;
    if (this.tracked.length >= TRACK_MAX) { this.status = "Scope is full (16 signals)"; this.pushUi(); return; }
    this.tracked.push({ kind: "wire", wireId });
    this.syncScopeSubscription(); this.pushUi();
  }

  /** Add a probe path (Inspector). Idempotent. */
  addTrackedPath(path: string): void {
    const key = trackKey({ kind: "path", path });
    if (this.tracked.some((t) => trackKey(t) === key)) return;
    if (this.tracked.length >= TRACK_MAX) { this.status = "Scope is full (16 signals)"; this.pushUi(); return; }
    this.tracked.push({ kind: "path", path });
    this.syncScopeSubscription(); this.pushUi();
  }

  removeTracked(key: string): void {
    this.tracked = this.tracked.filter((t) => trackKey(t) !== key);
    this.syncScopeSubscription(); this.pushUi();
  }
```

`TRACK_MAX = 16`. Keep `addWatchSelected()` but route it through `addTrackedWire(id)` for each selected
wire; keep `removeWatch(id)` as a thin wrapper → `removeTracked(\`wire:${id}\`)`.

### 5.3 Resolve identities → net indices on every recompile

```ts
  /** Re-resolve every tracked entry to current engine net indices and re-subscribe.
   *  Net indices are NOT stable across recompiles, so this re-derives every time. */
  private syncScopeSubscription(): void {
    const nets: number[] = [];
    for (const t of this.tracked) {
      if (t.kind === "wire") {
        if (!this.doc.wires.has(t.wireId)) continue;
        const bus = this.bridge.wireBus.get(t.wireId);
        if (bus) nets.push(...bus);
      } else {
        const r = this.bridge.elab?.resolveNet(t.path);
        if (r) nets.push(...r);
      }
    }
    this.bridge.scopeResubscribe([...new Set(nets)]);
  }
```

Call it at the **end of `recompile()`** (after `compile()`, ~line 1563, before `pushUi()`):

```ts
    const result = this.bridge.compile(this.doc, this.lib);
    this.status = result.message; this.statusOk = result.ok;
    this.lastMutationAt = performance.now();
    this.syncScopeSubscription();   // <-- re-resolve net indices + re-subscribe (history cleared in compile())
    this.dirtyStatic = true; this.dirtySignals = true;
    this.autosaveDraft(); this.pushUi();
```

Wire `onTrace` to repaint (in `attach()`, next to the `onSnapshot` wiring ~line 342):

```ts
    this.bridge.onTrace = () => { this.pushUi(); };
```

### 5.4 Build `UiState.timeline` in `pushUi()`

```ts
  private timelineState(): UiState["timeline"] {
    const lanes = this.tracked.map((t) => {
      const key = trackKey(t);
      let label: string, width: number, nets: number[] | undefined;
      if (t.kind === "wire") {
        const exists = this.doc.wires.has(t.wireId);
        nets = exists ? this.bridge.wireBus.get(t.wireId) : undefined;
        label = this.watchLabel(t.wireId);
      } else {
        nets = this.bridge.elab?.resolveNet(t.path);
        label = t.path.split("/").pop() ?? t.path;
      }
      const gone = !nets || nets.length === 0;
      const width = nets?.length ?? 1;
      let transitions: Array<{ tick: number; value: number }> = [];
      let oldestTick = 0;
      if (!gone) {
        const merged = width === 1
          ? (this.bridge.scopeHistory.get(nets![0]) ?? [])
          : mergeBusTransitions(nets!, this.bridge.scopeHistory); // §5.5
        transitions = merged.trans; oldestTick = merged.oldestTick;
      }
      return { key, label, width, transitions, oldestTick, gone };
    });
    return { now: this.bridge.simTime, lanes };
  }
```

Add `timeline: this.timelineState(),` to the `this.onUi?.({ ... })` object in `pushUi()` (~line 1655).

> For single-net lanes, `oldestTick = transitions[0]?.tick ?? simTime` (the ring-evict horizon — the
> scrub cursor returns "—" before it, never a fabricated held value).

### 5.5 Bus merge — exact spec (no phantom edges)

Per-bit nets are ring-capped **independently**, so different bits may have different oldest-retained
ticks. Merging must not fabricate a transition at a tick where one bit's buffer starts but another's
does not.

```ts
// controller.ts (free function). aggregateBus is already imported from @logicsim/canvas.
function mergeBusTransitions(
  nets: number[],
  hist: Map<number, { tick: number; value: number }[]>
): { trans: { tick: number; value: number }[]; oldestTick: number } {
  const series = nets.map((n) => hist.get(n) ?? []);
  if (series.some((s) => s.length === 0)) return { trans: [], oldestTick: 0 };
  // common-coverage horizon: aggregate is only authoritative from when EVERY bit has data.
  const horizon = Math.max(...series.map((s) => s[0].tick));
  const ptr = series.map(() => 0);
  const curBits = series.map((s, i) => {            // advance each bit to its value AT `horizon`
    let j = 0; while (j + 1 < s.length && s[j + 1].tick <= horizon) j++; ptr[i] = j; return s[j].value;
  });
  const out: { tick: number; value: number }[] = [];
  let lastAgg = -1;
  const pushAgg = (tick: number) => {
    const agg = aggregateBus(curBits);
    if (agg !== lastAgg) { out.push({ tick, value: agg }); lastAgg = agg; }
  };
  pushAgg(horizon);
  // walk the merged set of change ticks > horizon
  while (true) {
    let next = Infinity;
    for (let i = 0; i < series.length; i++) if (ptr[i] + 1 < series[i].length) next = Math.min(next, series[i][ptr[i] + 1].tick);
    if (next === Infinity) break;
    for (let i = 0; i < series.length; i++) {
      const s = series[i]; if (ptr[i] + 1 < s.length && s[ptr[i] + 1].tick === next) { ptr[i]++; curBits[i] = s[ptr[i]].value; }
    }
    pushAgg(next);
  }
  return { trans: out, oldestTick: horizon };
}
```

`aggregateBus(bits)` returns `0|1|2|3|MIXED(5)` exactly as the Watches panel already uses. Add a unit
test: two bits with offset eviction horizons must not emit a transition before `horizon`.

### 5.6 Canvas tap → add to scope

The tool layer cannot read net values; it only mutates `doc`/`selection`. **Recommended (Option A — zero
`ToolContext` change):** a single wire tap already selects the wire (`modeless.ts` ~lines 68–73 →
`selection.setTo([id])`). Put the add action in the drawer/Watches header as **"+ Add selected"**, gated
by the existing `ui.canWatch`, calling `ctrl.addTrackedWire(selectedWireId)`. No tool/ctx edits → no
typecheck blast radius.

**Option B (direct tap-to-scope, only if required):** add `addToScope?(wireId: EntityId): void` to
`ToolContext` (types.ts), implement it at the single ctx construction site in controller.ts
(`addToScope: (id) => this.addTrackedWire(id)`), and in `modeless.ts.tap()` — inside the existing
wire branch — call `ctx.addToScope?.(i.target.id)` and `return` **before** `selection.setTo(...)` when a
modifier is held (e.g. `i.alt`), leaving plain tap-to-select and the `io:in` early-return untouched.
⚠️ Editing `ToolContext` forces every ctx construction site to supply the callback; there is exactly one
(controller.ts ~line 153), but run `pnpm -r typecheck` immediately.

### 5.7 Inspector "Add to scope"

**File:** `apps/web/src/lib/Inspector.svelte`. The Inspector works in **path** space, which the unified
model now supports directly. Add a `+scope` button on each leaf row (~lines 73–79), next to `.val`:

```svelte
  <button class="act scope" title="Add to timeline scope" onclick={() => ctrl.addTrackedPath(r.path)}>+scope</button>
```

This adds a `{kind:"path"}` entry — a first-class, persisted, recompile-re-resolved lane. (The earlier
draft's `addScopePath` that subscribed raw net indices with no lane is **removed**; it produced dangling,
invisible subscriptions that pointed at the wrong signal after recompile.)

---

## 6. Task E — App integration (mount the drawer)

**File:** `apps/web/src/App.svelte`

### 6.1 Restructure `<main>` into a flex column

The drawer must sit **below** the canvas host, **outside** the `overflow:hidden` `.host` div, without
collapsing the canvas. Make the canvas host and the drawer siblings inside `<main>` (replace the
`<main>` block ~lines 295–318):

```svelte
    <main>
      <div class="canvas-region">
        <CanvasHost {ctrl} />
        {#if ui.placePart}
          <div class="stamp-banner">Stamping <b>{stampLabel(ui.placePart)}</b> — click to place, Esc to stop</div>
        {/if}
        {#if ui.diveRefusal}…(unchanged)…{/if}
        {#if ui.proto && ui.rename}…(unchanged)…{/if}
        {#if !hintDismissed && !ui.editing && !ui.diving}…(unchanged)…{/if}
      </div>
      <TimingDiagram {ctrl} timeline={ui.timeline} bind:collapsed={scopeCollapsed} bind:height={scopeHeight} />
    </main>
```

CSS — **keep all existing `main` properties** and add column layout (do not drop `flex`/`min-width`):

```css
main {
  flex: 1 1 auto;       /* keep — main is a row flex item of .body */
  min-width: 0;         /* keep */
  min-height: 0;        /* add — lets the column shrink */
  display: flex;        /* add */
  flex-direction: column; /* add */
  /* position:relative MOVES to .canvas-region */
}
.canvas-region { flex: 1 1 auto; min-width: 0; min-height: 0; position: relative; }
/* TimingDiagram root is flex: 0 0 auto with height var(--td-h) when open, header-only when collapsed */
```

The banners were `position:absolute` relative to `<main>`; they now anchor to `.canvas-region` (same box
as the canvas), so `stamp-banner { top:12px }` / `hint { bottom:14px }` still land over the canvas, not
the drawer. The `min-height:0` chain (`.body` already has it; now `main` + `.canvas-region`) lets the
canvas region shrink when the drawer takes height. `CanvasHost` stays `100%/100%`; the existing
`ResizeObserver` in `controller.attach()` fires on shrink → `stack.resize()` + dirty flags. **No manual
fit on drawer resize.**

### 6.2 Drawer state + import

```ts
  import TimingDiagram from "./lib/TimingDiagram.svelte";
  let scopeCollapsed = $state(false);
  let scopeHeight = $state(180);
```

### 6.3 Non-blocking guarantee

The drawer is a separate read-only canvas with its own `$effect`-driven draw; editing gestures stay on
the schematic canvas. The drawer never calls `bridge.setRunning` — **the sim keeps running while the
drawer is open, collapsed, or resizing.** `pushUi()` already runs per snapshot/trace; the timeline
payload is rebuilt there. No new RAF/poll loop.

---

## 7. Persistence — tracked list survives reopen

**Files:** `packages/document/src/serialize.ts`, `packages/document/src/project.ts`,
`apps/web/src/lib/controller.ts`.

Wire EntityIds are stable across save/load (`serialize.ts` sorts by id, persists `nextId`, rejects
regeneration). Probe paths are stable (based on stable component ids). Persist the union.

Add to `ProjectFile` (project.ts ~line 32, after `palette?`):

```ts
  /** Tracked timeline/Watches signals. Optional (older files → []). */
  trackedSignals?: TrackedSignal[];
```

Thread it through `projectToJson` / `projectFromJson` (project.ts ~lines 49–53):

```ts
export function projectToJson(doc, userParts, lib, tracked: TrackedSignal[] = []): string {
  // ...
  const file: ProjectFile = { fileVersion: FILE_VERSION, document: toJSON(doc), parts, palette, trackedSignals: tracked };
  return JSON.stringify(file, null, 2);
}
export function projectFromJson(json, lib): { doc; userParts; tracked: TrackedSignal[] } {
  // ...
  return { doc, userParts, tracked: file.trackedSignals ?? [] };
}
```

> **Update all call sites.** `projectToJson`/`projectFromJson` may be called from chip-extraction and
> `packages/document` tests. The added param is optional (safe), but `projectFromJson`'s **return shape**
> changed — grep both names across `apps/` + `packages/document` and update every destructure.

Controller:
- `serializeProject()` (~line 1411): `return projectToJson(this.doc, this.userParts, this.lib, this.tracked);`
- `loadProjectString()` (~line 1416): destructure `const { doc, userParts, tracked } = projectFromJson(...)`;
  **after** `replaceDocumentContents(this.doc, doc)` set
  `this.tracked = tracked.filter((t) => t.kind === "path" || this.doc.wires.has(t.wireId));`
  **then** `this.recompile()` (which calls `syncScopeSubscription`, subscribing the restored ids).
- `newProject()` / `openProjectDraft()` already reset the list (~lines 1182, 1204) → change those to
  `this.tracked = []`. Restore happens in `loadProjectString`.

---

## 8. Edge cases — concrete handling

| Case | Handling |
|---|---|
| **Pause / step** | All paths (`run` loop, paused `step`, paused `poke`) settle via the same `sim.run(...)` and sample via the same `scopeSample`, so history is pacing-independent. `step(N)` records each of the N ticks (capped by `MAX_CATCHUP`). |
| **Running poke** | Scheduled at the current settled tick; its transition is recorded at the next sampled tick (`sim.time+1`). Deterministic one-tick attribution offset — documented, not a glitch. |
| **Same-tick poke + seed** | `recordSample` coalesces: a second sample at the same tick overwrites the last entry, so no zero-width segment / ambiguous value-at-tick. |
| **Reset / recompile** | `compile()` clears `scopeHistory` synchronously (no stale frame); worker `load` clears its recorder + emits `reset:true`; `syncScopeSubscription()` re-subscribes fresh net indices. Lanes persist; history restarts from the recompile tick (see §11 for carry-over). |
| **Structural edit (common case)** | Same as reset — **all** waveform history restarts because net indices shift globally. Lanes do **not** disappear. This is expected v1 behavior, surfaced in "Known v1 behaviors." |
| **Deleted wire** | `timelineState()` checks `doc.wires.has(id)` (wire-kind) / `elab.resolveNet(path)` (path-kind); if it no longer resolves, `lane.gone = true` → faint dashed midline, never stale data. `syncScopeSubscription` skips it. |
| **Net merge/split** | A tracked wire follows its electrical net through merges. Label is per-wire (`watchLabel`), so after a merge the lane may show a slightly stale-looking io name while correctly tracing the merged net. If exact label↔net match is needed later, derive the label from the resolved group's ports. Not a wrong-signal bug. |
| **Renamed signal** | Identity is wire id / path, not the name. `watchLabel`/path-tail re-derive the label live each `pushUi`, so a rename updates only the label. |
| **Reopen project** | `trackedSignals` persisted in `ProjectFile` (§7); restored in `loadProjectString`; re-subscribed on the post-load recompile. New documents (templates, chip extraction) reset to `[]`. |
| **Large circuit** | Only subscribed nets are recorded — recorder cost scales with **tracked count**, not net count. The non-recording fast path (`scope.size === 0`) is byte-for-byte unchanged. |
| **Extreme sim speed** | `MAX_CATCHUP` caps per-frame per-tick sampling; beyond it the worker falls back to one `run(target)` + one coarse sample (accepts aliasing) to avoid worker stall / snapshot back-pressure. |
| **Memory** | `SCOPE_CAP = 20000` transitions/net, oldest ring-evicted. Idle nets cost ~1 record. The lane's `oldestTick` marks the ring horizon; the scrub cursor returns "—" before it (never a fabricated held value). |
| **Many tracked nets** | `TRACK_MAX = 16` lanes; `addTracked*` shows "Scope is full". `.td` has `overflow-y:auto` so lanes scroll when `lanes.length * LANE_H > height`. |
| **Drawer collapsed** | `draw()` is guarded by `!collapsed` (canvas unmounted). Worker keeps recording, so reopening shows continuous history up to the ring cap. |

---

## 9. Implementation sequence (ordered checklist)

1. **Worker history** (`worker.ts`). Add `ScopeSubscribeMsg`/`ScopeUnsubscribeMsg` to `WorkerIn`;
   `Transition` + `TraceMsg` to `WorkerOut`. Add the `ScopeRecorder` state + `recordSample`/`scopeSample`/
   `emitTrace`. Edit the run loop (catch-up cap), `step`, paused `poke`, `load`; add the two handlers.
   **Verify:** `pnpm -r typecheck`; with nothing subscribed, behavior is unchanged.

2. **SimBridge API** (`bridge.ts`). Import `Transition`; add `scopeHistory` / `onTrace` /
   `subscribedNets`; ingest `TraceMsg`; add `scopeSubscribe`/`scopeUnsubscribe`/`scopeResubscribe`;
   **add `this.scopeHistory.clear()` to `compile()`**. **Verify:** `pnpm -r typecheck`; console:
   `bridge.scopeSubscribe([0]); run; bridge.scopeHistory.get(0)` grows with transitions only.

3. **TimingDiagram.svelte** (create). Build per §4: props, `draw`/`drawWaveform`/`valueAt`/`windowFor`,
   scrub cursor, collapse + resize, verbatim dash/alpha/halo, monochrome chrome + accent-only cursor/focus,
   `overflow-y:auto`. **Verify:** `pnpm -r typecheck`; confirm `signalColor`/`TOKENS`/`MIXED` exports.

4. **Tap-to-probe + shared list** (`controller.ts`, `Inspector.svelte`; optionally `types.ts`/`modeless.ts`).
   Migrate `watches: number[]` → `tracked: TrackedSignal[]`; update `watchRows`/`canWatch`/`addWatchSelected`/
   `removeWatch`. Add `UiState.timeline`, `addTrackedWire`/`addTrackedPath`/`removeTracked`,
   `syncScopeSubscription` (call in `recompile`), `timelineState()` + `mergeBusTransitions`; wire
   `bridge.onTrace`. Add Inspector `+scope` → `addTrackedPath`. Choose Option A (header "+ Add selected")
   or Option B (ctx hook). **Verify:** `pnpm -r typecheck`; select a wire, add it, watch the lane step-draw
   as the clock toggles. Add the bus-merge unit test.

5. **App integration + persistence** (`App.svelte`; `serialize.ts`, `project.ts`, controller persistence).
   Restructure `<main>` (keep `flex:1 1 auto`/`min-width:0`, add column + `.canvas-region`); add
   `scopeCollapsed`/`scopeHeight` + import. Add `trackedSignals?` to `ProjectFile`; thread through
   `projectToJson`/`projectFromJson` and **update all call sites**; restore in `loadProjectString`.
   **Verify:** `pnpm -r typecheck`, then `pnpm --filter @logicsim/web build`. Manual (`dev`): canvas does
   not jump on drawer open/close, editing works while the sim runs, scrub cursor reports per-signal values,
   save + reopen restores tracked lanes.

6. **Ship.** `pnpm -r typecheck && pnpm --filter @logicsim/web build` clean → commit → `git push` to
   `main` (auto-deploys to Vercel).

---

## 10. Reuse map (do not reinvent)

- `signalColor(v)`, `TOKENS`, `MIXED` (=5), `aggregateBus`, `busHex`, `busBin` → `@logicsim/canvas`
  (already imported in controller.ts; Inspector.svelte).
- Dash arrays `X=[9,4,2,4]`, `Z=[6,5]`, solid for HI/LO/MIXED; HI halo = wide pass (alpha 0.28) + core
  (alpha 1); alphas `HI 1 / LO 0.9 / X 1 / Z 0.7 / MIXED 0.9` → mirror from `renderer.ts` (drop the `/z`
  zoom divide; draw in px). Always remap `signalColor(v === MIXED ? 1 : v)`.
- Tokens `sig0 #3F72B0` / `sig1 #43D689` / `sigX #E8554E` / `sigZ #8A93A3` / `accent #6C72FF` →
  `packages/canvas/src/tokens.ts` (via `TOKENS`/CSS vars; never hard-code).
- Settle boundary `sim.run(until)` and pure read `sim.value(net)` → `packages/engine/src/simulator.ts`.
  Value codes `LO=0 / HI=1 / X=2 / Z=3` → `packages/engine/src/values.ts`.
- Wire→net `bridge.wireBus` / `bridge.wireNets` (rebuilt each `compile()`); path→net `elab.resolveNet(path)`.
- `bridge.onSnapshot` wiring point in `controller.attach()` — add `onTrace` beside it; `pushUi()` already
  runs per snapshot.
- Stable ids: `serialize.ts` (wire ids), `project.ts` `ProjectFile` (persistence).

---

## 11. v2 — carry history across edits (optional, deferred)

To preserve captured waveforms across structural edits, re-key the worker's recorder by a **stable name**
instead of net index, and carry each series forward on `load` by matching the stable name — mirroring the
existing **DFF carry-over** protocol (`worker.ts` `load`: `dffPaths` + `primeDff`). Concretely: the
controller passes, with each `load`, a map `stableKey → currentNetIndex`; the worker keeps series keyed by
`stableKey`, and on `load` re-binds each series to its new net index (dropping series whose key no longer
resolves) instead of clearing. Stable key = the net name (`w<id>` / io name) or the tracked entry's
`trackKey`. This removes the §8 "structural edit restarts history" limitation. Out of scope for v1.

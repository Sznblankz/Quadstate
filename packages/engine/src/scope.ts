/**
 * Signal-history recorder for the timing diagram / logic analyzer.
 *
 * Pure, deterministic, no DOM/worker deps — it observes a settled simulator
 * and stores per-net value history as TRANSITIONS only (one record per change,
 * not per tick). The worker owns one of these and ships transition deltas to
 * the main thread; the main thread mirrors them for the scope drawer.
 *
 * Sampling MUST happen at settled tick boundaries (after `Simulator.run(t)`
 * returns) so a read never sees a mid-delta value. See `advanceAndSample`.
 */

/** One value change of a net: `value` (the settled net value) holds from `tick`. */
export interface Transition {
  tick: number;
  /** Settled net value at `tick`. 0=LO, 1=HI, 2=X, 3=Z (engine value codes). */
  value: number;
}

/** New transitions for one net since the previous drain. */
export interface TraceDelta {
  net: number;
  transitions: Transition[];
}

/** A drain result: transition deltas plus a reset flag (set on recorder reset). */
export interface TracePayload {
  deltas: TraceDelta[];
  /** True if the recorder was reset since the last drain (load/recompile). The
   *  consumer must clear its mirror before applying `deltas`. */
  reset: boolean;
}

/** Minimal simulator surface the recorder needs — the real `Simulator` satisfies it. */
export interface SampledSim {
  readonly time: number;
  run(until: number): void;
  value(net: number): number;
}

/** Default per-net transition cap (ring buffer). */
export const SCOPE_CAP = 20000;

interface Series {
  /** Ring of transitions for one net; oldest evicted past `cap`. */
  trans: Transition[];
  /** Last recorded value (dedupe key). `undefined` = no sample yet. */
  last: number | undefined;
  /** Count of transitions already drained to the consumer. */
  shipped: number;
}

export class ScopeRecorder {
  private series = new Map<number, Series>();
  private resetPending = false;

  constructor(private readonly cap: number = SCOPE_CAP) {}

  /** Number of currently subscribed nets. */
  get size(): number {
    return this.series.size;
  }

  has(net: number): boolean {
    return this.series.has(net);
  }

  /** Subscribe a net. Idempotent. Optionally seed an initial sample at
   *  (`seedTick`, `seedValue`) so the lane has a defined value from its origin. */
  subscribe(net: number, seedTick?: number, seedValue?: number): void {
    if (this.series.has(net)) return;
    const s: Series = { trans: [], last: undefined, shipped: 0 };
    this.series.set(net, s);
    if (seedTick !== undefined && seedValue !== undefined) {
      this.record(s, seedTick, seedValue);
    }
  }

  unsubscribe(net: number): void {
    this.series.delete(net);
  }

  /** Drop all series and arm the reset flag for the next drain (load/recompile).
   *  Net indices are not stable across re-elaboration, so history is invalid. */
  reset(): void {
    this.series.clear();
    this.resetPending = true;
  }

  /** Sample every subscribed net at settled tick `t` using a value reader. */
  sampleAll(tick: number, read: (net: number) => number): void {
    for (const [net, s] of this.series) this.record(s, tick, read(net));
  }

  /** Record one sample for a specific subscribed net (paused poke / tests). */
  sample(net: number, tick: number, value: number): void {
    const s = this.series.get(net);
    if (s) this.record(s, tick, value);
  }

  private record(s: Series, tick: number, value: number): void {
    if (value === s.last) return; // transitions-only: skip unchanged
    const n = s.trans.length;
    if (n > 0 && s.trans[n - 1].tick === tick) {
      // same-tick coalesce: correct the last entry in place (no zero-width segment)
      s.trans[n - 1].value = value;
      if (s.shipped >= n) s.shipped = n - 1; // re-ship the corrected value
    } else {
      s.trans.push({ tick, value });
      if (s.trans.length > this.cap) {
        const drop = s.trans.length - this.cap;
        s.trans.splice(0, drop);
        s.shipped = Math.max(0, s.shipped - drop);
      }
    }
    s.last = value;
  }

  /** Collect transitions appended since the last drain; clears the reset flag. */
  drain(): TracePayload {
    const deltas: TraceDelta[] = [];
    for (const [net, s] of this.series) {
      if (s.shipped < s.trans.length) {
        deltas.push({ net, transitions: s.trans.slice(s.shipped) });
        s.shipped = s.trans.length;
      }
    }
    const reset = this.resetPending;
    this.resetPending = false;
    return { deltas, reset };
  }

  /** Full retained history for a net (inspection/tests). */
  history(net: number): readonly Transition[] {
    return this.series.get(net)?.trans ?? [];
  }
}

/**
 * Advance `sim` to `target` and record settled-tick history into `rec`.
 *
 * - Nothing subscribed: a single `run(target)` (engine behavior unchanged).
 * - Subscribed and the catch-up span is within `maxCatchup`: settle and sample
 *   each integer tick (uniform sampling cadence — the engine already resolves
 *   all transitions at integer ticks; this just observes every boundary).
 * - Subscribed but the span exceeds `maxCatchup` (extreme sim speed): one jump
 *   plus one coarse sample at `target`, so high-speed runs cannot stall.
 *
 * Sampling reads only AFTER `run()` returns, so it never sees mid-delta state
 * and never perturbs the simulation.
 */
export function advanceAndSample(
  sim: SampledSim,
  target: number,
  rec: ScopeRecorder,
  maxCatchup: number,
): void {
  const start = sim.time;
  if (target <= start) return;
  const read = (net: number) => sim.value(net);
  if (rec.size > 0 && target - start <= maxCatchup) {
    for (let t = start + 1; t <= target; t++) {
      sim.run(t);
      rec.sampleAll(t, read);
    }
  } else {
    sim.run(target);
    if (rec.size > 0) rec.sampleAll(target, read);
  }
}

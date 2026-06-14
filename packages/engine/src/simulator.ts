import {
  AND2, OR2, XOR2, NOT1, RES2, asInput, LO, HI, X, Z,
} from "./values.js";
import {
  type CompiledNetlist,
  NK_INPUT, NK_CLOCK, NK_AND, NK_OR, NK_XOR, NK_NAND, NK_NOR, NK_XNOR,
  NK_NOT, NK_BUF, NK_TRI, NK_DFF, NK_LUT, NK_CONST,
} from "./netlist.js";
import { EventHeap } from "./heap.js";
import { TraceHasher } from "./trace.js";

export interface OscillationDiagnostic {
  /** Simulation tick at which the delta cap was hit. */
  time: number;
  /** Nets that were still changing when the cap was hit (sorted). */
  nets: number[];
}

/**
 * Discrete-event, delta-cycle simulator over a flat netlist.
 *
 * Determinism contract: all scheduling is totally ordered by (time, seq);
 * evaluation within a delta round is two-phase (read all, then apply all),
 * so the result cannot depend on evaluation order; time and delays are
 * integer ticks; there is no floating point, wall clock, or randomness in
 * any semantic path. Identical netlists + identical setInput sequences
 * produce identical traces on every platform.
 */
export class Simulator {
  readonly nl: CompiledNetlist;
  /** Current simulation time in integer ticks. */
  time = 0;
  /** Delta rounds allowed per timestep before declaring oscillation. */
  deltaCap = 1000;
  readonly diagnostics: OscillationDiagnostic[] = [];

  private netVal: Uint8Array;
  private drvVal: Uint8Array;
  private prevClk: Uint8Array;
  private heap = new EventHeap();
  private seq = 0;
  private trace = new TraceHasher();
  private pendingInit = true;

  // Per-phase dedupe stamps (generation counters; no clearing between phases).
  private netStamp: Float64Array;
  private nodeStamp: Float64Array;
  private gen = 0;

  private popOut = new Int32Array(2);
  private curTime = 0;

  constructor(nl: CompiledNetlist) {
    this.nl = nl;
    this.netVal = new Uint8Array(nl.netCount).fill(Z);
    this.drvVal = new Uint8Array(nl.nodeCount).fill(Z);
    this.prevClk = new Uint8Array(nl.nodeCount).fill(X);
    this.netStamp = new Float64Array(nl.netCount).fill(-1);
    this.nodeStamp = new Float64Array(nl.nodeCount).fill(-1);

    for (let i = 0; i < nl.nodeCount; i++) {
      const k = nl.kind[i];
      if (k === NK_DFF) {
        this.heap.push(0, this.seq++, i, nl.p1[i]); // initial Q
      } else if (k === NK_CLOCK) {
        this.heap.push(0, this.seq++, i, LO);
      } else if (k === NK_CONST) {
        this.heap.push(0, this.seq++, i, nl.p1[i]); // fixed value, once
      }
    }
  }

  /** Resolved value of a net. */
  value(net: number): number {
    return this.netVal[net];
  }

  /**
   * The value a node currently drives (Z if it never drove). This is the
   * real per-node state — re-elaboration reads DFF/input state through it.
   */
  driverValue(node: number): number {
    return this.drvVal[node];
  }

  /** Copy all net values into `out` (the worker snapshot primitive —
   *  callers transfer the buffer across the thread boundary). */
  copyNetValues(out?: Uint8Array): Uint8Array {
    if (!out || out.length !== this.netVal.length) out = new Uint8Array(this.netVal.length);
    out.set(this.netVal);
    return out;
  }

  /** Net values for a bus, LSB first, as an array copy. */
  busValue(nets: number[]): number[] {
    return nets.map((n) => this.netVal[n]);
  }

  /** 32-bit digest of every net change applied so far. */
  get traceDigest(): number {
    return this.trace.digest;
  }

  /** Total net changes applied (the events/sec numerator for benchmarks). */
  get eventCount(): number {
    return this.trace.count;
  }

  /**
   * Override a DFF's initial value before the first run() — the
   * re-elaboration carry-over hook. Scheduled as a t=0 driver event with
   * a later sequence number than the built-in init, so it wins
   * deterministically during the initial settle.
   */
  primeDff(node: number, value: number): void {
    if (this.nl.kind[node] !== NK_DFF) {
      throw new Error(`node ${node} is not a DFF`);
    }
    if (!this.pendingInit) {
      throw new Error("primeDff is only valid before the first run()");
    }
    if (value !== LO && value !== HI && value !== X) {
      throw new Error(`invalid DFF prime value ${value}`);
    }
    this.heap.push(0, this.seq++, node, value);
  }

  /**
   * Schedule an input pin change. `at` defaults to the current time and is
   * a simulation tick — interaction commands carry sim time, never wall time.
   */
  setInput(node: number, value: number, at: number = this.time): void {
    if (this.nl.kind[node] !== NK_INPUT) {
      throw new Error(`node ${node} is not an input`);
    }
    if (value !== LO && value !== HI && value !== X && value !== Z) {
      throw new Error(`invalid logic value ${value}`);
    }
    if (!Number.isSafeInteger(at) || at < this.time) {
      throw new Error(`cannot schedule input at ${at} (current time ${this.time})`);
    }
    this.heap.push(at, this.seq++, node, value);
  }

  /** Advance simulation to `until` ticks, processing all events on the way. */
  run(until: number): void {
    if (!Number.isSafeInteger(until) || until < this.time) {
      throw new Error(`cannot run to ${until} (current time ${this.time})`);
    }
    if (this.pendingInit) {
      this.pendingInit = false;
      this.processTime(0, true);
    }
    while (this.heap.size > 0 && this.heap.minTime <= until) {
      this.processTime(this.heap.minTime, false);
    }
    this.time = until;
  }

  /** Time of the next pending event, or Infinity. */
  get nextEventTime(): number {
    return this.pendingInit ? 0 : this.heap.minTime;
  }

  // ---------------------------------------------------------------- internal

  private processTime(t: number, seedAll: boolean): void {
    this.time = t;
    this.curTime = t;
    const { heap, popOut } = this;

    // Phase 0: apply all timed driver updates scheduled for this tick.
    let changed: number[] = [];
    this.gen++;
    while (heap.size > 0 && heap.minTime === t) {
      heap.pop(popOut);
      const node = popOut[0];
      const v = popOut[1];
      if (this.nl.kind[node] === NK_CLOCK) {
        // Self-schedule the next toggle: first rise at phase (if any), then
        // every half period.
        const phase = this.nl.p1[node];
        const next = t === 0 && phase > 0 ? phase : t + this.nl.p0[node];
        heap.push(next, this.seq++, node, v === LO ? HI : LO);
      }
      this.applyDriver(node, v, 0, changed);
    }

    // Delta rounds: evaluate fanout, stage zero-delay outputs, apply, repeat.
    let evalList = seedAll ? this.allNodes() : this.fanout(changed);
    let delta = 0;
    let budget = this.deltaCap;
    let forcePasses = 0;
    const stagedNode: number[] = [];
    const stagedVal: number[] = [];

    while (evalList.length > 0) {
      if (delta >= budget) {
        // Oscillation: the circuit refuses to settle at this tick. Force the
        // still-changing nets to X (the honest 4-value answer), record a
        // diagnostic, and give X propagation a fresh budget to settle.
        forcePasses++;
        const oscNets = [...changed].sort((a, b) => a - b);
        this.diagnostics.push({ time: t, nets: oscNets });
        changed = [];
        this.gen++;
        delta++;
        for (const net of oscNets) {
          const s = this.nl.drvStart[net];
          const e = this.nl.drvStart[net + 1];
          for (let i = s; i < e; i++) this.drvVal[this.nl.drvList[i]] = X;
          const nv = this.resolveNet(net);
          if (nv !== this.netVal[net]) {
            this.netVal[net] = nv;
            this.trace.update(t, delta, net, nv);
            changed.push(net);
          }
        }
        if (forcePasses >= 3 || changed.length === 0) break;
        evalList = this.fanout(changed);
        budget = delta + this.deltaCap;
        continue;
      }

      // Read phase: evaluate every scheduled node against current net values.
      stagedNode.length = 0;
      stagedVal.length = 0;
      for (const node of evalList) {
        const v = this.evalNode(node);
        if (v >= 0 && v !== this.drvVal[node]) {
          const d = this.nl.delay[node];
          if (d === 0) {
            stagedNode.push(node);
            stagedVal.push(v);
          } else {
            heap.push(t + d, this.seq++, node, v);
          }
        }
      }

      // Apply phase: commit staged outputs, collect changed nets.
      delta++;
      changed = [];
      this.gen++;
      for (let i = 0; i < stagedNode.length; i++) {
        this.applyDriver(stagedNode[i], stagedVal[i], delta, changed);
      }
      evalList = this.fanout(changed);
    }
  }

  private applyDriver(node: number, v: number, delta: number, changed: number[]): void {
    this.drvVal[node] = v;
    const net = this.nl.out[node];
    if (net < 0) return;
    const nv = this.resolveNet(net);
    if (nv !== this.netVal[net]) {
      this.netVal[net] = nv;
      this.trace.update(this.curTime, delta, net, nv);
      if (this.netStamp[net] !== this.gen) {
        this.netStamp[net] = this.gen;
        changed.push(net);
      }
    }
  }

  private resolveNet(net: number): number {
    const s = this.nl.drvStart[net];
    const e = this.nl.drvStart[net + 1];
    if (s === e) return Z;
    let acc = this.drvVal[this.nl.drvList[s]];
    for (let i = s + 1; i < e; i++) {
      acc = RES2[(acc << 2) | this.drvVal[this.nl.drvList[i]]];
    }
    return acc;
  }

  private fanout(changedNets: number[]): number[] {
    const list: number[] = [];
    this.gen++;
    for (const net of changedNets) {
      const s = this.nl.fanStart[net];
      const e = this.nl.fanStart[net + 1];
      for (let i = s; i < e; i++) {
        const node = this.nl.fanList[i];
        if (this.nodeStamp[node] !== this.gen) {
          this.nodeStamp[node] = this.gen;
          list.push(node);
        }
      }
    }
    return list;
  }

  private allNodes(): number[] {
    const list: number[] = [];
    for (let i = 0; i < this.nl.nodeCount; i++) list.push(i);
    return list;
  }

  /** Returns the node's new driven value, or -1 for "no change driven". */
  private evalNode(node: number): number {
    const nl = this.nl;
    const k = nl.kind[node];
    const s = nl.inStart[node];
    switch (k) {
      case NK_INPUT:
      case NK_CLOCK:
      case NK_CONST:
        return -1; // driven by scheduled events only

      case NK_AND:
      case NK_NAND:
      case NK_OR:
      case NK_NOR:
      case NK_XOR:
      case NK_XNOR: {
        const e = nl.inStart[node + 1];
        const table = k === NK_AND || k === NK_NAND ? AND2
          : k === NK_OR || k === NK_NOR ? OR2 : XOR2;
        let acc: number = this.netVal[nl.inList[s]];
        for (let i = s + 1; i < e; i++) {
          acc = table[(acc << 2) | this.netVal[nl.inList[i]]];
        }
        if (k === NK_NAND || k === NK_NOR || k === NK_XNOR) acc = NOT1[acc];
        return acc;
      }

      case NK_NOT:
        return NOT1[this.netVal[nl.inList[s]]];

      case NK_BUF:
        return asInput(this.netVal[nl.inList[s]]);

      case NK_TRI: {
        const en = asInput(this.netVal[nl.inList[s + 1]]);
        if (en === LO) return Z;
        const d = asInput(this.netVal[nl.inList[s]]);
        return en === HI ? d : X;
      }

      case NK_LUT: {
        const e = nl.inStart[node + 1];
        let idx = 0;
        for (let i = s; i < e; i++) {
          const v = asInput(this.netVal[nl.inList[i]]);
          if (v === X) return X; // conservative: any unknown input -> X
          idx |= v << (i - s);
        }
        return nl.luts[nl.p0[node]][idx];
      }

      case NK_DFF: {
        // Rising-edge sample. An X/Z clock edge is conservatively NOT a
        // rising edge (Q holds); a definite LO->HI edge samples D (X if
        // D is unknown/floating).
        const clk = asInput(this.netVal[nl.inList[s + 1]]);
        const rising = this.prevClk[node] === LO && clk === HI;
        this.prevClk[node] = clk;
        if (!rising) return -1;
        return asInput(this.netVal[nl.inList[s]]);
      }

      default:
        throw new Error(`unknown node kind ${k}`);
    }
  }
}

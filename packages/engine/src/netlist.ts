import { LO, HI, X, Z } from "./values.js";

/**
 * Primitive node kinds. Every node drives at most one output net through
 * exactly one driver slot (the node id doubles as the driver id).
 */
export const NK_INPUT = 0;
export const NK_CLOCK = 1;
export const NK_AND = 2;
export const NK_OR = 3;
export const NK_XOR = 4;
export const NK_NAND = 5;
export const NK_NOR = 6;
export const NK_XNOR = 7;
export const NK_NOT = 8;
export const NK_BUF = 9;
export const NK_TRI = 10;
export const NK_DFF = 11;
export const NK_LUT = 12;
export const NK_CONST = 13;

export type GateKind =
  | typeof NK_AND
  | typeof NK_OR
  | typeof NK_XOR
  | typeof NK_NAND
  | typeof NK_NOR
  | typeof NK_XNOR;

/**
 * Flat, immutable netlist in CSR (compressed sparse row) layout.
 * Everything the simulator touches per event is a typed array —
 * no object graphs, no per-event allocation.
 */
export interface CompiledNetlist {
  netCount: number;
  nodeCount: number;
  /** node -> NK_* */
  kind: Uint8Array;
  /** node -> propagation delay in integer ticks (0 = next delta round) */
  delay: Float64Array;
  /** node -> output net index, -1 if none */
  out: Int32Array;
  /** node inputs: nets inList[inStart[n] .. inStart[n+1]) */
  inStart: Int32Array;
  inList: Int32Array;
  /** net drivers: nodes drvList[drvStart[net] .. drvStart[net+1]) */
  drvStart: Int32Array;
  drvList: Int32Array;
  /** net fanout: nodes (with this net as an input) fanList[fanStart[net] ..) */
  fanStart: Int32Array;
  fanList: Int32Array;
  /** kind-specific params: CLOCK -> half period / phase; DFF -> init value in p1;
   *  LUT -> index into `luts` in p0 */
  p0: Float64Array;
  p1: Float64Array;
  /** truth tables for LUT nodes: 2^n entries of LO/HI/X, inputs LSB-first */
  luts: Uint8Array[];
}

interface NodeSpec {
  kind: number;
  ins: number[];
  out: number;
  delay: number;
  p0: number;
  p1: number;
}

function checkTicks(name: string, v: number): void {
  if (!Number.isSafeInteger(v) || v < 0) {
    throw new Error(`${name} must be a non-negative integer tick count, got ${v}`);
  }
}

/**
 * Programmatic netlist construction. This is the engine-level API used by
 * tests and benchmarks directly; JSON part elaboration (M2) lowers to it.
 */
export class NetlistBuilder {
  private nets = 0;
  private nodes: NodeSpec[] = [];
  private luts: Uint8Array[] = [];

  net(): number {
    return this.nets++;
  }

  bus(width: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < width; i++) r.push(this.net());
    return r;
  }

  private checkNet(n: number): void {
    if (!Number.isInteger(n) || n < 0 || n >= this.nets) {
      throw new Error(`net index out of range: ${n}`);
    }
  }

  private add(spec: NodeSpec): number {
    for (const n of spec.ins) this.checkNet(n);
    if (spec.out >= 0) this.checkNet(spec.out);
    checkTicks("delay", spec.delay);
    this.nodes.push(spec);
    return this.nodes.length - 1;
  }

  /** External input pin; value is set via Simulator.setInput. Drives X until set. */
  input(out: number): number {
    return this.add({ kind: NK_INPUT, ins: [], out, delay: 0, p0: 0, p1: 0 });
  }

  /** Constant driver: holds a fixed logic value forever (one bit). */
  constant(out: number, value: number): number {
    if (value !== LO && value !== HI && value !== X && value !== Z) {
      throw new Error(`constant value must be LO/HI/X/Z, got ${value}`);
    }
    return this.add({ kind: NK_CONST, ins: [], out, delay: 0, p0: 0, p1: value });
  }

  /**
   * Free-running clock: LO at t=0, first rising edge at `phase`
   * (or at `halfPeriod` if phase is 0), toggling every `halfPeriod` ticks.
   */
  clock(out: number, halfPeriod: number, phase = 0): number {
    checkTicks("halfPeriod", halfPeriod);
    checkTicks("phase", phase);
    if (halfPeriod === 0) throw new Error("halfPeriod must be > 0");
    return this.add({ kind: NK_CLOCK, ins: [], out, delay: 0, p0: halfPeriod, p1: phase });
  }

  gate(kind: GateKind, ins: number[], out: number, delay = 0): number {
    if (ins.length < 2) throw new Error("gates need at least 2 inputs");
    return this.add({ kind, ins: [...ins], out, delay, p0: 0, p1: 0 });
  }

  not(input: number, out: number, delay = 0): number {
    return this.add({ kind: NK_NOT, ins: [input], out, delay, p0: 0, p1: 0 });
  }

  buf(input: number, out: number, delay = 0): number {
    return this.add({ kind: NK_BUF, ins: [input], out, delay, p0: 0, p1: 0 });
  }

  /** Tri-state buffer: drives `data` when enable is HI, Z when LO, X otherwise. */
  tri(data: number, enable: number, out: number, delay = 0): number {
    return this.add({ kind: NK_TRI, ins: [data, enable], out, delay, p0: 0, p1: 0 });
  }

  /**
   * Truth-table node: combinational lookup over 1..16 scalar inputs
   * (LSB-first index order). `table` has 2^n entries of LO/HI/X. Any X/Z
   * input yields X conservatively. This is how behavioral composite parts
   * evaluate without being expanded to gates.
   */
  lut(ins: number[], out: number, table: ArrayLike<number>, delay = 0): number {
    if (ins.length < 1 || ins.length > 16) {
      throw new Error(`lut needs 1..16 inputs, got ${ins.length}`);
    }
    if (table.length !== 1 << ins.length) {
      throw new Error(`lut table must have ${1 << ins.length} entries, got ${table.length}`);
    }
    const t = new Uint8Array(table.length);
    for (let i = 0; i < table.length; i++) {
      const v = table[i];
      if (v !== 0 && v !== 1 && v !== X) {
        throw new Error(`lut entries must be LO, HI, or X, got ${v}`);
      }
      t[i] = v;
    }
    this.luts.push(t);
    return this.add({
      kind: NK_LUT, ins: [...ins], out, delay, p0: this.luts.length - 1, p1: 0,
    });
  }

  /** Rising-edge D flip-flop primitive. Q starts at `init` (default X). */
  dff(d: number, clk: number, q: number, delay = 0, init: number = X): number {
    if (init !== 0 && init !== 1 && init !== X) {
      throw new Error(`dff init must be LO, HI, or X, got ${init}`);
    }
    return this.add({ kind: NK_DFF, ins: [d, clk], out: q, delay, p0: 0, p1: init });
  }

  build(): CompiledNetlist {
    const nodeCount = this.nodes.length;
    const netCount = this.nets;

    const kind = new Uint8Array(nodeCount);
    const delay = new Float64Array(nodeCount);
    const out = new Int32Array(nodeCount);
    const p0 = new Float64Array(nodeCount);
    const p1 = new Float64Array(nodeCount);

    const inStart = new Int32Array(nodeCount + 1);
    const drvCount = new Int32Array(netCount);
    const fanCount = new Int32Array(netCount);

    for (let i = 0; i < nodeCount; i++) {
      const s = this.nodes[i];
      kind[i] = s.kind;
      delay[i] = s.delay;
      out[i] = s.out;
      p0[i] = s.p0;
      p1[i] = s.p1;
      inStart[i + 1] = inStart[i] + s.ins.length;
      if (s.out >= 0) drvCount[s.out]++;
      for (const n of s.ins) fanCount[n]++;
    }

    const inList = new Int32Array(inStart[nodeCount]);
    const drvStart = new Int32Array(netCount + 1);
    const fanStart = new Int32Array(netCount + 1);
    for (let n = 0; n < netCount; n++) {
      drvStart[n + 1] = drvStart[n] + drvCount[n];
      fanStart[n + 1] = fanStart[n] + fanCount[n];
    }
    const drvList = new Int32Array(drvStart[netCount]);
    const fanList = new Int32Array(fanStart[netCount]);

    const drvFill = new Int32Array(netCount);
    const fanFill = new Int32Array(netCount);
    for (let i = 0; i < nodeCount; i++) {
      const s = this.nodes[i];
      let w = inStart[i];
      for (const n of s.ins) {
        inList[w++] = n;
        fanList[fanStart[n] + fanFill[n]++] = i;
      }
      if (s.out >= 0) drvList[drvStart[s.out] + drvFill[s.out]++] = i;
    }

    return {
      netCount, nodeCount, kind, delay, out,
      inStart, inList, drvStart, drvList, fanStart, fanList, p0, p1,
      luts: this.luts.slice(),
    };
  }
}

export { Z as NET_FLOATING };

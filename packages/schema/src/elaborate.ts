import {
  NetlistBuilder, Simulator, LO, HI, X, Z,
  NK_AND, NK_OR, NK_XOR, NK_NAND, NK_NOR, NK_XNOR,
  type CompiledNetlist, type GateKind,
} from "@logicsim/engine";
import { BUILTINS } from "./builtins.js";
import type { PartLibrary } from "./library.js";
import type { PartDefinition, StructuralBody, TruthTableBody } from "./types.js";

/**
 * Elaboration: recursive flattening of part definitions into one global
 * netlist with a single event queue (per plan, Pillar 2). The hierarchy
 * survives so the UI can probe internals and so re-elaboration can carry
 * state — paths are built from stable instance ids, never positional
 * indices. Net paths are not recorded during elaboration (eager recording
 * was 74% of elaboration time at 100k gates): engine nets are allocated
 * in deterministic declaration-order DFS, so `resolveNet` recomputes any
 * path's indices on demand from memoized per-definition layouts.
 *
 * Path syntax: "u1/u3/sum" = net "sum" inside instance u3 inside u1.
 * Stateful entries: "u1/u3:0" = bit 0 of DFF instance u3 inside u1.
 */
export interface Elaboration {
  netlist: CompiledNetlist;
  /**
   * Resolve a hierarchical net path to engine net indices (LSB first),
   * or undefined if no such net exists. Lazy: the first call builds the
   * per-definition layout memo; nothing is paid during elaboration.
   */
  resolveNet(path: string): number[] | undefined;
  /**
   * Hierarchical DFF bit path -> engine node id. Stays eager: reElaborate
   * iterates it to carry state, so every entry is needed anyway.
   */
  dffs: Map<string, number>;
  /** top-level in-pin name -> engine INPUT node ids per bit */
  inputs: Map<string, number[]>;
  /** top-level out-pin name -> engine net indices per bit */
  outputs: Map<string, number[]>;
}

export interface LiveCircuit {
  sim: Simulator;
  elab: Elaboration;
}

const GATE_KINDS: Record<string, GateKind> = {
  "builtin:and": NK_AND, "builtin:or": NK_OR, "builtin:xor": NK_XOR,
  "builtin:nand": NK_NAND, "builtin:nor": NK_NOR, "builtin:xnor": NK_XNOR,
};

export function elaborate(
  lib: PartLibrary,
  topId: string,
  carriedDffState?: Map<string, number>,
): Elaboration {
  const top = mustGet(lib, topId);
  const b = new NetlistBuilder();
  const elab: Elaboration = {
    netlist: undefined as unknown as CompiledNetlist,
    resolveNet: makeNetResolver(lib, topId, top),
    dffs: new Map(),
    inputs: new Map(),
    outputs: new Map(),
  };

  // Top-level pins become engine nets; in-pins additionally get INPUT nodes.
  const portNets = new Map<string, number[]>();
  for (const pin of top.interface.pins) {
    const nets = b.bus(pin.width);
    portNets.set(pin.name, nets);
    if (pin.dir === "in") {
      elab.inputs.set(pin.name, nets.map((n) => b.input(n)));
    } else {
      elab.outputs.set(pin.name, nets);
    }
  }

  instantiateInto(b, elab, lib, top, "", portNets, carriedDffState);
  elab.netlist = b.build();
  return elab;
}

/** Fresh circuit: elaborate, simulate, settle at t=0. */
export function instantiate(lib: PartLibrary, topId: string): LiveCircuit {
  const elab = elaborate(lib, topId);
  const sim = new Simulator(elab.netlist);
  sim.run(0);
  return { sim, elab };
}

/**
 * Re-elaboration after a definition change (plan: full-project rebuild
 * with state carry-over). DFF bits whose stable hierarchical path exists
 * in both old and new circuits keep their value (carried as the rebuilt
 * DFF's init); top-level input drives are re-applied; everything new
 * settles from X. The old circuit keeps serving until this returns —
 * the caller swaps atomically (double-buffer protocol).
 *
 * The new simulator restarts at tick 0: simulation time is an engine-
 * internal coordinate, and pending in-flight delay events of the old
 * circuit are intentionally dropped (the settle pass recomputes).
 */
export function reElaborate(lib: PartLibrary, topId: string, prev: LiveCircuit): LiveCircuit {
  const carried = new Map<string, number>();
  for (const [path, node] of prev.elab.dffs) {
    carried.set(path, prev.sim.driverValue(node));
  }
  const elab = elaborate(lib, topId, carried);
  const sim = new Simulator(elab.netlist);
  for (const [pin, nodes] of elab.inputs) {
    const prevNodes = prev.elab.inputs.get(pin);
    if (!prevNodes || prevNodes.length !== nodes.length) continue;
    for (let i = 0; i < nodes.length; i++) {
      const v = prev.sim.driverValue(prevNodes[i]);
      if (v !== Z) sim.setInput(nodes[i], v, 0);
    }
  }
  sim.run(0);
  return { sim, elab };
}

// ------------------------------------------------------------------ internal

function mustGet(lib: PartLibrary, id: string): PartDefinition {
  const def = lib.get(id);
  if (!def) throw new Error(`part not in library: ${id}`);
  return def;
}

function instantiateInto(
  b: NetlistBuilder,
  elab: Elaboration,
  lib: PartLibrary,
  def: PartDefinition,
  path: string,
  portNets: Map<string, number[]>,
  carried: Map<string, number> | undefined,
): void {
  if (def.body.kind === "behavioral") {
    emitTruthTable(b, def, def.body, portNets);
    return;
  }
  const body: StructuralBody = def.body;

  // Scope: pin names bound by caller, internal nets allocated here.
  // Allocation order is the contract makeNetResolver relies on: internal
  // nets in declaration order, then composite subtrees in instance order.
  const scope = new Map<string, number[]>(portNets);
  for (const net of body.nets) {
    scope.set(net.name, b.bus(net.width));
  }

  for (const inst of body.instances) {
    const conn = (pin: string): number[] => {
      const nets = scope.get(inst.connections[pin]);
      if (!nets) throw new Error(`unresolved net for ${path}${inst.id}.${pin}`);
      return nets;
    };

    if (BUILTINS.has(inst.part)) {
      emitBuiltin(b, elab, inst.part, inst.props ?? {}, conn, path + inst.id, carried);
    } else {
      const sub = mustGet(lib, inst.part);
      const childPorts = new Map<string, number[]>();
      for (const pin of sub.interface.pins) childPorts.set(pin.name, conn(pin.name));
      instantiateInto(b, elab, lib, sub, path + inst.id + "/", childPorts, carried);
    }
  }
}

/**
 * Lazy hierarchical net resolution. Elaboration allocates engine nets in
 * deterministic order — top interface pins first, then per structural
 * body: declared nets in order, then composite children in instance order
 * (builtins and behavioral bodies allocate none). So one layout per part
 * definition (offsets of its nets and child subtrees, total bits) is
 * enough to recompute any path's indices by walking segments and summing
 * offsets. Definitions are content-addressed and immutable, so layouts
 * memoize cleanly by part id; the memo is built on first resolve.
 */
interface DefLayout {
  /** engine nets one instantiation of this definition allocates (recursive) */
  internalBits: number;
  /** declared net name -> [offset within the allocation, width] */
  nets: Map<string, [number, number]>;
  /** composite child id -> its subtree offset and binding connections */
  insts: Map<string, { offset: number; part: string; connections: Record<string, string> }>;
  pinNames: Set<string>;
}

function makeNetResolver(
  lib: PartLibrary,
  topId: string,
  top: PartDefinition,
): (path: string) => number[] | undefined {
  const layouts = new Map<string, DefLayout>();
  const layoutOf = (partId: string): DefLayout => {
    let layout = layouts.get(partId);
    if (layout) return layout;
    const def = mustGet(lib, partId);
    layout = {
      internalBits: 0,
      nets: new Map(),
      insts: new Map(),
      pinNames: new Set(def.interface.pins.map((p) => p.name)),
    };
    if (def.body.kind === "structural") {
      let off = 0;
      for (const net of def.body.nets) {
        layout.nets.set(net.name, [off, net.width]);
        off += net.width;
      }
      for (const inst of def.body.instances) {
        if (BUILTINS.has(inst.part)) continue;
        layout.insts.set(inst.id, { offset: off, part: inst.part, connections: inst.connections });
        off += layoutOf(inst.part).internalBits;
      }
      layout.internalBits = off;
    }
    layouts.set(partId, layout);
    return layout;
  };

  // Top interface pins own the first engine nets, in interface order.
  const topPins = new Map<string, [number, number]>();
  let topBits = 0;
  for (const pin of top.interface.pins) {
    topPins.set(pin.name, [topBits, pin.width]);
    topBits += pin.width;
  }

  const span = (start: number, width: number): number[] =>
    Array.from({ length: width }, (_, i) => start + i);

  return (path: string): number[] | undefined => {
    const segs = path.split("/");
    const frames: Array<{ layout: DefLayout; base: number; boundBy?: Record<string, string> }> =
      [{ layout: layoutOf(topId), base: topBits }];
    for (let i = 0; i < segs.length - 1; i++) {
      const inst = frames[i].layout.insts.get(segs[i]);
      if (!inst) return undefined;
      frames.push({
        layout: layoutOf(inst.part),
        base: frames[i].base + inst.offset,
        boundBy: inst.connections,
      });
    }
    // The leaf is either a net declared by some frame or a pin alias; a
    // pin unwinds through the connection that bound it, one scope per
    // step, until it names a declared net (or a top port). Names cannot
    // collide within a scope — the validator rejects that.
    let name = segs[segs.length - 1];
    for (let i = frames.length - 1; i >= 0; i--) {
      const net = frames[i].layout.nets.get(name);
      if (net) return span(frames[i].base + net[0], net[1]);
      if (!frames[i].layout.pinNames.has(name)) return undefined;
      if (i === 0) {
        const pin = topPins.get(name)!;
        return span(pin[0], pin[1]);
      }
      name = frames[i].boundBy![name];
    }
    return undefined;
  };
}

function emitBuiltin(
  b: NetlistBuilder,
  elab: Elaboration,
  part: string,
  props: Record<string, number>,
  conn: (pin: string) => number[],
  statePath: string,
  carried: Map<string, number> | undefined,
): void {
  const gate = GATE_KINDS[part];
  if (gate !== undefined) {
    const a = conn("a"), bb = conn("b"), y = conn("y");
    for (let i = 0; i < y.length; i++) b.gate(gate, [a[i], bb[i]], y[i]);
    return;
  }
  switch (part) {
    case "builtin:not": {
      const a = conn("a"), y = conn("y");
      for (let i = 0; i < y.length; i++) b.not(a[i], y[i]);
      return;
    }
    case "builtin:buf": {
      const a = conn("a"), y = conn("y");
      for (let i = 0; i < y.length; i++) b.buf(a[i], y[i]);
      return;
    }
    case "builtin:tri": {
      const d = conn("d"), en = conn("en"), y = conn("y");
      for (let i = 0; i < y.length; i++) b.tri(d[i], en[0], y[i]);
      return;
    }
    case "builtin:dff": {
      const d = conn("d"), clk = conn("clk"), q = conn("q");
      const defaultInit = props.init ?? BUILTINS.get(part)!.props.init.default;
      for (let i = 0; i < q.length; i++) {
        const key = `${statePath}:${i}`;
        const carriedVal = carried?.get(key);
        // Carried Z means "the old DFF never drove" — treat as X, since
        // a DFF init of Z is not meaningful.
        const init = carriedVal === undefined || carriedVal === Z
          ? (carriedVal === Z ? X : defaultInit)
          : carriedVal;
        elab.dffs.set(key, b.dff(d[i], clk[0], q[i], 0, init));
      }
      return;
    }
    case "builtin:clock": {
      const y = conn("y");
      const spec = BUILTINS.get(part)!.props;
      b.clock(y[0], props.halfPeriod ?? spec.halfPeriod.default, props.phase ?? spec.phase.default);
      return;
    }
    case "builtin:const": {
      const y = conn("y");
      const value = props.value ?? 0;
      for (let i = 0; i < y.length; i++) {
        b.constant(y[i], Math.floor(value / 2 ** i) % 2 === 1 ? HI : LO);
      }
      return;
    }
    default:
      throw new Error(`unhandled builtin ${part}`);
  }
}

/**
 * Behavioral truth table -> one LUT node per output bit. Engine LUT input
 * order is input pins in interface order, each pin LSB-first; row keys are
 * MSB-first per pin (human-readable), so index reconstruction flips bits.
 */
function emitTruthTable(
  b: NetlistBuilder,
  def: PartDefinition,
  body: TruthTableBody,
  portNets: Map<string, number[]>,
): void {
  const inPins = def.interface.pins.filter((p) => p.dir === "in");
  const outPins = def.interface.pins.filter((p) => p.dir === "out");
  const inBits = inPins.reduce((acc, p) => acc + p.width, 0);
  const rows = body.truthTable.rows;

  const lutIns: number[] = [];
  for (const pin of inPins) lutIns.push(...portNets.get(pin.name)!);

  const size = 1 << inBits;
  const keyOf = (idx: number): string => {
    const chars = new Array<string>(inBits);
    let pos = 0, off = 0;
    for (const pin of inPins) {
      for (let bit = 0; bit < pin.width; bit++) {
        chars[off + (pin.width - 1 - bit)] = String((idx >> pos) & 1);
        pos++;
      }
      off += pin.width;
    }
    return chars.join("");
  };

  // Precompute row values per index once (shared across output bits).
  const rowVals = new Array<string | undefined>(size);
  for (let idx = 0; idx < size; idx++) rowVals[idx] = rows[keyOf(idx)];

  let outOff = 0;
  for (const pin of outPins) {
    const outNets = portNets.get(pin.name)!;
    for (let bit = 0; bit < pin.width; bit++) {
      const charPos = outOff + (pin.width - 1 - bit);
      const table = new Uint8Array(size);
      for (let idx = 0; idx < size; idx++) {
        const row = rowVals[idx];
        table[idx] = row === undefined ? X : row.charCodeAt(charPos) === 49 ? HI : LO;
      }
      b.lut(lutIns, outNets[bit], table);
    }
    outOff += pin.width;
  }
}

/**
 * Composite-part-heavy benchmark (the M2 scenario family from the plan):
 * deep JSON-part nesting — full-adder -> 8-bit adder -> 64-bit adder ->
 * adder farm (4 levels). Measures elaboration time, RE-elaboration time
 * (the full-project rebuild path with state carry-over), and simulation
 * throughput, at ~10k and ~100k gates.
 */
import { Simulator, LO, HI } from "@logicsim/engine";
import { PartLibrary } from "../src/library.js";
import { elaborate, instantiate, reElaborate } from "../src/elaborate.js";
import type { InstanceSpec, PartDefinition, PinSpec } from "../src/types.js";

// Local copies of the test fixtures (bench must not import test files).
function halfAdder(): PartDefinition {
  return {
    schemaVersion: 1, name: "ha", version: "1.0.0",
    interface: {
      pins: [
        { name: "a", dir: "in", width: 1 }, { name: "b", dir: "in", width: 1 },
        { name: "s", dir: "out", width: 1 }, { name: "c", dir: "out", width: 1 },
      ],
    },
    body: {
      kind: "structural", nets: [],
      instances: [
        { id: "x1", part: "builtin:xor", connections: { a: "a", b: "b", y: "s" } },
        { id: "a1", part: "builtin:and", connections: { a: "a", b: "b", y: "c" } },
      ],
    },
  };
}

function fullAdder(haId: string): PartDefinition {
  return {
    schemaVersion: 1, name: "fa", version: "1.0.0",
    interface: {
      pins: [
        { name: "a", dir: "in", width: 1 }, { name: "b", dir: "in", width: 1 },
        { name: "cin", dir: "in", width: 1 },
        { name: "s", dir: "out", width: 1 }, { name: "cout", dir: "out", width: 1 },
      ],
    },
    body: {
      kind: "structural",
      nets: [{ name: "s1", width: 1 }, { name: "c1", width: 1 }, { name: "c2", width: 1 }],
      instances: [
        { id: "h1", part: haId, connections: { a: "a", b: "b", s: "s1", c: "c1" } },
        { id: "h2", part: haId, connections: { a: "s1", b: "cin", s: "s", c: "c2" } },
        { id: "o1", part: "builtin:or", connections: { a: "c1", b: "c2", y: "cout" } },
      ],
    },
  };
}

/** Chain `n` copies of a smaller adder into an n*innerBits adder. */
function chainAdder(name: string, n: number, innerBits: number, innerId: string): PartDefinition {
  const bits = n * innerBits;
  const pins: PinSpec[] = [];
  for (let i = 0; i < bits; i++) pins.push({ name: `a${i}`, dir: "in", width: 1 });
  for (let i = 0; i < bits; i++) pins.push({ name: `b${i}`, dir: "in", width: 1 });
  pins.push({ name: "cin", dir: "in", width: 1 });
  for (let i = 0; i < bits; i++) pins.push({ name: `s${i}`, dir: "out", width: 1 });
  pins.push({ name: "cout", dir: "out", width: 1 });

  const nets = [];
  const instances: InstanceSpec[] = [];
  for (let k = 0; k < n; k++) {
    const conn: Record<string, string> = {
      cin: k === 0 ? "cin" : `c${k}`,
      cout: k === n - 1 ? "cout" : `c${k + 1}`,
    };
    if (k < n - 1) nets.push({ name: `c${k + 1}`, width: 1 });
    for (let i = 0; i < innerBits; i++) {
      conn[innerBits === 1 ? "a" : `a${i}`] = `a${k * innerBits + i}`;
      conn[innerBits === 1 ? "b" : `b${i}`] = `b${k * innerBits + i}`;
      conn[innerBits === 1 ? "s" : `s${i}`] = `s${k * innerBits + i}`;
    }
    instances.push({ id: `u${k}`, part: innerId, connections: conn });
  }
  return {
    schemaVersion: 1, name, version: "1.0.0",
    interface: { pins },
    body: { kind: "structural", nets, instances },
  };
}

/** Farm of K independent 64-bit adders (inputs shared, sums private). */
function farm(k: number, adder64: string): PartDefinition {
  const pins: PinSpec[] = [];
  for (let i = 0; i < 64; i++) pins.push({ name: `a${i}`, dir: "in", width: 1 });
  for (let i = 0; i < 64; i++) pins.push({ name: `b${i}`, dir: "in", width: 1 });
  pins.push({ name: "cin", dir: "in", width: 1 });
  const nets = [];
  const instances: InstanceSpec[] = [];
  for (let u = 0; u < k; u++) {
    const conn: Record<string, string> = { cin: "cin" };
    for (let i = 0; i < 64; i++) {
      conn[`a${i}`] = `a${i}`;
      conn[`b${i}`] = `b${i}`;
      const sNet = `s_${u}_${i}`;
      nets.push({ name: sNet, width: 1 });
      conn[`s${i}`] = sNet;
    }
    const coutNet = `co_${u}`;
    nets.push({ name: coutNet, width: 1 });
    conn.cout = coutNet;
    instances.push({ id: `adder${u}`, part: adder64, connections: conn });
  }
  return {
    schemaVersion: 1, name: `farm${k}`, version: "1.0.0",
    interface: { pins },
    body: { kind: "structural", nets, instances },
  };
}

interface Row {
  scenario: string;
  gates: number;
  elabMs: number;
  reElabMs: number;
  simMs: number;
  events: number;
  eventsPerSec: number;
}
const rows: Row[] = [];

function bench(k: number): void {
  const lib = new PartLibrary();
  const haId = lib.add(halfAdder());
  const faId = lib.add(fullAdder(haId));
  const a8 = lib.add(chainAdder("adder8", 8, 1, faId));
  const a64 = lib.add(chainAdder("adder64", 8, 8, a8));
  const topId = lib.add(farm(k, a64));
  const gates = k * 64 * 5; // 5 gates per full adder bit

  const t0 = performance.now();
  const live = instantiate(lib, topId);
  const t1 = performance.now();

  // Stimulus: drive inputs, then toggle low-order bits (worst-case ripple
  // through every adder in the farm simultaneously).
  for (let i = 0; i < 64; i++) {
    live.sim.setInput(live.elab.inputs.get(`a${i}`)![0], i % 3 === 0 ? HI : LO, 0);
    live.sim.setInput(live.elab.inputs.get(`b${i}`)![0], i % 2 === 0 ? HI : LO, 0);
  }
  live.sim.setInput(live.elab.inputs.get("cin")![0], LO, 0);
  const t2 = performance.now();
  for (let step = 1; step <= 100; step++) {
    const t = step * 2;
    live.sim.setInput(live.elab.inputs.get("a0")![0], step % 2 === 0 ? HI : LO, t);
    live.sim.run(t);
  }
  const t3 = performance.now();

  // Re-elaboration: full-project rebuild with carry-over (combinational
  // here, so it exercises the rebuild + input-carry + settle path).
  const t4 = performance.now();
  const live2 = reElaborate(lib, topId, live);
  const t5 = performance.now();
  if (!(live2.sim instanceof Simulator)) throw new Error("unreachable");

  const simMs = t3 - t2;
  rows.push({
    scenario: `farm of ${k} x 64-bit adders (4-level nesting)`,
    gates,
    elabMs: +(t1 - t0).toFixed(1),
    reElabMs: +(t5 - t4).toFixed(1),
    simMs: +simMs.toFixed(1),
    events: live.sim.eventCount,
    eventsPerSec: Math.round(live.sim.eventCount / (simMs / 1000)),
  });
}

bench(4);  // warmup
rows.length = 0;

bench(31);  // ~10k gates
bench(312); // ~100k gates

console.table(rows);

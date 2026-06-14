/**
 * Elaboration cost and lazy hierarchy resolution. Elaboration records no
 * net paths (it used to eagerly build ~485k Map entries — 74% of its
 * time at 100k gates); resolveNet recomputes indices on demand from
 * memoized per-definition layouts, paid on first use.
 */
import { PartLibrary } from "../src/library.js";
import { elaborate } from "../src/elaborate.js";
import type { InstanceSpec, PartDefinition, PinSpec } from "../src/types.js";

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
    interface: { pins }, body: { kind: "structural", nets, instances },
  };
}
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
      conn[`a${i}`] = `a${i}`; conn[`b${i}`] = `b${i}`;
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
    interface: { pins }, body: { kind: "structural", nets, instances },
  };
}

const lib = new PartLibrary();
const haId = lib.add(halfAdder());
const faId = lib.add(fullAdder(haId));
const a8 = lib.add(chainAdder("adder8", 8, 1, faId));
const a64 = lib.add(chainAdder("adder64", 8, 8, a8));
const topId = lib.add(farm(312, a64));

for (let i = 0; i < 2; i++) elaborate(lib, topId); // warmup

let t = performance.now();
const elab = elaborate(lib, topId);
const elabMs = performance.now() - t;

// First resolve builds the per-definition layout memo.
t = performance.now();
const probe = elab.resolveNet("adder0/u0/u0/s1");
const firstMs = performance.now() - t;
if (!probe) throw new Error("resolver failed on a known deep path");

// Steady state: one deep internal net per full adder in the farm.
t = performance.now();
let resolved = 0;
for (let u = 0; u < 312; u++) {
  for (let k = 0; k < 8; k++) {
    for (let i = 0; i < 8; i++) {
      if (elab.resolveNet(`adder${u}/u${k}/u${i}/c1`)) resolved++;
    }
  }
}
const batchMs = performance.now() - t;
if (resolved !== 312 * 8 * 8) throw new Error(`expected ${312 * 8 * 8} resolves, got ${resolved}`);

console.log(`elaboration:    ${elabMs.toFixed(1)} ms (no hierarchy recording)`);
console.log(`first resolve:  ${firstMs.toFixed(2)} ms (builds layout memo)`);
console.log(`${resolved} resolves: ${batchMs.toFixed(1)} ms (${(resolved / batchMs).toFixed(0)}/ms)`);
console.log(`netlist nodes:  ${elab.netlist.nodeCount}`);

import type { PartDefinition } from "../src/types.js";

/** Shared test fixtures. */

export function halfAdder(over: Partial<PartDefinition> = {}): PartDefinition {
  return {
    schemaVersion: 1,
    name: "half-adder",
    version: "1.0.0",
    interface: {
      pins: [
        { name: "a", dir: "in", width: 1 },
        { name: "b", dir: "in", width: 1 },
        { name: "s", dir: "out", width: 1 },
        { name: "c", dir: "out", width: 1 },
      ],
    },
    body: {
      kind: "structural",
      nets: [],
      instances: [
        { id: "x1", part: "builtin:xor", connections: { a: "a", b: "b", y: "s" } },
        { id: "a1", part: "builtin:and", connections: { a: "a", b: "b", y: "c" } },
      ],
    },
    ...over,
  };
}

export function fullAdder(haId: string): PartDefinition {
  return {
    schemaVersion: 1,
    name: "full-adder",
    version: "1.0.0",
    interface: {
      pins: [
        { name: "a", dir: "in", width: 1 },
        { name: "b", dir: "in", width: 1 },
        { name: "cin", dir: "in", width: 1 },
        { name: "s", dir: "out", width: 1 },
        { name: "cout", dir: "out", width: 1 },
      ],
    },
    body: {
      kind: "structural",
      nets: [
        { name: "s1", width: 1 },
        { name: "c1", width: 1 },
        { name: "c2", width: 1 },
      ],
      instances: [
        { id: "h1", part: haId, connections: { a: "a", b: "b", s: "s1", c: "c1" } },
        { id: "h2", part: haId, connections: { a: "s1", b: "cin", s: "s", c: "c2" } },
        { id: "o1", part: "builtin:or", connections: { a: "c1", b: "c2", y: "cout" } },
      ],
    },
  };
}

/** N-bit ripple adder over scalar pins a0..aN-1 / b0.. / s0.. + cin/cout. */
export function rippleAdderPart(bits: number, faId: string): PartDefinition {
  const pins: PartDefinition["interface"]["pins"] = [];
  for (let i = 0; i < bits; i++) pins.push({ name: `a${i}`, dir: "in", width: 1 });
  for (let i = 0; i < bits; i++) pins.push({ name: `b${i}`, dir: "in", width: 1 });
  pins.push({ name: "cin", dir: "in", width: 1 });
  for (let i = 0; i < bits; i++) pins.push({ name: `s${i}`, dir: "out", width: 1 });
  pins.push({ name: "cout", dir: "out", width: 1 });

  const nets = [];
  const instances = [];
  for (let i = 0; i < bits; i++) {
    const carryIn = i === 0 ? "cin" : `c${i}`;
    const carryOut = i === bits - 1 ? "cout" : `c${i + 1}`;
    if (i < bits - 1) nets.push({ name: `c${i + 1}`, width: 1 });
    instances.push({
      id: `fa${i}`,
      part: faId,
      connections: { a: `a${i}`, b: `b${i}`, cin: carryIn, s: `s${i}`, cout: carryOut },
    });
  }
  return {
    schemaVersion: 1,
    name: `adder${bits}`,
    version: "1.0.0",
    interface: { pins },
    body: { kind: "structural", nets, instances },
  };
}

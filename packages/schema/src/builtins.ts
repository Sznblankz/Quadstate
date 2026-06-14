import type { ResolvedInterface } from "./types.js";

export interface PropSpec {
  min: number;
  max: number;
  default: number;
}

export interface BuiltinSpec {
  iface: ResolvedInterface;
  props: Record<string, PropSpec>;
}

const TICK_MAX = Number.MAX_SAFE_INTEGER;

/** Pin width 0 = flexible: adopts the instance's unified width. */
function gate2(): BuiltinSpec {
  return {
    iface: {
      pins: [
        { name: "a", dir: "in", width: 0 },
        { name: "b", dir: "in", width: 0 },
        { name: "y", dir: "out", width: 0 },
      ],
    },
    props: {},
  };
}

export const BUILTINS: ReadonlyMap<string, BuiltinSpec> = new Map<string, BuiltinSpec>([
  ["builtin:and", gate2()],
  ["builtin:or", gate2()],
  ["builtin:xor", gate2()],
  ["builtin:nand", gate2()],
  ["builtin:nor", gate2()],
  ["builtin:xnor", gate2()],
  ["builtin:not", {
    iface: { pins: [{ name: "a", dir: "in", width: 0 }, { name: "y", dir: "out", width: 0 }] },
    props: {},
  }],
  ["builtin:buf", {
    iface: { pins: [{ name: "a", dir: "in", width: 0 }, { name: "y", dir: "out", width: 0 }] },
    props: {},
  }],
  ["builtin:tri", {
    iface: {
      pins: [
        { name: "d", dir: "in", width: 0 },
        { name: "en", dir: "in", width: 1 },
        { name: "y", dir: "out", width: 0 },
      ],
    },
    props: {},
  }],
  ["builtin:dff", {
    iface: {
      pins: [
        { name: "d", dir: "in", width: 0 },
        { name: "clk", dir: "in", width: 1 },
        { name: "q", dir: "out", width: 0 },
      ],
    },
    // init: 0, 1, or 2 (X). Default X — honest power-on state.
    props: { init: { min: 0, max: 2, default: 2 } },
  }],
  ["builtin:clock", {
    iface: { pins: [{ name: "y", dir: "out", width: 1 }] },
    props: {
      halfPeriod: { min: 1, max: TICK_MAX, default: 1 },
      phase: { min: 0, max: TICK_MAX, default: 0 },
    },
  }],
  // Constant source: drives a fixed value on its (bus-width) output. `value`
  // is the whole-bus integer, bit i = (value >> i) & 1.
  ["builtin:const", {
    iface: { pins: [{ name: "y", dir: "out", width: 0 }] },
    props: { value: { min: 0, max: TICK_MAX, default: 0 } },
  }],
]);

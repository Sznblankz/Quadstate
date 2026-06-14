import { describe, expect, it } from "vitest";
import { LO, HI, X, type Simulator } from "@logicsim/engine";
import { PartLibrary } from "../src/library.js";
import { instantiate, reElaborate, type LiveCircuit } from "../src/elaborate.js";
import type { InstanceSpec, PartDefinition } from "../src/types.js";
import { halfAdder, fullAdder, rippleAdderPart } from "./parts.js";

function setNum(live: LiveCircuit, prefix: string, bits: number, value: number, at: number): void {
  for (let i = 0; i < bits; i++) {
    const nodes = live.elab.inputs.get(`${prefix}${i}`)!;
    live.sim.setInput(nodes[0], (value >> i) & 1 ? HI : LO, at);
  }
}

function readNum(live: LiveCircuit, prefix: string, bits: number): number {
  let v = 0;
  for (let i = bits - 1; i >= 0; i--) {
    const nets = live.elab.outputs.get(`${prefix}${i}`)!;
    const bit = live.sim.value(nets[0]);
    expect([LO, HI]).toContain(bit);
    v = (v << 1) | bit;
  }
  return v;
}

describe("structural elaboration", () => {
  it("half adder computes its truth table", () => {
    const lib = new PartLibrary();
    const id = lib.add(halfAdder());
    const live = instantiate(lib, id);
    const a = live.elab.inputs.get("a")![0];
    const b = live.elab.inputs.get("b")![0];
    const s = live.elab.outputs.get("s")![0];
    const c = live.elab.outputs.get("c")![0];

    const cases: Array<[number, number, number, number]> = [
      [LO, LO, LO, LO], [LO, HI, HI, LO], [HI, LO, HI, LO], [HI, HI, LO, HI],
    ];
    let t = 0;
    for (const [av, bv, sv, cv] of cases) {
      t += 10;
      live.sim.setInput(a, av, t);
      live.sim.setInput(b, bv, t);
      live.sim.run(t);
      expect(live.sim.value(s)).toBe(sv);
      expect(live.sim.value(c)).toBe(cv);
    }
  });

  it("8-bit adder of nested composites adds numbers", () => {
    const lib = new PartLibrary();
    const haId = lib.add(halfAdder());
    const faId = lib.add(fullAdder(haId));
    const addId = lib.add(rippleAdderPart(8, faId));
    const live = instantiate(lib, addId);

    setNum(live, "a", 8, 5, 10);
    setNum(live, "b", 8, 9, 10);
    live.sim.setInput(live.elab.inputs.get("cin")![0], LO, 10);
    live.sim.run(10);
    expect(readNum(live, "s", 8)).toBe(14);
    expect(live.sim.value(live.elab.outputs.get("cout")![0])).toBe(LO);

    setNum(live, "a", 8, 200, 20);
    setNum(live, "b", 8, 100, 20);
    live.sim.run(20);
    expect(readNum(live, "s", 8)).toBe(44); // 300 mod 256
    expect(live.sim.value(live.elab.outputs.get("cout")![0])).toBe(HI);
  });

  it("resolveNet resolves internal nets by stable instance path", () => {
    const lib = new PartLibrary();
    const haId = lib.add(halfAdder());
    const faId = lib.add(fullAdder(haId));
    const addId = lib.add(rippleAdderPart(4, faId));
    const live = instantiate(lib, addId);

    // fa2's internal first-half-adder sum, three levels deep.
    expect(live.elab.resolveNet("fa2/s1")).toBeDefined();
    expect(live.elab.resolveNet("fa2/h1/a")).toBeDefined();

    // Pin paths are aliases: fa2's "a" pin is bound to top pin a2, and
    // h1's "a" pin inside fa2 unwinds to the same engine net.
    expect(live.elab.resolveNet("fa2/h1/a")).toEqual(live.elab.resolveNet("a2"));
    expect(live.elab.resolveNet("fa2/a")).toEqual(live.elab.resolveNet("a2"));
    // fa1's cout and fa2's cin are both bound to the ripple carry c2.
    expect(live.elab.resolveNet("fa2/cin")).toEqual(live.elab.resolveNet("c2"));
    expect(live.elab.resolveNet("fa1/cout")).toEqual(live.elab.resolveNet("c2"));

    // Unknown instance ids and net names resolve to undefined.
    expect(live.elab.resolveNet("fa9/s1")).toBeUndefined();
    expect(live.elab.resolveNet("fa2/nope")).toBeUndefined();
    expect(live.elab.resolveNet("fa2/h1/nope")).toBeUndefined();

    // Probe: fa0 internal carry c1 = a0 AND b0.
    setNum(live, "a", 4, 1, 10);
    setNum(live, "b", 4, 1, 10);
    live.sim.setInput(live.elab.inputs.get("cin")![0], LO, 10);
    live.sim.run(10);
    const c1 = live.elab.resolveNet("fa0/c1")![0];
    expect(live.sim.value(c1)).toBe(HI);
  });

  it("flex-width builtins expand to per-bit gates", () => {
    const lib = new PartLibrary();
    const wide: PartDefinition = {
      schemaVersion: 1,
      name: "and8",
      version: "1.0.0",
      interface: {
        pins: [
          { name: "a", dir: "in", width: 8 },
          { name: "b", dir: "in", width: 8 },
          { name: "y", dir: "out", width: 8 },
        ],
      },
      body: {
        kind: "structural",
        nets: [],
        instances: [{ id: "g", part: "builtin:and", connections: { a: "a", b: "b", y: "y" } }],
      },
    };
    const live = instantiate(lib, lib.add(wide));
    const aIn = live.elab.inputs.get("a")!;
    const bIn = live.elab.inputs.get("b")!;
    for (let i = 0; i < 8; i++) {
      live.sim.setInput(aIn[i], (0b10110101 >> i) & 1 ? HI : LO, 5);
      live.sim.setInput(bIn[i], (0b11010110 >> i) & 1 ? HI : LO, 5);
    }
    live.sim.run(5);
    const y = live.elab.outputs.get("y")!;
    const got = y.map((n, i) => (live.sim.value(n) === HI ? 1 << i : 0)).reduce((a, b) => a + b, 0);
    expect(got).toBe(0b10110101 & 0b11010110);
  });
});

describe("behavioral truth tables", () => {
  it("evaluates rows and yields X for missing rows", () => {
    const lib = new PartLibrary();
    const xorTT: PartDefinition = {
      schemaVersion: 1,
      name: "xor-tt",
      version: "1.0.0",
      interface: {
        pins: [
          { name: "a", dir: "in", width: 1 },
          { name: "b", dir: "in", width: 1 },
          { name: "y", dir: "out", width: 1 },
        ],
      },
      body: {
        kind: "behavioral",
        truthTable: {
          inputs: ["a", "b"],
          outputs: ["y"],
          rows: { "00": "0", "01": "1", "10": "1" }, // "11" deliberately missing
        },
      },
    };
    const live = instantiate(lib, lib.add(xorTT));
    const a = live.elab.inputs.get("a")![0];
    const b = live.elab.inputs.get("b")![0];
    const y = live.elab.outputs.get("y")![0];

    live.sim.setInput(a, LO, 10); live.sim.setInput(b, HI, 10);
    live.sim.run(10);
    expect(live.sim.value(y)).toBe(HI);

    live.sim.setInput(a, HI, 20); live.sim.setInput(b, HI, 20);
    live.sim.run(20);
    expect(live.sim.value(y)).toBe(X); // missing row
  });

  it("handles multi-bit pins with MSB-first row encoding", () => {
    const lib = new PartLibrary();
    const decoder: PartDefinition = {
      schemaVersion: 1,
      name: "decode2to4",
      version: "1.0.0",
      interface: {
        pins: [
          { name: "s", dir: "in", width: 2 },
          { name: "y", dir: "out", width: 4 },
        ],
      },
      body: {
        kind: "behavioral",
        truthTable: {
          inputs: ["s"],
          outputs: ["y"],
          rows: { "00": "0001", "01": "0010", "10": "0100", "11": "1000" },
        },
      },
    };
    const live = instantiate(lib, lib.add(decoder));
    const s = live.elab.inputs.get("s")!;
    // s = 2 -> bit1=1, bit0=0 -> row "10" -> y = 0100 -> only y[2] high.
    live.sim.setInput(s[0], LO, 5);
    live.sim.setInput(s[1], HI, 5);
    live.sim.run(5);
    const y = live.elab.outputs.get("y")!;
    expect(y.map((n) => live.sim.value(n))).toEqual([LO, LO, HI, LO]);
  });
});

describe("clocked composites", () => {
  it("2-bit counter with an internal clock counts", () => {
    const lib = new PartLibrary();
    const counter: PartDefinition = {
      schemaVersion: 1,
      name: "counter2",
      version: "1.0.0",
      interface: {
        pins: [
          { name: "q0", dir: "out", width: 1 },
          { name: "q1", dir: "out", width: 1 },
        ],
      },
      body: {
        kind: "structural",
        nets: [
          { name: "clk", width: 1 },
          { name: "d0", width: 1 },
          { name: "d1", width: 1 },
        ],
        instances: [
          { id: "ck", part: "builtin:clock", props: { halfPeriod: 5 }, connections: { y: "clk" } },
          { id: "i0", part: "builtin:not", connections: { a: "q0", y: "d0" } },
          { id: "x1", part: "builtin:xor", connections: { a: "q1", b: "q0", y: "d1" } },
          { id: "f0", part: "builtin:dff", props: { init: 0 }, connections: { d: "d0", clk: "clk", q: "q0" } },
          { id: "f1", part: "builtin:dff", props: { init: 0 }, connections: { d: "d1", clk: "clk", q: "q1" } },
        ],
      },
    };
    const live = instantiate(lib, lib.add(counter));
    const q0 = live.elab.outputs.get("q0")![0];
    const q1 = live.elab.outputs.get("q1")![0];

    live.sim.run(15); // edges at 5, 15 -> count = 2
    expect([live.sim.value(q0), live.sim.value(q1)]).toEqual([LO, HI]);
    live.sim.run(35); // 4 edges -> wraps to 0
    expect([live.sim.value(q0), live.sim.value(q1)]).toEqual([LO, LO]);
    expect(live.sim.diagnostics).toHaveLength(0);
  });
});

describe("re-elaboration with state carry-over", () => {
  function shiftRegDef(withProbe: boolean): PartDefinition {
    const nets = [{ name: "q1", width: 1 }];
    const instances: InstanceSpec[] = [
      { id: "f1", part: "builtin:dff", props: { init: 0 }, connections: { d: "d", clk: "clk", q: "q1" } },
      { id: "f2", part: "builtin:dff", props: { init: 0 }, connections: { d: "q1", clk: "clk", q: "q2" } },
    ];
    if (withProbe) {
      nets.push({ name: "nq1", width: 1 });
      instances.push({ id: "inv", part: "builtin:not", connections: { a: "q1", y: "nq1" } });
    }
    return {
      schemaVersion: 1,
      name: "shift2",
      version: withProbe ? "1.1.0" : "1.0.0",
      interface: {
        pins: [
          { name: "d", dir: "in", width: 1 },
          { name: "clk", dir: "in", width: 1 },
          { name: "q2", dir: "out", width: 1 },
        ],
      },
      body: { kind: "structural", nets, instances },
    };
  }

  it("DFF state and input drives survive a definition edit", () => {
    const lib = new PartLibrary();
    const v1 = lib.add(shiftRegDef(false));
    const live = instantiate(lib, v1);
    const d = live.elab.inputs.get("d")![0];
    const clk = live.elab.inputs.get("clk")![0];

    // Shift a 1 through: two manual clock edges.
    live.sim.setInput(d, HI, 0);
    live.sim.setInput(clk, LO, 0);
    live.sim.setInput(clk, HI, 10);
    live.sim.setInput(clk, LO, 20);
    live.sim.setInput(clk, HI, 30);
    live.sim.run(40);
    expect(live.sim.value(live.elab.resolveNet("q1")![0])).toBe(HI);
    expect(live.sim.value(live.elab.outputs.get("q2")![0])).toBe(HI);

    // Edit the definition (adds an inverter probe; DFF instance ids stable).
    const v2 = lib.add(shiftRegDef(true));
    expect(v2).not.toBe(v1);
    const live2 = reElaborate(lib, v2, live);

    // Carried: both DFFs still hold 1, inputs still driven.
    expect(live2.sim.value(live2.elab.resolveNet("q1")![0])).toBe(HI);
    expect(live2.sim.value(live2.elab.outputs.get("q2")![0])).toBe(HI);
    // New logic settles from the carried state.
    expect(live2.sim.value(live2.elab.resolveNet("nq1")![0])).toBe(LO);
    // No spurious clock edge during the rebuild settle.
    expect(live2.sim.value(live2.elab.resolveNet("q1")![0])).toBe(HI);
  });

  it("fresh state initializes to X when paths do not match", () => {
    const lib = new PartLibrary();
    const v1 = lib.add(shiftRegDef(false));
    const live = instantiate(lib, v1);
    live.sim.setInput(live.elab.inputs.get("d")![0], HI, 0);
    live.sim.setInput(live.elab.inputs.get("clk")![0], LO, 0);
    live.sim.setInput(live.elab.inputs.get("clk")![0], HI, 10);
    live.sim.run(20);

    // Renaming a DFF instance breaks its stable path -> its state resets to
    // the definition default (init 0 here), demonstrating path-keyed carry.
    const renamed = shiftRegDef(false);
    if (renamed.body.kind === "structural") {
      renamed.body.instances[0].id = "renamed";
      renamed.body.instances[0].props = { init: 2 }; // X
    }
    const v2 = lib.add(renamed);
    const live2 = reElaborate(lib, v2, live);
    expect(live2.sim.value(live2.elab.resolveNet("q1")![0])).toBe(X);
  });
});

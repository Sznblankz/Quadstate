import { describe, expect, it } from "vitest";
import { HI, LO } from "@logicsim/engine";
import { PartLibrary, instantiate } from "@logicsim/schema";
import { CircuitDocument, type EntityId } from "../src/model.js";
import { addComponent, addWire } from "../src/commands.js";
import { History } from "../src/undo.js";
import { createChipFromSelection } from "../src/chip.js";
import { exportProject } from "../src/export.js";

/**
 * P10 — CPU-scale validation. Builds half/full/4-bit adders, a register, a
 * counter, and a tri-state ALU using the SAME document/chip/export/elaborate
 * pipeline the editor drives, and checks they actually compute. This proves
 * QuadState handles real CPU-style building (composition, buses, feedback,
 * multi-driver nets), not just tiny demos.
 */

function build(lib = new PartLibrary()) {
  const doc = new CircuitDocument();
  const h = new History();
  const C = (part: string, props: Record<string, number | string> = {}): EntityId => {
    const cmd = addComponent(doc, { part, x: 0, y: 0, rot: 0, props });
    h.execute(doc, cmd);
    return cmd.id;
  };
  const W = (...ports: Array<[EntityId, string]>): void => {
    h.execute(doc, addWire(doc, ports.map(([c, p]) => ({ component: c, pin: p }))));
  };
  const chip = (ids: EntityId[], name: string): string => {
    const r = createChipFromSelection(doc, lib, ids, { name, version: "1.0.0" });
    h.execute(doc, r.command);
    return r.partId;
  };
  return { doc, h, lib, C, W, chip };
}

/** A driveable, steppable instantiation of a document (its io become pins). */
function harness(doc: CircuitDocument, lib: PartLibrary) {
  const { def } = exportProject(doc, lib, { name: "top", version: "1.0.0" });
  const c = instantiate(lib, lib.add(def));
  let t = 0;
  const set = (name: string, value: number, bits = 1) => {
    const ns = c.elab.inputs.get(name);
    if (!ns) throw new Error(`no input "${name}"`);
    for (let i = 0; i < bits; i++) c.sim.setInput(ns[i], ((value >> i) & 1) ? HI : LO, t + 1);
  };
  const apply = () => { t += 1; c.sim.run(t); };
  const get = (name: string, bits = 1): number => {
    const ns = c.elab.outputs.get(name);
    if (!ns) throw new Error(`no output "${name}"`);
    let v = 0;
    for (let i = 0; i < bits; i++) if (c.sim.value(ns[i]) === HI) v |= 1 << i;
    return v;
  };
  const setN = (names: string[], value: number) => names.forEach((n, i) => set(n, (value >> i) & 1));
  const getN = (names: string[]): number => names.reduce((v, n, i) => v | (get(n) << i), 0);
  return { set, apply, get, setN, getN };
}

/** Identify a chip's output pins by their behaviour (auto-named in1/out1...). */
function outBySignature(lib: PartLibrary, part: string, drive: number[]): Record<string, number> {
  const pins = lib.resolveInterface(part)!.pins;
  const ins = pins.filter((p) => p.dir === "in").map((p) => p.name);
  const outs = pins.filter((p) => p.dir === "out").map((p) => p.name);
  const c = instantiate(lib, part);
  ins.forEach((n, i) => c.sim.setInput(c.elab.inputs.get(n)![0], drive[i] ? HI : LO, 1));
  c.sim.run(1);
  const result: Record<string, number> = {};
  for (const o of outs) result[o] = c.sim.value(c.elab.outputs.get(o)![0]) === HI ? 1 : 0;
  return result;
}

describe("CPU-scale validation (P10)", () => {
  it("half adder: sum = a^b, carry = a&b", () => {
    const { doc, lib, C, W } = build();
    const a = C("io:in", { name: "a" }), b = C("io:in", { name: "b" });
    const x = C("builtin:xor"), an = C("builtin:and");
    const s = C("io:out", { name: "s" }), co = C("io:out", { name: "co" });
    W([a, "pin"], [x, "a"]); W([a, "pin"], [an, "a"]);
    W([b, "pin"], [x, "b"]); W([b, "pin"], [an, "b"]);
    W([x, "y"], [s, "pin"]); W([an, "y"], [co, "pin"]);

    const H = harness(doc, lib);
    for (let a0 = 0; a0 < 2; a0++) for (let b0 = 0; b0 < 2; b0++) {
      H.set("a", a0); H.set("b", b0); H.apply();
      expect(H.get("s"), `s(${a0},${b0})`).toBe(a0 ^ b0);
      expect(H.get("co"), `co(${a0},${b0})`).toBe(a0 & b0);
    }
  });

  it("half adder chip composes a working full adder", () => {
    // Build + chip a half adder, then build a full adder from TWO instances.
    const ha = build();
    const x = ha.C("builtin:xor"), an = ha.C("builtin:and");
    const a = ha.C("io:in", { name: "a" }), b = ha.C("io:in", { name: "b" });
    const s = ha.C("io:out", { name: "s" }), co = ha.C("io:out", { name: "co" });
    ha.W([a, "pin"], [x, "a"]); ha.W([a, "pin"], [an, "a"]);
    ha.W([b, "pin"], [x, "b"]); ha.W([b, "pin"], [an, "b"]);
    ha.W([x, "y"], [s, "pin"]); ha.W([an, "y"], [co, "pin"]);
    const haPart = ha.chip([x, an], "HalfAdder");
    const lib = ha.lib;

    // Discover which output is sum vs carry: (1,1) -> sum 0, carry 1.
    const sig = outBySignature(lib, haPart, [1, 1]);
    const outs = Object.keys(sig);
    const sum = outs.find((o) => sig[o] === 0)!;
    const carry = outs.find((o) => sig[o] === 1)!;
    const ins = lib.resolveInterface(haPart)!.pins.filter((p) => p.dir === "in").map((p) => p.name);

    const fa = build(lib);
    const ia = fa.C("io:in", { name: "a" }), ib = fa.C("io:in", { name: "b" }), ic = fa.C("io:in", { name: "cin" });
    const ha1 = fa.C(haPart), ha2 = fa.C(haPart), orc = fa.C("builtin:or");
    const os = fa.C("io:out", { name: "s" }), oc = fa.C("io:out", { name: "cout" });
    fa.W([ia, "pin"], [ha1, ins[0]]); fa.W([ib, "pin"], [ha1, ins[1]]);
    fa.W([ha1, sum], [ha2, ins[0]]); fa.W([ic, "pin"], [ha2, ins[1]]);
    fa.W([ha2, sum], [os, "pin"]);
    fa.W([ha1, carry], [orc, "a"]); fa.W([ha2, carry], [orc, "b"]); fa.W([orc, "y"], [oc, "pin"]);

    const H = harness(fa.doc, lib);
    for (let v = 0; v < 8; v++) {
      const [a0, b0, c0] = [v & 1, (v >> 1) & 1, (v >> 2) & 1];
      H.set("a", a0); H.set("b", b0); H.set("cin", c0); H.apply();
      const total = a0 + b0 + c0;
      expect(H.get("s"), `s(${a0},${b0},${c0})`).toBe(total & 1);
      expect(H.get("cout"), `cout(${a0},${b0},${c0})`).toBe(total >> 1);
    }
  });

  it("4-bit ripple-carry adder from chained full-adder chips", () => {
    // Full adder chip (gate-level), then four of them carry-chained.
    const faB = build();
    const a = faB.C("io:in", { name: "a" }), b = faB.C("io:in", { name: "b" }), cin = faB.C("io:in", { name: "cin" });
    const x1 = faB.C("builtin:xor"), x2 = faB.C("builtin:xor");
    const a1 = faB.C("builtin:and"), a2 = faB.C("builtin:and"), orc = faB.C("builtin:or");
    const s = faB.C("io:out", { name: "s" }), co = faB.C("io:out", { name: "co" });
    // sum = a^b^cin
    faB.W([a, "pin"], [x1, "a"]); faB.W([b, "pin"], [x1, "b"]);
    faB.W([x1, "y"], [x2, "a"]); faB.W([cin, "pin"], [x2, "b"]); faB.W([x2, "y"], [s, "pin"]);
    // cout = (a&b) | ((a^b)&cin)
    faB.W([a, "pin"], [a1, "a"]); faB.W([b, "pin"], [a1, "b"]);
    faB.W([x1, "y"], [a2, "a"]); faB.W([cin, "pin"], [a2, "b"]);
    faB.W([a1, "y"], [orc, "a"]); faB.W([a2, "y"], [orc, "b"]); faB.W([orc, "y"], [co, "pin"]);
    const faPart = faB.chip([x1, x2, a1, a2, orc], "FullAdder");
    const lib = faB.lib;

    const sig = outBySignature(lib, faPart, [1, 0, 0]); // sum(1,0,0)=1, cout=0
    const outs = Object.keys(sig);
    const sum = outs.find((o) => sig[o] === 1)!;
    const cout = outs.find((o) => sig[o] === 0)!;
    const ins = lib.resolveInterface(faPart)!.pins.filter((p) => p.dir === "in").map((p) => p.name);

    const adder = build(lib);
    const aBits: number[] = [], bBits: number[] = [], sBits: number[] = [], fas: number[] = [];
    for (let i = 0; i < 4; i++) {
      aBits.push(adder.C("io:in", { name: `a${i}` }));
      bBits.push(adder.C("io:in", { name: `b${i}` }));
      sBits.push(adder.C("io:out", { name: `s${i}` }));
      fas.push(adder.C(faPart));
    }
    const cinPin = adder.C("io:in", { name: "cin" });
    const coutPin = adder.C("io:out", { name: "cout" });
    for (let i = 0; i < 4; i++) {
      adder.W([aBits[i], "pin"], [fas[i], ins[0]]);
      adder.W([bBits[i], "pin"], [fas[i], ins[1]]);
      const carryIn = i === 0 ? cinPin : fas[i - 1];
      adder.W(i === 0 ? [carryIn, "pin"] : [carryIn, cout], [fas[i], ins[2]]);
      adder.W([fas[i], sum], [sBits[i], "pin"]);
    }
    adder.W([fas[3], cout], [coutPin, "pin"]);

    const H = harness(adder.doc, lib);
    const aN = ["a0", "a1", "a2", "a3"], bN = ["b0", "b1", "b2", "b3"], sN = ["s0", "s1", "s2", "s3"];
    for (const [av, bv] of [[5, 6], [15, 1], [9, 7], [0, 0], [15, 15], [10, 5]]) {
      H.setN(aN, av); H.setN(bN, bv); H.set("cin", 0); H.apply();
      const total = av + bv;
      expect(H.getN(sN), `${av}+${bv} sum`).toBe(total & 0xF);
      expect(H.get("cout"), `${av}+${bv} carry`).toBe(total >> 4);
    }
  });

  it("4-bit register loads on a clock edge and holds", () => {
    const { doc, lib, C, W } = build();
    const d = C("io:in", { name: "d", width: 4 }), clk = C("io:in", { name: "clk" });
    const q = C("io:out", { name: "q", width: 4 });
    const dff = C("builtin:dff", { init: 0 });
    W([d, "pin"], [dff, "d"]); W([clk, "pin"], [dff, "clk"]); W([dff, "q"], [q, "pin"]);

    const H = harness(doc, lib);
    H.set("clk", 0); H.set("d", 0b1010, 4); H.apply();
    H.set("clk", 1); H.apply();                      // rising edge -> latch 1010
    expect(H.get("q", 4)).toBe(0b1010);
    H.set("d", 0b0101, 4); H.apply();                // change d, clk still high
    expect(H.get("q", 4), "holds without an edge").toBe(0b1010);
    H.set("clk", 0); H.apply(); H.set("clk", 1); H.apply(); // next edge
    expect(H.get("q", 4)).toBe(0b0101);
  });

  it("4-bit binary counter increments on each clock (feedback)", () => {
    const { doc, lib, C, W } = build();
    const clk = C("io:in", { name: "clk" });
    const q: number[] = [], dff: number[] = [];
    for (let i = 0; i < 4; i++) {
      dff.push(C("builtin:dff", { init: 0 }));
      q.push(C("io:out", { name: `q${i}` }));
    }
    for (let i = 0; i < 4; i++) {
      W([dff[i], "q"], [q[i], "pin"]);
      W([clk, "pin"], [dff[i], "clk"]); // one shared clock
    }
    // Increment: d0 = !q0; d_i = q_i XOR carry_i, where carry_i = AND of q0..q(i-1).
    const not0 = C("builtin:not");
    W([dff[0], "q"], [not0, "a"]); W([not0, "y"], [dff[0], "d"]);
    let carry: [number, string] = [dff[0], "q"]; // carry into bit 1 = q0
    for (let i = 1; i < 4; i++) {
      const xor = C("builtin:xor");
      W([dff[i], "q"], [xor, "a"]); W(carry, [xor, "b"]); W([xor, "y"], [dff[i], "d"]);
      if (i < 3) {
        const and = C("builtin:and");
        W([dff[i], "q"], [and, "a"]); W(carry, [and, "b"]);
        carry = [and, "y"]; // carry into bit i+1 = (carry_i AND q_i)
      }
    }

    const H = harness(doc, lib);
    H.set("clk", 0); H.apply();
    const qN = ["q0", "q1", "q2", "q3"];
    expect(H.getN(qN), "starts at 0").toBe(0);
    const pulse = () => { H.set("clk", 1); H.apply(); H.set("clk", 0); H.apply(); };
    for (let n = 1; n <= 18; n++) {
      pulse();
      expect(H.getN(qN), `after ${n} pulses`).toBe(n & 0xF); // wraps 15 -> 0
    }
  });

  it("tri-state ALU selects AND vs OR onto a shared result net", () => {
    const { doc, lib, C, W } = build();
    const a = C("io:in", { name: "a" }), b = C("io:in", { name: "b" }), sel = C("io:in", { name: "sel" });
    const andg = C("builtin:and"), org = C("builtin:or"), nsel = C("builtin:not");
    const t1 = C("builtin:tri"), t2 = C("builtin:tri");
    const res = C("io:out", { name: "res" });
    W([a, "pin"], [andg, "a"]); W([b, "pin"], [andg, "b"]);
    W([a, "pin"], [org, "a"]); W([b, "pin"], [org, "b"]);
    W([sel, "pin"], [nsel, "a"]);
    W([andg, "y"], [t1, "d"]); W([nsel, "y"], [t1, "en"]);  // AND drives when sel=0
    W([org, "y"], [t2, "d"]); W([sel, "pin"], [t2, "en"]);  // OR drives when sel=1
    W([t1, "y"], [res, "pin"]); W([t2, "y"], [res, "pin"]); // shared multi-driver net

    const H = harness(doc, lib);
    for (let s0 = 0; s0 < 2; s0++) for (let a0 = 0; a0 < 2; a0++) for (let b0 = 0; b0 < 2; b0++) {
      H.set("sel", s0); H.set("a", a0); H.set("b", b0); H.apply();
      const expected = s0 === 0 ? (a0 & b0) : (a0 | b0);
      expect(H.get("res"), `sel=${s0} a=${a0} b=${b0}`).toBe(expected);
    }
  });
});

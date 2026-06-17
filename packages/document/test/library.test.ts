import { describe, expect, it } from "vitest";
import { HI, LO } from "@logicsim/engine";
import { PartLibrary, instantiate } from "@logicsim/schema";
import { registerStandardLibrary, type LibraryPart } from "../src/library.js";

/**
 * P11 standard-library verification: every part registers, elaborates, and
 * computes correctly in the simulator (the "works with the simulator" bar).
 */

function lib() {
  const l = new PartLibrary();
  const parts = registerStandardLibrary(l);
  const byName = (n: string): LibraryPart => parts.find((p) => p.name === n)!;
  return { l, byName };
}

/** Drive a registered part directly (its pins become inputs/outputs). */
function driver(l: PartLibrary, partId: string) {
  const c = instantiate(l, partId);
  let t = 0;
  const set = (name: string, v: number) => {
    const ns = c.elab.inputs.get(name);
    if (!ns) throw new Error(`no input "${name}"`);
    c.sim.setInput(ns[0], v ? HI : LO, t + 1);
  };
  const step = () => { t += 1; c.sim.run(t); };
  const get = (name: string): number => c.sim.value(c.elab.outputs.get(name)![0]);
  const pulse = () => { set("clk", 0); step(); set("clk", 1); step(); set("clk", 0); step(); };
  return { set, step, get, pulse };
}

describe("standard library (P11)", () => {
  it("registers all parts with stable ids", () => {
    const { l } = lib();
    const parts = registerStandardLibrary(l); // re-register: content-addressed, no dupes
    expect(parts.map((p) => p.name)).toEqual([
      "SR Latch", "D Latch", "JK Flip-Flop", "T Flip-Flop", "2→4 Decoder",
      "4→2 Encoder", "4-bit Counter", "Register (4-bit)", "Half Adder",
      "Full Adder", "7-Seg Decoder",
    ]);
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
  });

  it("T flip-flop toggles each edge while T=1 and holds while T=0", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("T Flip-Flop").id);
    expect(d.get("Q")).toBe(LO); // init 0
    d.set("T", 1); d.pulse(); expect(d.get("Q"), "toggle 1").toBe(HI);
    d.pulse(); expect(d.get("Q"), "toggle 2").toBe(LO);
    d.set("T", 0); d.pulse(); expect(d.get("Q"), "hold while T=0").toBe(LO);
    d.set("T", 1); d.pulse(); expect(d.get("Q"), "toggle again").toBe(HI);
    expect(d.get("Qn")).toBe(LO);
  });

  it("half adder sums two bits", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("Half Adder").id);
    const run = (a: number, b: number) => {
      d.set("a", a); d.set("b", b); d.step();
      return [d.get("sum") === HI ? 1 : 0, d.get("carry") === HI ? 1 : 0];
    };
    expect(run(0, 0)).toEqual([0, 0]);
    expect(run(1, 0)).toEqual([1, 0]);
    expect(run(0, 1)).toEqual([1, 0]);
    expect(run(1, 1)).toEqual([0, 1]);
  });

  it("full adder sums three bits into sum + carry", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("Full Adder").id);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let cin = 0; cin < 2; cin++) {
      d.set("a", a); d.set("b", b); d.set("cin", cin); d.step();
      const got = (d.get("cout") === HI ? 2 : 0) + (d.get("sum") === HI ? 1 : 0);
      expect(got, `${a}+${b}+${cin}`).toBe(a + b + cin);
    }
  });

  it("4-bit register latches the data bus on the clock edge and holds between", () => {
    const { l, byName } = lib();
    const c = instantiate(l, byName("Register (4-bit)").id);
    let t = 0;
    const step = () => { t += 1; c.sim.run(t); };
    const setBus = (val: number) => {
      const ns = c.elab.inputs.get("d")!;
      ns.forEach((n, i) => c.sim.setInput(n, ((val >> i) & 1) ? HI : LO, t + 1));
    };
    const clk = (v: number) => c.sim.setInput(c.elab.inputs.get("clk")![0], v ? HI : LO, t + 1);
    const q = () => c.elab.outputs.get("q")!.reduce((acc, n, i) => acc | ((c.sim.value(n) === HI ? 1 : 0) << i), 0);

    setBus(0b1010); clk(0); step();
    clk(1); step(); clk(0); step();            // rising edge latches 0b1010
    expect(q()).toBe(0b1010);
    setBus(0b0101); step();
    expect(q(), "holds until the next edge").toBe(0b1010);
    clk(1); step(); clk(0); step();
    expect(q()).toBe(0b0101);
  });

  it("SR latch sets, resets, and holds", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("SR Latch").id);
    d.set("S", 1); d.set("R", 0); d.step(); expect(d.get("Q")).toBe(HI);
    d.set("S", 0); d.step(); expect(d.get("Q"), "hold after set").toBe(HI);
    d.set("R", 1); d.step(); expect(d.get("Q")).toBe(LO); expect(d.get("Qn")).toBe(HI);
    d.set("R", 0); d.step(); expect(d.get("Q"), "hold after reset").toBe(LO);
  });

  it("D latch is transparent when enabled and holds when disabled", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("D Latch").id);
    d.set("E", 1); d.set("D", 1); d.step(); expect(d.get("Q")).toBe(HI);
    d.set("D", 0); d.step(); expect(d.get("Q")).toBe(LO);
    d.set("E", 0); d.set("D", 1); d.step(); expect(d.get("Q"), "holds while disabled").toBe(LO);
    d.set("E", 1); d.step(); expect(d.get("Q"), "transparent again").toBe(HI);
  });

  it("JK flip-flop sets, resets, holds, and toggles", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("JK Flip-Flop").id);
    expect(d.get("Q")).toBe(LO); // init 0
    d.set("J", 1); d.set("K", 0); d.pulse(); expect(d.get("Q"), "set").toBe(HI);
    d.set("J", 0); d.set("K", 0); d.pulse(); expect(d.get("Q"), "hold").toBe(HI);
    d.set("J", 0); d.set("K", 1); d.pulse(); expect(d.get("Q"), "reset").toBe(LO);
    d.set("J", 1); d.set("K", 1); d.pulse(); expect(d.get("Q"), "toggle 1").toBe(HI);
    d.pulse(); expect(d.get("Q"), "toggle 2").toBe(LO);
  });

  it("2→4 decoder is one-hot", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("2→4 Decoder").id);
    for (let v = 0; v < 4; v++) {
      d.set("a0", v & 1); d.set("a1", (v >> 1) & 1); d.step();
      for (let k = 0; k < 4; k++) {
        expect(d.get(`y${k}`), `y${k} for addr ${v}`).toBe(k === v ? HI : LO);
      }
    }
  });

  it("4→2 encoder produces the binary code", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("4→2 Encoder").id);
    const cases: Array<[string, number]> = [["i0", 0], ["i1", 1], ["i2", 2], ["i3", 3]];
    for (const [line, code] of cases) {
      for (const n of ["i0", "i1", "i2", "i3"]) d.set(n, n === line ? 1 : 0);
      d.step();
      expect((d.get("a1") === HI ? 2 : 0) + (d.get("a0") === HI ? 1 : 0), `code for ${line}`).toBe(code);
    }
  });

  it("4-bit counter increments and wraps", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("4-bit Counter").id);
    const q = () => ["q0", "q1", "q2", "q3"].reduce((v, n, i) => v | ((d.get(n) === HI ? 1 : 0) << i), 0);
    expect(q()).toBe(0);
    for (let n = 1; n <= 17; n++) { d.pulse(); expect(q(), `after ${n}`).toBe(n & 0xF); }
  });

  it("7-segment decoder maps digits to segments", () => {
    const { l, byName } = lib();
    const d = driver(l, byName("7-Seg Decoder").id);
    const seg = (digit: number): string => {
      for (let b = 0; b < 4; b++) d.set(`x${b}`, (digit >> b) & 1);
      d.step();
      return ["a", "b", "c", "d", "e", "f", "g"].map((s) => (d.get(s) === HI ? "1" : "0")).join("");
    };
    expect(seg(0)).toBe("1111110");
    expect(seg(1)).toBe("0110000");
    expect(seg(8)).toBe("1111111");
    expect(seg(0xF)).toBe("1000111");
  });
});

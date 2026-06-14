import { describe, expect, it } from "vitest";
import { NetlistBuilder, NK_NOR, NK_AND, NK_XOR, NK_NAND } from "../src/netlist.js";
import { Simulator } from "../src/simulator.js";
import { LO, HI, X, Z } from "../src/values.js";

describe("RS latch (cross-coupled NORs, zero delay)", () => {
  function latch() {
    const b = new NetlistBuilder();
    const s = b.net(), r = b.net(), q = b.net(), qb = b.net();
    const sIn = b.input(s);
    const rIn = b.input(r);
    b.gate(NK_NOR, [r, qb], q);
    b.gate(NK_NOR, [s, q], qb);
    return { sim: new Simulator(b.build()), sIn, rIn, q, qb };
  }

  it("set, hold, reset", () => {
    const { sim, sIn, rIn, q, qb } = latch();
    sim.setInput(sIn, HI, 0);
    sim.setInput(rIn, LO, 0);
    sim.run(10);
    expect(sim.value(q)).toBe(HI);
    expect(sim.value(qb)).toBe(LO);

    sim.setInput(sIn, LO, 20); // release set -> hold
    sim.run(30);
    expect(sim.value(q)).toBe(HI);

    sim.setInput(rIn, HI, 40); // reset
    sim.run(50);
    expect(sim.value(q)).toBe(LO);
    expect(sim.value(qb)).toBe(HI);
    expect(sim.diagnostics).toHaveLength(0);
  });

  it("forbidden state, then simultaneous release oscillates into X", () => {
    const { sim, sIn, rIn, q, qb } = latch();
    sim.setInput(sIn, HI, 0);
    sim.setInput(rIn, HI, 0);
    sim.run(10);
    expect(sim.value(q)).toBe(LO);
    expect(sim.value(qb)).toBe(LO);

    // Both released in the same tick: with equal (zero) delays the latch is
    // metastable. The engine must not hang — delta cap fires, nets go X.
    sim.setInput(sIn, LO, 20);
    sim.setInput(rIn, LO, 20);
    sim.run(30);
    expect(sim.diagnostics.length).toBeGreaterThan(0);
    expect(sim.diagnostics[0].time).toBe(20);
    expect(sim.value(q)).toBe(X);
    expect(sim.value(qb)).toBe(X);

    // The latch recovers from X once an input asserts again.
    sim.setInput(sIn, HI, 40);
    sim.run(50);
    expect(sim.value(q)).toBe(HI);
    expect(sim.value(qb)).toBe(LO);
  });
});

describe("D flip-flop primitive", () => {
  it("samples D on rising edges only", () => {
    const b = new NetlistBuilder();
    const d = b.net(), clk = b.net(), q = b.net();
    const dIn = b.input(d);
    b.clock(clk, 5); // rises at 5, 15, 25, ...
    b.dff(d, clk, q, 0, LO);
    const sim = new Simulator(b.build());

    sim.setInput(dIn, LO, 0); // drive D before the first edge (else Q captures X)
    sim.run(4);
    expect(sim.value(q)).toBe(LO);

    sim.setInput(dIn, HI, 7); // changes between edges — no effect until t=15
    sim.run(14);
    expect(sim.value(q)).toBe(LO);
    sim.run(15);
    expect(sim.value(q)).toBe(HI);

    sim.setInput(dIn, LO, 16);
    sim.run(24);
    expect(sim.value(q)).toBe(HI); // still holding
    sim.run(25);
    expect(sim.value(q)).toBe(LO);
  });

  it("no shoot-through in a shift register (two-phase delta semantics)", () => {
    const b = new NetlistBuilder();
    const d = b.net(), clk = b.net(), q1 = b.net(), q2 = b.net();
    const dIn = b.input(d);
    b.clock(clk, 5);
    b.dff(d, clk, q1, 0, LO);
    b.dff(q1, clk, q2, 0, LO);
    const sim = new Simulator(b.build());

    sim.setInput(dIn, HI, 2);
    sim.run(5); // first edge (t=5): q1 captures 1, q2 captures OLD q1 (0)
    expect(sim.value(q1)).toBe(HI);
    expect(sim.value(q2)).toBe(LO);
    sim.run(15); // second edge: the 1 shifts into q2
    expect(sim.value(q2)).toBe(HI);
  });
});

describe("primeDff (re-elaboration carry-over hook)", () => {
  it("overrides the built-in init deterministically, only before run()", () => {
    const b = new NetlistBuilder();
    const d = b.net(), clk = b.net(), q = b.net();
    b.input(d);
    b.input(clk);
    const dff = b.dff(d, clk, q, 0, LO);
    const sim = new Simulator(b.build());

    sim.primeDff(dff, HI); // carried state beats init LO
    sim.run(0);
    expect(sim.value(q)).toBe(HI);
    expect(() => sim.primeDff(dff, LO)).toThrow(/before the first run/);
  });
});

describe("ring oscillator", () => {
  function ring(delay: number) {
    const b = new NetlistBuilder();
    const en = b.net(), n1 = b.net(), n2 = b.net(), n3 = b.net();
    const enIn = b.input(en);
    b.gate(NK_NAND, [en, n3], n1, delay);
    b.not(n1, n2, delay);
    b.not(n2, n3, delay);
    return { sim: new Simulator(b.build()), enIn, n1 };
  }

  it("zero-delay ring hits the delta cap and resolves to X", () => {
    const { sim, enIn, n1 } = ring(0);
    sim.setInput(enIn, LO, 0);
    sim.run(5);
    expect(sim.value(n1)).toBe(HI); // disabled: stable
    expect(sim.diagnostics).toHaveLength(0);

    sim.setInput(enIn, HI, 10); // enabled: oscillates within one tick
    sim.run(20);
    expect(sim.diagnostics.length).toBeGreaterThan(0);
    expect(sim.diagnostics[0].time).toBe(10);
    expect(sim.value(n1)).toBe(X);
  });

  it("unit-delay ring oscillates in real time without diagnostics", () => {
    const { sim, enIn, n1 } = ring(1);
    sim.setInput(enIn, LO, 0); // settle to defined values first; NAND(1, X)=X
    sim.setInput(enIn, HI, 10);
    sim.run(100);
    const a = sim.value(n1);
    sim.run(103); // loop of three unit delays -> period 6, so +3 flips it
    const c = sim.value(n1);
    expect(sim.diagnostics).toHaveLength(0);
    expect([LO, HI]).toContain(a);
    expect(c).toBe(a === LO ? HI : LO);
  });
});

describe("tri-state bus", () => {
  function bus() {
    const b = new NetlistBuilder();
    const d1 = b.net(), e1 = b.net(), d2 = b.net(), e2 = b.net(), shared = b.net();
    const ins = {
      d1: b.input(d1), e1: b.input(e1),
      d2: b.input(d2), e2: b.input(e2),
    };
    b.tri(d1, e1, shared);
    b.tri(d2, e2, shared);
    return { sim: new Simulator(b.build()), ins, shared };
  }

  it("floats, drives, agrees, and conflicts correctly", () => {
    const { sim, ins, shared } = bus();
    sim.setInput(ins.e1, LO, 0);
    sim.setInput(ins.e2, LO, 0);
    sim.setInput(ins.d1, HI, 0);
    sim.setInput(ins.d2, LO, 0);
    sim.run(1);
    expect(sim.value(shared)).toBe(Z); // nobody driving

    sim.setInput(ins.e1, HI, 10);
    sim.run(11);
    expect(sim.value(shared)).toBe(HI); // single driver

    sim.setInput(ins.e2, HI, 20);
    sim.run(21);
    expect(sim.value(shared)).toBe(X); // contention: 1 vs 0

    sim.setInput(ins.d2, HI, 30);
    sim.run(31);
    expect(sim.value(shared)).toBe(HI); // agreement

    sim.setInput(ins.e1, X, 40);
    sim.run(41);
    expect(sim.value(shared)).toBe(X); // unknown enable -> unknown drive
  });
});

describe("4-bit synchronous counter", () => {
  function counter() {
    const b = new NetlistBuilder();
    const clk = b.net();
    b.clock(clk, 5); // rising edges at 5, 15, 25, ...
    const q = b.bus(4);
    const d = b.bus(4);
    const c01 = b.net(), c012 = b.net();
    b.not(q[0], d[0]);
    b.gate(NK_XOR, [q[1], q[0]], d[1]);
    b.gate(NK_AND, [q[0], q[1]], c01);
    b.gate(NK_XOR, [q[2], c01], d[2]);
    b.gate(NK_AND, [q[0], q[1], q[2]], c012);
    b.gate(NK_XOR, [q[3], c012], d[3]);
    for (let i = 0; i < 4; i++) b.dff(d[i], clk, q[i], 0, LO);
    return { sim: new Simulator(b.build()), q };
  }

  function count(sim: Simulator, q: number[]): number {
    let v = 0;
    for (let i = 3; i >= 0; i--) {
      const bit = sim.value(q[i]);
      expect([LO, HI]).toContain(bit);
      v = (v << 1) | bit;
    }
    return v;
  }

  it("counts modulo 16 across many edges", () => {
    const { sim, q } = counter();
    sim.run(0);
    expect(count(sim, q)).toBe(0);
    sim.run(5); // edge 1
    expect(count(sim, q)).toBe(1);
    sim.run(65); // edges at 5..65 -> 7 edges
    expect(count(sim, q)).toBe(7);
    sim.run(155); // 16 edges -> wraps to 0
    expect(count(sim, q)).toBe(0);
    sim.run(195); // 20 edges -> 4
    expect(count(sim, q)).toBe(4);
    expect(sim.diagnostics).toHaveLength(0);
  });
});

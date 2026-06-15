import { describe, expect, it } from "vitest";
import { ScopeRecorder, advanceAndSample, type Transition } from "../src/scope.js";
import { NetlistBuilder } from "../src/netlist.js";
import { Simulator } from "../src/simulator.js";
import { LO, HI } from "../src/values.js";

const MAX = 4096;

/** A netlist whose single net is driven by a clock toggling every halfPeriod. */
function clockNet(halfPeriod = 5) {
  const b = new NetlistBuilder();
  const net = b.net();
  b.clock(net, halfPeriod);
  return { nl: b.build(), net };
}

/** Tick-by-tick reference: the exact transitions a settled observer would see. */
function reference(nl: ReturnType<typeof clockNet>["nl"], net: number, upTo: number): Transition[] {
  const sim = new Simulator(nl);
  sim.run(0);
  const out: Transition[] = [];
  let last: number | undefined;
  for (let t = 0; t <= upTo; t++) {
    sim.run(t);
    const v = sim.value(net);
    if (v !== last) { out.push({ tick: t, value: v }); last = v; }
  }
  return out;
}

describe("ScopeRecorder — transition capture", () => {
  it("captures transitions for a subscribed net", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 0, LO);
    rec.sample(1, 5, HI);
    rec.sample(1, 10, LO);
    expect(rec.history(1)).toEqual([
      { tick: 0, value: LO },
      { tick: 5, value: HI },
      { tick: 10, value: LO },
    ]);
  });

  it("records nothing for unsubscribed nets", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 0, LO);
    // sampleAll only touches subscribed nets, even though the reader covers net 2
    rec.sampleAll(5, (n) => (n === 1 ? HI : HI));
    expect(rec.size).toBe(1);
    expect(rec.has(2)).toBe(false);
    expect(rec.history(2)).toEqual([]);
    expect(rec.history(1)).toEqual([{ tick: 0, value: LO }, { tick: 5, value: HI }]);
  });

  it("is transitions-only (skips unchanged values)", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 0, LO);
    rec.sample(1, 1, LO); // unchanged -> ignored
    rec.sample(1, 2, LO); // unchanged -> ignored
    rec.sample(1, 3, HI); // change
    expect(rec.history(1)).toEqual([{ tick: 0, value: LO }, { tick: 3, value: HI }]);
  });
});

describe("ScopeRecorder — same-tick coalescing", () => {
  it("overwrites in place when two samples land on the same tick", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1);
    rec.sample(1, 5, LO);
    rec.sample(1, 5, HI); // same tick -> overwrite, not a second entry
    expect(rec.history(1)).toEqual([{ tick: 5, value: HI }]);
    rec.sample(1, 5, HI); // unchanged -> ignored
    expect(rec.history(1)).toEqual([{ tick: 5, value: HI }]);
    rec.sample(1, 6, LO);
    expect(rec.history(1)).toEqual([{ tick: 5, value: HI }, { tick: 6, value: LO }]);
  });

  it("coalesces a same-tick poke against the seed", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 0, LO); // seed at tick 0
    rec.sample(1, 0, HI);     // poke flips at the same tick
    expect(rec.history(1)).toEqual([{ tick: 0, value: HI }]);
  });

  it("re-ships a same-tick correction made after a drain", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 5, LO);
    expect(rec.drain().deltas).toEqual([{ net: 1, transitions: [{ tick: 5, value: LO }] }]);
    rec.sample(1, 5, HI); // correct after the tick was shipped
    expect(rec.drain().deltas).toEqual([{ net: 1, transitions: [{ tick: 5, value: HI }] }]);
  });
});

describe("ScopeRecorder — drain", () => {
  it("ships only newly appended transitions", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 0, LO);
    expect(rec.drain()).toEqual({ deltas: [{ net: 1, transitions: [{ tick: 0, value: LO }] }], reset: false });
    expect(rec.drain()).toEqual({ deltas: [], reset: false });
    rec.sample(1, 4, HI);
    expect(rec.drain()).toEqual({ deltas: [{ net: 1, transitions: [{ tick: 4, value: HI }] }], reset: false });
  });
});

describe("ScopeRecorder — reset", () => {
  it("clears all series and arms the reset flag once", () => {
    const rec = new ScopeRecorder();
    rec.subscribe(1, 0, LO);
    rec.sample(1, 5, HI);
    rec.reset();
    expect(rec.size).toBe(0);
    expect(rec.history(1)).toEqual([]);
    const first = rec.drain();
    expect(first.reset).toBe(true);
    expect(first.deltas).toEqual([]);
    expect(rec.drain().reset).toBe(false); // flag clears after one drain
  });
});

describe("ScopeRecorder — ring cap", () => {
  it("evicts the oldest transitions past the cap", () => {
    const rec = new ScopeRecorder(3);
    rec.subscribe(1);
    rec.sample(1, 1, HI);
    rec.sample(1, 2, LO);
    rec.sample(1, 3, HI);
    rec.sample(1, 4, LO);
    rec.sample(1, 5, HI);
    expect(rec.history(1)).toEqual([
      { tick: 3, value: HI },
      { tick: 4, value: LO },
      { tick: 5, value: HI },
    ]);
  });
});

describe("advanceAndSample — settled-tick capture (real Simulator)", () => {
  it("captures exactly the transitions a tick-by-tick reference sees", () => {
    const { nl, net } = clockNet(5);
    const sim = new Simulator(nl);
    sim.run(0);
    const rec = new ScopeRecorder();
    rec.subscribe(net, sim.time, sim.value(net));
    advanceAndSample(sim, 12, rec, MAX);
    expect(sim.time).toBe(12);
    expect(rec.history(net)).toEqual(reference(nl, net, 12));
  });

  it("stepping in chunks equals one advance (pause/step determinism)", () => {
    const { nl, net } = clockNet(5);
    // whole-run reference
    const simA = new Simulator(nl); simA.run(0);
    const recA = new ScopeRecorder(); recA.subscribe(net, simA.time, simA.value(net));
    advanceAndSample(simA, 12, recA, MAX);
    // chunked (paused step) path
    const simB = new Simulator(nl); simB.run(0);
    const recB = new ScopeRecorder(); recB.subscribe(net, simB.time, simB.value(net));
    advanceAndSample(simB, 3, recB, MAX);
    advanceAndSample(simB, 7, recB, MAX);
    advanceAndSample(simB, 12, recB, MAX);
    expect(recB.history(net)).toEqual(recA.history(net));
  });

  it("catch-up cap collapses a huge jump to a single sample at target", () => {
    const { nl, net } = clockNet(5);
    const sim = new Simulator(nl); sim.run(0);
    const rec = new ScopeRecorder();
    rec.subscribe(net, sim.time, sim.value(net)); // seed { 0, LO }
    advanceAndSample(sim, 7, rec, 2); // jump 0->7 exceeds maxCatchup=2
    const hist = rec.history(net);
    const ref = reference(nl, net, 7);
    expect(sim.time).toBe(7);
    // the real toggle happens before tick 7; the coarse path only samples at 7
    expect(ref[ref.length - 1].tick).toBeLessThan(7);
    expect(hist[hist.length - 1].tick).toBe(7);
    expect(hist[hist.length - 1].value).toBe(sim.value(net));
  });

  it("does not perturb the engine when nothing is subscribed", () => {
    const { nl, net } = clockNet(5);
    const sim = new Simulator(nl); sim.run(0);
    const rec = new ScopeRecorder(); // empty
    advanceAndSample(sim, 12, rec, MAX);
    expect(sim.time).toBe(12);
    expect(rec.size).toBe(0);
    expect(sim.value(net)).toBe(reference(nl, net, 12).at(-1)!.value);
  });
});

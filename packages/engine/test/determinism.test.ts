import { describe, expect, it } from "vitest";
import { NetlistBuilder, NK_AND, NK_XOR, NK_OR } from "../src/netlist.js";
import { Simulator } from "../src/simulator.js";
import { LO, HI } from "../src/values.js";

/** Seeded PRNG (mulberry32) — benchmarks and tests share the stimulus rule:
 *  any randomness must be seeded and recorded. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rippleAdder(bits: number) {
  const b = new NetlistBuilder();
  const a = b.bus(bits), bb = b.bus(bits), s = b.bus(bits);
  const aIn = a.map((n) => b.input(n));
  const bIn = bb.map((n) => b.input(n));
  let cin = b.net();
  const cinIn = b.input(cin);
  for (let i = 0; i < bits; i++) {
    const x1 = b.net(), a1 = b.net(), a2 = b.net(), cout = b.net();
    b.gate(NK_XOR, [a[i], bb[i]], x1);
    b.gate(NK_XOR, [x1, cin], s[i]);
    b.gate(NK_AND, [a[i], bb[i]], a1);
    b.gate(NK_AND, [x1, cin], a2);
    b.gate(NK_OR, [a1, a2], cout);
    cin = cout;
  }
  return { nl: b.build(), aIn, bIn, cinIn, s };
}

function runScenario(chunked: boolean): { digest: number; events: number } {
  const { nl, aIn, bIn, cinIn } = rippleAdder(32);
  const sim = new Simulator(nl);
  const rnd = mulberry32(0xC0FFEE);
  sim.setInput(cinIn, LO, 0);
  for (let i = 0; i < 32; i++) {
    sim.setInput(aIn[i], rnd() < 0.5 ? LO : HI, 0);
    sim.setInput(bIn[i], rnd() < 0.5 ? LO : HI, 0);
  }
  for (let step = 1; step <= 200; step++) {
    const t = step * 3;
    const pick = Math.floor(rnd() * 32);
    sim.setInput(rnd() < 0.5 ? aIn[pick] : bIn[pick], rnd() < 0.5 ? LO : HI, t);
    if (chunked) sim.run(t);
  }
  sim.run(1000);
  return { digest: sim.traceDigest, events: sim.eventCount };
}

describe("determinism smoke (cross-platform gate)", () => {
  it("the shared scenario produces the pinned digest", async () => {
    const { SMOKE_DIGEST, runDeterminismSmoke } = await import("../src/smoke.js");
    expect(runDeterminismSmoke()).toBe(SMOKE_DIGEST);
  });
});

describe("determinism", () => {
  it("identical circuit + identical commands -> identical trace", () => {
    const r1 = runScenario(false);
    const r2 = runScenario(false);
    expect(r1.digest).toBe(r2.digest);
    expect(r1.events).toBe(r2.events);
    expect(r1.events).toBeGreaterThan(0);
  });

  it("chunked run() calls produce the same trace as one big run()", () => {
    // Wall-clock pacing (how often the host calls run) must never change
    // simulation outcomes — only scheduled sim ticks matter.
    expect(runScenario(true).digest).toBe(runScenario(false).digest);
  });

  it("golden trace digest is stable (cross-platform determinism gate)", () => {
    // Snapshot pins the digest; CI on WebView2/WKWebView builds compares
    // against the same snapshot.
    expect(runScenario(false).digest.toString(16)).toMatchSnapshot();
  });
});

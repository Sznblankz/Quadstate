/**
 * Cross-platform determinism smoke (plan, Determinism constraint #6):
 * one fixed scenario exercising gates, flip-flops, clocks, tri-state
 * resolution, and LUTs, with seeded stimulus. Every platform must
 * produce EXACTLY this trace digest — Node asserts it in CI, the app
 * worker recomputes it on demand (Web / WebView2 / WKWebView).
 */
import { NetlistBuilder, NK_AND, NK_OR, NK_XOR } from "./netlist.js";
import { Simulator } from "./simulator.js";
import { LO, HI, X } from "./values.js";

/** Expected digest (hex). Update ONLY when trace semantics intentionally
 *  change — that is a determinism-breaking event and needs a changelog. */
export const SMOKE_DIGEST = "860417af";

export function runDeterminismSmoke(): string {
  const b = new NetlistBuilder();

  // 16-bit ripple adder (combinational churn).
  const a = b.bus(16), bb = b.bus(16), s = b.bus(16);
  const aIn = a.map((n) => b.input(n));
  const bIn = bb.map((n) => b.input(n));
  let cin = b.net();
  b.input(cin);
  for (let i = 0; i < 16; i++) {
    const x1 = b.net(), a1 = b.net(), a2 = b.net(), cout = b.net();
    b.gate(NK_XOR, [a[i], bb[i]], x1);
    b.gate(NK_XOR, [x1, cin], s[i]);
    b.gate(NK_AND, [a[i], bb[i]], a1);
    b.gate(NK_AND, [x1, cin], a2);
    b.gate(NK_OR, [a1, a2], cout);
    cin = cout;
  }

  // 8-bit ripple counter (sequential / clocked).
  const clk = b.net();
  b.clock(clk, 7);
  let stage = clk;
  for (let i = 0; i < 8; i++) {
    const q = b.net(), nq = b.net();
    b.dff(nq, stage, q, 0, LO);
    b.not(q, nq);
    stage = q;
  }

  // Tri-state pair with overlapping enables (Z and conflict resolution).
  const bus = b.net();
  const d1 = b.net(), e1 = b.net(), d2 = b.net(), e2 = b.net();
  const triIns = [b.input(d1), b.input(e1), b.input(d2), b.input(e2)];
  b.tri(d1, e1, bus);
  b.tri(d2, e2, bus);

  // 3-input LUT (majority with one X row).
  const li = [b.bus(1)[0], b.bus(1)[0], b.bus(1)[0]];
  const lutIns = li.map((n) => b.input(n));
  const lo = b.net();
  b.lut(li, lo, [LO, LO, LO, HI, LO, HI, HI, X]);

  const sim = new Simulator(b.build());

  // Seeded stimulus (mulberry32) — wall-clock-free, fully scripted.
  let seed = 0x5EED5 >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 16; i++) {
    sim.setInput(aIn[i], rnd() < 0.5 ? LO : HI, 0);
    sim.setInput(bIn[i], rnd() < 0.5 ? LO : HI, 0);
  }
  for (let step = 1; step <= 150; step++) {
    const t = step * 3;
    sim.setInput(aIn[Math.floor(rnd() * 4)], rnd() < 0.5 ? LO : HI, t);
    sim.setInput(triIns[Math.floor(rnd() * 4)], rnd() < 0.5 ? LO : HI, t);
    sim.setInput(lutIns[Math.floor(rnd() * 3)], rnd() < 0.5 ? LO : HI, t);
  }
  sim.run(600);
  return sim.traceDigest.toString(16).padStart(8, "0");
}

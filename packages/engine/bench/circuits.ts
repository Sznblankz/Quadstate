import { NetlistBuilder, NK_AND, NK_OR, NK_XOR } from "../src/netlist.js";
import { LO } from "../src/values.js";

/** Ripple-carry adder: 5 gates per bit. */
export function rippleAdder(bits: number) {
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
  return { builder: b, aIn, bIn, cinIn, s, gateCount: 5 * bits };
}

/** N independent 16-bit synchronous counters sharing one clock. */
export function counterFarm(counters: number, clockHalfPeriod: number) {
  const b = new NetlistBuilder();
  const clk = b.net();
  b.clock(clk, clockHalfPeriod);
  let gateCount = 0;
  for (let c = 0; c < counters; c++) {
    const bits = 16;
    const q = b.bus(bits);
    const d = b.bus(bits);
    b.not(q[0], d[0]);
    gateCount++;
    let carry = q[0];
    for (let i = 1; i < bits; i++) {
      b.gate(NK_XOR, [q[i], carry], d[i]);
      gateCount++;
      if (i < bits - 1) {
        const nc = b.net();
        b.gate(NK_AND, [carry, q[i]], nc);
        gateCount++;
        carry = nc;
      }
    }
    for (let i = 0; i < bits; i++) {
      b.dff(d[i], clk, q[i], 0, LO);
      gateCount++;
    }
  }
  return { builder: b, gateCount };
}

/** K tri-state drivers on a W-bit shared bus, enables as inputs. */
export function triBus(drivers: number, width: number) {
  const b = new NetlistBuilder();
  const bus = b.bus(width);
  const enableIn: number[] = [];
  const dataIn: number[][] = [];
  for (let k = 0; k < drivers; k++) {
    const en = b.net();
    enableIn.push(b.input(en));
    const data = b.bus(width);
    dataIn.push(data.map((n) => b.input(n)));
    for (let w = 0; w < width; w++) b.tri(data[w], en, bus[w]);
  }
  return { builder: b, enableIn, dataIn, bus, gateCount: drivers * width };
}

/** Seeded PRNG so benchmark stimulus is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Engine benchmark harness — exists from day one of M1 (per plan) so every
 * engine change lands with before/after numbers. Run: pnpm bench
 *
 * Scenario families (per plan): large combinational networks, sequential
 * circuits under sustained clocking, tri-state bus contention. The
 * composite-part-heavy scenario (JSON elaboration + re-elaboration timing)
 * is added in M2 when the schema package exists; netlist build time below
 * is its M1 proxy.
 */
import { Simulator } from "../src/simulator.js";
import { LO, HI } from "../src/values.js";
import { rippleAdder, counterFarm, triBus, mulberry32 } from "./circuits.js";

interface Row {
  scenario: string;
  gates: number;
  buildMs: number;
  simMs: number;
  events: number;
  eventsPerSec: number;
  digest: string;
}

const rows: Row[] = [];

function record(
  scenario: string,
  gates: number,
  buildMs: number,
  sim: Simulator,
  simMs: number,
): void {
  rows.push({
    scenario,
    gates,
    buildMs: +buildMs.toFixed(1),
    simMs: +simMs.toFixed(1),
    events: sim.eventCount,
    eventsPerSec: Math.round(sim.eventCount / (simMs / 1000)),
    digest: sim.traceDigest.toString(16).padStart(8, "0"),
  });
  if (sim.diagnostics.length > 0) {
    throw new Error(`${scenario}: unexpected oscillation diagnostics`);
  }
}

function benchCombinational(bits: number, steps: number): void {
  const t0 = performance.now();
  const { builder, aIn, bIn, cinIn, gateCount } = rippleAdder(bits);
  const nl = builder.build();
  const t1 = performance.now();

  const sim = new Simulator(nl);
  const rnd = mulberry32(0xC0FFEE);
  sim.setInput(cinIn, LO, 0);
  for (let i = 0; i < bits; i++) {
    sim.setInput(aIn[i], rnd() < 0.5 ? LO : HI, 0);
    sim.setInput(bIn[i], rnd() < 0.5 ? LO : HI, 0);
  }
  const t2 = performance.now();
  for (let step = 1; step <= steps; step++) {
    const t = step * 2;
    // Flip a low-order input bit: worst case ripples the full carry chain.
    const pick = Math.floor(rnd() * 4);
    sim.setInput(rnd() < 0.5 ? aIn[pick] : bIn[pick], rnd() < 0.5 ? LO : HI, t);
    sim.run(t);
  }
  const t3 = performance.now();
  record(`ripple-adder ${bits}b x${steps} stimuli`, gateCount, t1 - t0, sim, t3 - t2);
}

function benchSequential(counters: number, ticks: number): void {
  const t0 = performance.now();
  const { builder, gateCount } = counterFarm(counters, 1);
  const nl = builder.build();
  const t1 = performance.now();

  const sim = new Simulator(nl);
  const t2 = performance.now();
  sim.run(ticks);
  const t3 = performance.now();
  record(
    `counter-farm ${counters}x16b, ${ticks} ticks`,
    gateCount, t1 - t0, sim, t3 - t2,
  );
}

function benchTriBus(drivers: number, width: number, rotations: number): void {
  const t0 = performance.now();
  const { builder, enableIn, dataIn, gateCount } = triBus(drivers, width);
  const nl = builder.build();
  const t1 = performance.now();

  const sim = new Simulator(nl);
  const rnd = mulberry32(0xBEEF);
  for (let k = 0; k < drivers; k++) {
    for (let w = 0; w < width; w++) {
      sim.setInput(dataIn[k][w], rnd() < 0.5 ? LO : HI, 0);
    }
    sim.setInput(enableIn[k], LO, 0);
  }
  const t2 = performance.now();
  // Round-robin bus ownership with brief overlap (real contention windows).
  for (let r = 0; r < rotations; r++) {
    const t = 10 + r * 10;
    const owner = r % drivers;
    const prev = (r + drivers - 1) % drivers;
    sim.setInput(enableIn[owner], HI, t);
    sim.setInput(enableIn[prev], LO, t + 2);
    sim.run(t + 9);
  }
  const t3 = performance.now();
  record(
    `tri-bus ${drivers} drv x ${width}b, ${rotations} handoffs`,
    gateCount, t1 - t0, sim, t3 - t2,
  );
}

// Warmup (JIT) — small versions of each, results discarded.
benchCombinational(50, 50);
benchSequential(10, 200);
benchTriBus(4, 16, 50);
rows.length = 0;

benchCombinational(200, 200);    //   1k gates
benchCombinational(2000, 200);   //  10k gates
benchCombinational(20000, 200);  // 100k gates
benchSequential(215, 2000);      // ~10k gates, 1000 clock edges
benchSequential(2150, 2000);     // ~100k gates, 1000 clock edges
benchTriBus(8, 64, 1000);

console.table(rows);

const worst = rows.reduce((m, r) => Math.min(m, r.eventsPerSec), Infinity);
console.log(`\nWorst-case throughput: ${Math.round(worst / 1000)}k net-change events/sec`);

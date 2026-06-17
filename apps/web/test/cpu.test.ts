import { describe, expect, it } from "vitest";
import { HI } from "@logicsim/engine";
import { PartLibrary, instantiate } from "@logicsim/schema";
import {
  CircuitDocument, History, Selection, exportProject, registerStandardLibrary,
} from "@logicsim/document";
import { buildTemplate } from "../src/lib/templates.js";

/**
 * The "4-bit CPU" template is a real fetch-decode-execute machine, so this
 * verifies it actually RUNS its baked-in program (not just that it builds).
 * Builds the template into a fresh std-library doc, instantiates it, and lets
 * its internal clock free-run — sampling the accumulator just after each rising
 * edge (rising edges at (2k+1)·halfPeriod).
 */
function cpuSim() {
  const lib = new PartLibrary();
  const parts = registerStandardLibrary(lib);
  const byName = new Map(parts.map((p) => [p.name, p.id]));
  const doc = new CircuitDocument();
  buildTemplate("cpu", doc, new History(), new Selection(doc), (n) => byName.get(n) ?? "");
  const { def } = exportProject(doc, lib, { name: "cpu", version: "1.0.0" });
  const c = instantiate(lib, lib.add(def));
  const accN = ["acc0", "acc1", "acc2", "acc3"];
  const acc = () =>
    accN.reduce((v, n, i) => v | ((c.sim.value(c.elab.outputs.get(n)![0]) === HI ? 1 : 0) << i), 0);
  return { sim: c.sim, acc };
}

describe("4-bit CPU template", () => {
  it("fetch-decode-executes its program — accumulator cycles 1,3,7,15,6,9,15,0", () => {
    const { sim, acc } = cpuSim();
    const HALF = 400; // must match CPU_CLOCK_HALF in templates.ts
    const seq: number[] = [];
    for (let k = 0; k < 16; k++) { sim.run((2 * k + 1) * HALF); seq.push(acc()); }
    // Two full passes of the 8-instruction program (PC wraps), proving the
    // ROM, decoder, ALU op-mux, and accumulator feedback all work together.
    expect(seq).toEqual([1, 3, 7, 15, 6, 9, 15, 0, 1, 3, 7, 15, 6, 9, 15, 0]);
  });
});

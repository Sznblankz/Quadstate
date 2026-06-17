import { describe, expect, it } from "vitest";
import type { Transition } from "@logicsim/engine";
import { mergeBusTransitions } from "../src/lib/sim/timeline.js";

const MIXED = 5;
// Test aggregate: uniform known bits -> that value; otherwise MIXED.
const agg = (bits: number[]): number => (bits.every((b) => b === bits[0]) ? bits[0] : MIXED);

const hist = (entries: Record<number, Transition[]>) => new Map<number, Transition[]>(
  Object.entries(entries).map(([k, v]) => [Number(k), v]),
);

describe("mergeBusTransitions", () => {
  it("merges aligned bits into aggregate transitions on actual changes only", () => {
    const h = hist({
      0: [{ tick: 0, value: 0 }, { tick: 10, value: 1 }],
      1: [{ tick: 0, value: 0 }, { tick: 20, value: 1 }],
    });
    const { trans, oldestTick } = mergeBusTransitions([0, 1], h, agg);
    expect(oldestTick).toBe(0);
    expect(trans).toEqual([
      { tick: 0, value: 0 },   // 00 -> 0
      { tick: 10, value: MIXED }, // 01 -> mixed
      { tick: 20, value: 1 },  // 11 -> 1
    ]);
  });

  it("uses the common-coverage horizon and never fabricates a pre-horizon edge", () => {
    const h = hist({
      0: [{ tick: 0, value: 0 }, { tick: 5, value: 1 }],
      1: [{ tick: 3, value: 0 }, { tick: 8, value: 1 }], // starts later (evicted)
    });
    const { trans, oldestTick } = mergeBusTransitions([0, 1], h, agg);
    expect(oldestTick).toBe(3); // latest first-tick across bits
    expect(trans[0]).toEqual({ tick: 3, value: 0 }); // seeded at horizon, no edge before it
    expect(trans).toEqual([
      { tick: 3, value: 0 },     // bits 0,0
      { tick: 5, value: MIXED }, // 1,0
      { tick: 8, value: 1 },     // 1,1
    ]);
    // nothing before the horizon
    expect(trans.every((t) => t.tick >= 3)).toBe(true);
  });

  it("degrades from the bits that have history when others don't (no blank lane)", () => {
    // bit 1 was never recorded; the lane is built from bit 0 alone, so its
    // 0->1 edge still shows through instead of blanking the whole bus.
    const h = hist({
      0: [{ tick: 0, value: 0 }, { tick: 10, value: 1 }],
      1: [],
    });
    const { trans, oldestTick } = mergeBusTransitions([0, 1], h, agg);
    expect(oldestTick).toBe(0);
    expect(trans).toEqual([{ tick: 0, value: 0 }, { tick: 10, value: 1 }]);
  });

  it("returns empty only when NO bit has any history", () => {
    const h = hist({ 0: [], 1: [] });
    expect(mergeBusTransitions([0, 1], h, agg)).toEqual({ trans: [], oldestTick: 0 });
  });

  it("collapses redundant aggregates (no net change -> no transition)", () => {
    const h = hist({
      0: [{ tick: 0, value: 0 }, { tick: 10, value: 0 }], // redundant same-value entry
      1: [{ tick: 0, value: 0 }],
    });
    const { trans } = mergeBusTransitions([0, 1], h, agg);
    // aggregate stays 0 throughout -> a single transition
    expect(trans).toEqual([{ tick: 0, value: 0 }]);
  });
});

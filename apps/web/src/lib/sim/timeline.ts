import type { Transition } from "@logicsim/engine";

/**
 * Merge N per-bit transition streams into one aggregate-value stream for a bus
 * lane in the timing diagram.
 *
 * Per-bit nets are ring-capped independently, so their oldest-retained ticks can
 * differ. We only produce aggregate transitions from the COMMON-COVERAGE HORIZON
 * (the latest first-tick across all bits) — never fabricating an edge at a tick
 * where one bit's buffer starts but another's hasn't. A transition is emitted
 * only when the aggregate value actually changes.
 *
 * `oldestTick` is that horizon: history before it is not authoritative.
 */
export function mergeBusTransitions(
  nets: number[],
  hist: Map<number, Transition[]>,
  aggregate: (bits: number[]) => number,
): { trans: Transition[]; oldestTick: number } {
  const series = nets.map((n) => hist.get(n) ?? []);
  if (series.length === 0 || series.some((s) => s.length === 0)) {
    return { trans: [], oldestTick: 0 };
  }

  const horizon = Math.max(...series.map((s) => s[0].tick));
  const ptr = series.map(() => 0);
  // Advance each bit to its value AT the horizon.
  const curBits = series.map((s, i) => {
    let j = 0;
    while (j + 1 < s.length && s[j + 1].tick <= horizon) j++;
    ptr[i] = j;
    return s[j].value;
  });

  const out: Transition[] = [];
  let lastAgg = -1;
  const pushAgg = (tick: number) => {
    const agg = aggregate(curBits);
    if (agg !== lastAgg) {
      out.push({ tick, value: agg });
      lastAgg = agg;
    }
  };

  pushAgg(horizon);
  for (;;) {
    // The next tick at which any bit changes, past the current frontier.
    let next = Infinity;
    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (ptr[i] + 1 < s.length) next = Math.min(next, s[ptr[i] + 1].tick);
    }
    if (next === Infinity) break;
    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (ptr[i] + 1 < s.length && s[ptr[i] + 1].tick === next) {
        ptr[i]++;
        curBits[i] = s[ptr[i]].value;
      }
    }
    pushAgg(next);
  }

  return { trans: out, oldestTick: horizon };
}

# @logicsim/engine

Discrete-event, delta-cycle digital logic simulator. 4-value logic (0/1/X/Z),
cyclic graphs welcome, deterministic by construction (see the architecture
plan's Determinism section). Pure TypeScript, zero DOM/Node dependencies in
`src/` — designed to run in a Web Worker on Web, Tauri, and Capacitor.

- `pnpm test` — golden tests (RS latch, DFF, ring oscillator, tri-state bus,
  counter) + determinism gate (trace-digest snapshot).
- `pnpm bench` — benchmark harness. Run before/after every engine change.

## Benchmark baseline

2026-06-11, Node 25.9, Windows 11 (initial implementation):

| scenario | gates | build ms | sim ms | events/sec |
|---|---|---|---|---|
| ripple-adder 200b × 200 stimuli | 1,000 | 2.0 | 0.8 | 3.2M |
| ripple-adder 2,000b × 200 stimuli | 10,000 | 7.6 | 5.8 | 3.6M |
| ripple-adder 20,000b × 200 stimuli | 100,000 | 60.1 | 35.4 | 5.7M |
| counter-farm 215 × 16b, 1,000 edges | 9,890 | 2.8 | 375 | 4.6M |
| counter-farm 2,150 × 16b, 1,000 edges | 98,900 | 24.9 | 5,675 | 3.0M |
| tri-bus 8 drv × 64b, 1,000 handoffs | 512 | 0.4 | 10.6 | 6.5M |

Interpretation against the plan's targets:

- Throughput is ~3–6.5M net-change events/sec across all scenario families.
- The worst case (100k gates, **100% activity factor** — every flip-flop
  toggling on every edge) sustains ~175 sim clock edges/sec. At 10k gates:
  ~2,700 edges/sec. Realistic circuits have 5–20% activity, so interactive
  clock rates at target scale are comfortably met **without WASM**.
- Netlist build at 100k gates is ~60 ms, validating the full re-elaboration
  strategy (off-main-thread, double-buffered) chosen in the plan.

The composite-part-heavy scenario (JSON elaboration / re-elaboration timing)
is added in M2 when `@logicsim/schema` exists.

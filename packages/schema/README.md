# @logicsim/schema

Part-definition JSON schema (V1), validator, canonical content-hash ids,
part library, and elaboration (JSON parts → flat engine netlist with a
stable-ID hierarchy map). Re-elaboration with DFF state carry-over lives
here too (`reElaborate`).

- `pnpm test` — validator, hashing, elaboration, re-elaboration tests.
- `pnpm bench` — composite-part-heavy benchmark (4-level nesting).
- `tsx bench/profile.ts` — elaboration time split (hierarchy map vs traversal).

Design notes:

- **Dependency cycles are impossible by construction**: parts reference
  dependencies by content hash, so a cycle would require two parts to each
  embed the other's hash. The validator's unknown-ref rejection is the
  practical import-time guard.
- The hash excludes name/version/appearance and normalizes internal ids —
  publishing identity is structural (plan ripple-effect #2).
- `params` is rejected (reserved for schema V2); widths are validated
  against `MAX_BUS_WIDTH = 64` as a named, version-gated constant.

## Benchmark baseline

2026-06-11, Node 25.9, Windows 11 (initial implementation):

| scenario | gates | elaborate ms | re-elaborate ms | sim events/sec |
|---|---|---|---|---|
| farm of 31 × 64-bit adders (4-level nesting) | 9,920 | 79 | 51 | 4.4M |
| farm of 312 × 64-bit adders (4-level nesting) | 99,840 | 795 | 770 | 5.8M |

**Finding (2026-06-11), resolved (2026-06-12):** eager hierarchy-map
recording (~485k path-string Map entries) was 74% of elaboration time at
100k gates (~750 ms total). Fixed by lazy resolution: `Elaboration.nets`
became `resolveNet(path)`, which recomputes engine net indices on demand
from per-definition layouts memoized by content-hash id (allocation order
is deterministic declaration-order DFS, so indices are computable, not
recorded). Post-fix at 100k gates: **elaboration ~233 ms**, first resolve
~2.6 ms (builds the memo), then ~687 resolves/ms steady-state — within
2× of the no-hierarchy floor and comfortably inside the off-main-thread
re-elaboration budget. Reproduce with `tsx bench/profile.ts`.

# LogicSim

Cross-platform digital logic simulator: **Web**, **PC (Tauri)**, and
**iPad (Capacitor + Apple Pencil)** — one web bundle, three shells.
Architecture plan: `~/.claude/plans/foamy-mixing-whale.md` (4-value logic,
delta-cycle engine in a Web Worker, content-addressed community parts,
hard cross-platform determinism).

## Layout

| Package | Role |
|---|---|
| `packages/engine` | Discrete-event delta-cycle simulator (0/1/X/Z, cyclic graphs, deterministic event order). Zero DOM/Node deps. |
| `packages/schema` | Part JSON schema V1, validator, content-hash ids, elaboration → flat netlist, re-elaboration with state carry-over. |
| `packages/document` | Circuit document: invertible commands + undo, stable entity ids, selection subsystem, net merging, chip extraction, project files. |
| `packages/canvas` | Framework-free UI core: viewport, spatial grid, gesture recognizer (mouse/touch/pen policy), tools, 4-layer Canvas2D renderer. |
| `apps/web` | Svelte 5 app + engine worker + runtime-detected storage adapters. The bundle every shell ships. |
| `apps/desktop` | Tauri 2 shell (needs Rust — see its README). |
| `apps/ipad` | Capacitor shell (needs macOS/Xcode — see its README). |

## Commands

```
pnpm install
pnpm test         # all packages (engine golden tests incl. determinism gate)
pnpm typecheck
pnpm bench        # engine + composite-elaboration benchmarks
pnpm --filter @logicsim/web dev    # the app on :5173
```

## Community parts

A chip exports as a self-contained **bundle** (the part plus its
transitive dependency closure, dependencies first; ids are content
hashes, re-verified on import). `packages/schema/src/registry.ts` pins
the registry REST contract (`POST/GET /v1/parts`); `MemoryRegistry` is
the reference implementation a future server must match, and
`HttpRegistryClient` is the ready client. In the app: select a chip →
⇪ in the inspector exports; "+ Import" in the palette loads a bundle.

## Determinism gate

`packages/engine/src/smoke.ts` pins a trace digest for a fixed scenario.
Node CI asserts it; in any shell's dev console, `await __logicsim.runSmoke()`
must return the same hex string. A mismatch on any platform is a release
blocker (see the plan's Determinism section).

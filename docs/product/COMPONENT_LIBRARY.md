# QuadState — Component Library: Inventory & Roadmap

**Phase:** Product Design & UX Planning — document 5
**Date:** 2026-06-12
**Status:** Draft for review
**Trigger:** prototype session feedback — "the component set feels sparse compared to tools like EveryCircuit." This document separates *prototype absence* from *product scope*, and answers the roadmap question for latches, muxes, decoders, counters, registers, RAM, and friends.

---

## 0. Framing

Two notes before the inventory:

1. **Category check:** EveryCircuit is an analog/mixed-signal simulator. Part of the felt sparseness is category difference — QuadState will never have resistors, capacitors, or op-amps (product doc anti-persona/non-goals). The fair comparison set is the *digital* shelf: gates, flip-flops, registers, memories, mux/decode, displays. Against that shelf the gap is real, and mostly deliberate prototype absence.

2. **The hierarchy system is the library's engine.** QuadState's signature mechanic — Create Chip — means most "missing components" are not engine work; they are *content* built with the product's own central feature, shippable as hash-verified bundles (built in M6). The strategic question per part is never "should it exist" but "primitive or chip?"

## 1. The governing rule: primitive vs. library chip

A part becomes an **engine primitive** only when at least one of these holds:

- **(a) Width-parametric.** Content-hashed composite definitions have *fixed* pin widths; a "Register" that works at any bus width can only be a primitive whose width is a prop (the pattern `io:in` already uses: `props.width`, 64-bit cap). This is the decisive criterion for most of the list below.
- **(b) Not structurally expressible at scale.** RAM as 64Ki flip-flops would elaborate into millions of nodes; memory must be a primitive with internal state. Likewise anything with a face: displays, buttons.
- **(c) Performance or semantics.** Tri-state driving (exists: `TRI`), clocks (exists).

Everything else ships as a **standard-library chip** — a composite part built with Create Chip, distributed as a bundle, and **divable**: double-click a library counter and see the real DFFs computing inside. That is a genuine differentiator over Logisim-class opaque builtins, and it makes the standard library double as the teaching curriculum (product doc §11.5 templates).

## 2. Inventory

### A. Built today (engine + prototype both have them)

| Part | Notes |
|---|---|
| AND, OR, XOR, NAND, NOR, NOT | 1-bit gates |
| TRI | tri-state driver — the Z-state workhorse |
| DFF | with state carry-over through edits |
| CLK | prop-driven half-period |
| IN / OUT | width-parametric (1–64); the prototype's `8`+`I` prefix already exercises this |
| BUF | synthesized internally for io→io bridges |
| User chips | unlimited, via Create Chip + bundles — the universal building block |

### B. v1 primitives — committed scope, not yet built (the real backlog)

Ordered by the dependency chain; rationale letter per §1.

| Part | Why primitive | Note |
|---|---|---|
| **Splitter / Merger** | a | Bus breakout; prerequisite for everything bus-shaped. Already assumed by interaction doc §5.3. |
| **Register** | a | Width-parametric DFF bank with enable/reset. The single highest-leverage part for "less repetitive construction." |
| **Constant** | a | Drive a literal value onto a bus. |
| **Mux / Demux** | a | Width- and select-width-parametric. |
| **Decoder / Encoder** | a | Same parametric argument. |
| **RAM / ROM** | b | Engine primitive with internal state; the one item needing real engine design (memory nodes in the flat-buffer netlist, deterministic init = X). Flagged as the largest engineering delta in this document. |
| **Button (momentary), LED** | b | Panel IO beyond toggle-IN / lamp-OUT. |
| **7-segment display** | b | Teaching/demo staple; pure sink, cheap. |

### C. v1 standard library — chips, not primitives (content, shipped as bundles)

SR latch, D latch, JK/T flip-flops, half/full adder, ripple-carry adders (4/8-bit), comparator, 4-bit counter, shift register, and an ALU demo. Fixed widths are fine here (4/8-bit teaching sizes); anything users want parametric, they rebuild at their width — or the part graduates to tier B if demand proves it. Every one of these is **open**: divable to its gates, probe-able, and a worked example of the product's own abstraction story. Built after distinctive part art exists (already on the polish backlog), since these are also showcase content.

### D. Explicitly out of scope

Analog/mixed-signal anything; 74xx-series compatibility libraries (a natural *community* contribution later, not core); timing-accurate/propagation-modeled variants (the engine is unit-delay discrete-event by design).

## 3. Direct answers to the parts you named

| Asked | Answer |
|---|---|
| Latches | Library chips (tier C) — deliberately, so they're divable teaching content |
| Multiplexers | Primitive (tier B) — width-parametric |
| Decoders | Primitive (tier B) — width-parametric |
| Counters | Library chips (tier C), fixed widths |
| Registers | **Primitive** (tier B) — the highest-priority missing part |
| RAM | Primitive (tier B) — needs engine work; the one genuinely expensive item |

## 4. Sequencing

The bus UX planning topic (already first post-prototype, per the system review) and tier B are one body of work — bus *interaction* design without splitter/register/constant would be theory:

1. **Bus enablers** (with the bus UX design): Splitter/Merger, Register, Constant.
2. **Routing/selection:** Mux/Demux, Decoder/Encoder.
3. **Memory:** RAM/ROM — engine design first (memory-node primitive, deterministic X init).
4. **Panel IO:** Button, LED, 7-segment.
5. **Standard library + templates:** tier C content, after part symbol art.

None of this blocks the interaction prototype's validation: every Card A–F conclusion transfers unchanged to a richer palette, because the contract is part-agnostic by construction (the target model doesn't care what the part is).

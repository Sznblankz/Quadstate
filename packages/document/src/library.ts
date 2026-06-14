/**
 * Standard component library v1 (P11): commonly-needed parts built from the
 * existing primitives — latches, flip-flops, decoder/encoder, a counter, and a
 * behavioral 7-segment decoder. Per the architecture, these are composite
 * library chips (structural/behavioral PartDefinitions), NOT new engine
 * primitives, so they need no engine changes and can be dived into / reused
 * like any chip.
 *
 * Structural parts are assembled as a tiny document and lowered with
 * exportAsPart (the same path the editor's Create Chip uses); io:in/io:out
 * names become the interface pins.
 */
import { PartLibrary, type PartDefinition } from "@logicsim/schema";
import { CircuitDocument, type EntityId } from "./model.js";
import { addComponent, addWire } from "./commands.js";
import { exportAsPart } from "./export.js";

export interface LibraryPart { id: string; name: string; }

type Port = [EntityId, string];

function builder() {
  const doc = new CircuitDocument();
  let x = 0;
  const C = (part: string, props: Record<string, number | string> = {}): EntityId => {
    const cmd = addComponent(doc, { part, x: (x += 40), y: 0, rot: 0, props });
    cmd.apply(doc);
    return cmd.id;
  };
  const W = (...ports: Port[]): void => {
    const cmd = addWire(doc, ports.map(([c, p]) => ({ component: c, pin: p })));
    cmd.apply(doc);
  };
  const IN = (name: string): EntityId => C("io:in", { name, width: 1, value: 0 });
  const OUT = (name: string): EntityId => C("io:out", { name, width: 1 });
  return { doc, C, W, IN, OUT };
}

function structural(lib: PartLibrary, name: string, fn: (b: ReturnType<typeof builder>) => void): LibraryPart {
  const b = builder();
  fn(b);
  const def = exportAsPart(b.doc, lib, { name, version: "1.0.0" });
  return { id: lib.add(def), name };
}

// ---- SR latch: cross-coupled NOR. Q=NOR(R,Qn), Qn=NOR(S,Q). Powers up X.
function srLatch(lib: PartLibrary): LibraryPart {
  return structural(lib, "SR Latch", ({ C, W, IN, OUT }) => {
    const s = IN("S"), r = IN("R");
    const n1 = C("builtin:nor"), n2 = C("builtin:nor");
    const q = OUT("Q"), qn = OUT("Qn");
    W([r, "pin"], [n1, "a"]); W([n2, "y"], [n1, "b"]); W([n1, "y"], [q, "pin"]);
    W([s, "pin"], [n2, "a"]); W([n1, "y"], [n2, "b"]); W([n2, "y"], [qn, "pin"]);
  });
}

// ---- D latch (level-sensitive): transparent while E=1, holds while E=0.
function dLatch(lib: PartLibrary): LibraryPart {
  return structural(lib, "D Latch", ({ C, W, IN, OUT }) => {
    const d = IN("D"), e = IN("E");
    const nd = C("builtin:not");
    const sg = C("builtin:and"), rg = C("builtin:and");
    const n1 = C("builtin:nor"), n2 = C("builtin:nor");
    const q = OUT("Q"), qn = OUT("Qn");
    W([d, "pin"], [nd, "a"]);
    W([d, "pin"], [sg, "a"]); W([e, "pin"], [sg, "b"]); // S = D & E
    W([nd, "y"], [rg, "a"]); W([e, "pin"], [rg, "b"]);  // R = !D & E
    W([rg, "y"], [n1, "a"]); W([n2, "y"], [n1, "b"]); W([n1, "y"], [q, "pin"]);
    W([sg, "y"], [n2, "a"]); W([n1, "y"], [n2, "b"]); W([n2, "y"], [qn, "pin"]);
  });
}

// ---- JK flip-flop (edge-triggered): D = (J & !Q) | (!K & Q).
function jkFlipFlop(lib: PartLibrary): LibraryPart {
  return structural(lib, "JK Flip-Flop", ({ C, W, IN, OUT }) => {
    const j = IN("J"), k = IN("K"), clk = IN("clk");
    const nq = C("builtin:not"), nk = C("builtin:not");
    const a1 = C("builtin:and"), a2 = C("builtin:and"), o = C("builtin:or");
    const dff = C("builtin:dff", { init: 0 });
    const q = OUT("Q"), qn = OUT("Qn");
    W([dff, "q"], [q, "pin"]);            // Q
    W([q, "pin"], [nq, "a"]); W([nq, "y"], [qn, "pin"]); // Qn = !Q
    W([k, "pin"], [nk, "a"]);
    W([j, "pin"], [a1, "a"]); W([qn, "pin"], [a1, "b"]); // J & !Q
    W([nk, "y"], [a2, "a"]); W([q, "pin"], [a2, "b"]);   // !K & Q
    W([a1, "y"], [o, "a"]); W([a2, "y"], [o, "b"]); W([o, "y"], [dff, "d"]);
    W([clk, "pin"], [dff, "clk"]);
  });
}

// ---- 2-to-4 decoder: one-hot outputs y0..y3 for address a1 a0.
function decoder2to4(lib: PartLibrary): LibraryPart {
  return structural(lib, "2→4 Decoder", ({ C, W, IN, OUT }) => {
    const a0 = IN("a0"), a1 = IN("a1");
    const n0 = C("builtin:not"), n1 = C("builtin:not");
    W([a0, "pin"], [n0, "a"]); W([a1, "pin"], [n1, "a"]);
    const and = (x: Port, y: Port, name: string) => {
      const g = C("builtin:and"); const o = OUT(name);
      W(x, [g, "a"]); W(y, [g, "b"]); W([g, "y"], [o, "pin"]);
    };
    and([n1, "y"], [n0, "y"], "y0"); // 00
    and([n1, "y"], [a0, "pin"], "y1"); // 01
    and([a1, "pin"], [n0, "y"], "y2"); // 10
    and([a1, "pin"], [a0, "pin"], "y3"); // 11
  });
}

// ---- 4-to-2 encoder (binary): a0=i1|i3, a1=i2|i3 (i0 = code 00).
function encoder4to2(lib: PartLibrary): LibraryPart {
  return structural(lib, "4→2 Encoder", ({ C, W, IN, OUT }) => {
    IN("i0"); // present (code 00); drives nothing
    const i1 = IN("i1"), i2 = IN("i2"), i3 = IN("i3");
    const o0 = C("builtin:or"), o1 = C("builtin:or");
    const a0 = OUT("a0"), a1 = OUT("a1");
    W([i1, "pin"], [o0, "a"]); W([i3, "pin"], [o0, "b"]); W([o0, "y"], [a0, "pin"]);
    W([i2, "pin"], [o1, "a"]); W([i3, "pin"], [o1, "b"]); W([o1, "y"], [a1, "pin"]);
  });
}

// ---- 4-bit binary counter: increments q0..q3 on each clk rising edge.
function counter4(lib: PartLibrary): LibraryPart {
  return structural(lib, "4-bit Counter", ({ C, W, IN, OUT }) => {
    const clk = IN("clk");
    const dff: EntityId[] = [];
    for (let i = 0; i < 4; i++) {
      dff.push(C("builtin:dff", { init: 0 }));
      W([clk, "pin"], [dff[i], "clk"]);
      W([dff[i], "q"], [OUT(`q${i}`), "pin"]);
    }
    const not0 = C("builtin:not");
    W([dff[0], "q"], [not0, "a"]); W([not0, "y"], [dff[0], "d"]);
    let carry: Port = [dff[0], "q"];
    for (let i = 1; i < 4; i++) {
      const xo = C("builtin:xor");
      W([dff[i], "q"], [xo, "a"]); W(carry, [xo, "b"]); W([xo, "y"], [dff[i], "d"]);
      if (i < 3) {
        const an = C("builtin:and");
        W([dff[i], "q"], [an, "a"]); W(carry, [an, "b"]);
        carry = [an, "y"];
      }
    }
  });
}

// ---- 7-segment decoder (behavioral): hex digit x3..x0 -> segments a..g
//      (common-cathode, segment on = 1). Rows keyed x3 x2 x1 x0, value abcdefg.
const SEG_ROWS: Record<string, string> = {
  "0000": "1111110", "0001": "0110000", "0010": "1101101", "0011": "1111001",
  "0100": "0110011", "0101": "1011011", "0110": "1011111", "0111": "1110000",
  "1000": "1111111", "1001": "1111011", "1010": "1110111", "1011": "0011111",
  "1100": "1001110", "1101": "0111101", "1110": "1001111", "1111": "1000111",
};

function sevenSegDecoder(lib: PartLibrary): LibraryPart {
  const inN = ["x3", "x2", "x1", "x0"];
  const outN = ["a", "b", "c", "d", "e", "f", "g"];
  const def: PartDefinition = {
    schemaVersion: 1,
    name: "7-Seg Decoder",
    version: "1.0.0",
    interface: {
      pins: [
        ...inN.map((name) => ({ name, dir: "in" as const, width: 1, side: "left" as const })),
        ...outN.map((name) => ({ name, dir: "out" as const, width: 1, side: "right" as const })),
      ],
    },
    body: { kind: "behavioral", truthTable: { inputs: inN, outputs: outN, rows: SEG_ROWS } },
  };
  return { id: lib.add(def), name: "7-Seg Decoder" };
}

/** Build and register the standard library; returns palette entries in order. */
export function registerStandardLibrary(lib: PartLibrary): LibraryPart[] {
  return [
    srLatch(lib),
    dLatch(lib),
    jkFlipFlop(lib),
    decoder2to4(lib),
    encoder4to2(lib),
    counter4(lib),
    sevenSegDecoder(lib),
  ];
}

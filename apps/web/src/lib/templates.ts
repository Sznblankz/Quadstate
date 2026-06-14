/**
 * Example circuits loadable from Home / the editor's "Examples" menu. Built
 * with the same document commands the editor uses, laid out cleanly, and
 * self-contained so each loads, simulates, and is pokeable immediately. The
 * Counter and 7-Segment examples use the standard library parts (P11); the
 * adders stay gate-level to show building from primitives.
 */
import { addComponent, addWire } from "@logicsim/document";
import type { CircuitDocument, EntityId, History, Selection } from "@logicsim/document";

export type TemplateId =
  | "halfAdder" | "fullAdder" | "adder4" | "register" | "counter" | "sevenSeg";

export const TEMPLATES: ReadonlyArray<{ id: TemplateId; label: string }> = [
  { id: "halfAdder", label: "Half adder" },
  { id: "fullAdder", label: "Full adder" },
  { id: "adder4", label: "4-bit adder" },
  { id: "register", label: "Register" },
  { id: "counter", label: "Counter" },
  { id: "sevenSeg", label: "7-Segment" },
];

/** Resolves a standard-library part name (e.g. "4-bit Counter") to its id. */
export type LibId = (name: string) => string;

type Port = [EntityId, string];

function maker(doc: CircuitDocument, history: History, selection: Selection) {
  const C = (part: string, x: number, y: number, props: Record<string, number | string> = {}): EntityId => {
    const cmd = addComponent(doc, { part, x, y, rot: 0, props });
    history.execute(doc, cmd, selection);
    return cmd.id;
  };
  const W = (a: Port, b: Port): void => {
    history.execute(doc, addWire(doc, [
      { component: a[0], pin: a[1] }, { component: b[0], pin: b[1] },
    ]), selection);
  };
  const IN = (name: string, x: number, y: number, width = 1) => C("io:in", x, y, { name, width, value: 0 });
  const OUT = (name: string, x: number, y: number, width = 1) => C("io:out", x, y, { name, width });
  return { C, W, IN, OUT };
}

type Maker = ReturnType<typeof maker>;

/** Gate-level full adder; returns its sum/cout ports for chaining. */
function fullAdderGates(m: Maker, x: number, y: number, a: Port, b: Port, cin: Port): { sum: Port; cout: Port } {
  const { C, W } = m;
  const x1 = C("builtin:xor", x, y), a1 = C("builtin:and", x, y + 110);
  const x2 = C("builtin:xor", x + 110, y + 30), a2 = C("builtin:and", x + 110, y + 150);
  const orc = C("builtin:or", x + 220, y + 160);
  W(a, [x1, "a"]); W(b, [x1, "b"]);
  W([x1, "y"], [x2, "a"]); W(cin, [x2, "b"]);
  W(a, [a1, "a"]); W(b, [a1, "b"]);
  W([x1, "y"], [a2, "a"]); W(cin, [a2, "b"]);
  W([a1, "y"], [orc, "a"]); W([a2, "y"], [orc, "b"]);
  return { sum: [x2, "y"], cout: [orc, "y"] };
}

function halfAdder(m: Maker): void {
  const { C, W, IN, OUT } = m;
  const a = IN("a", 40, 70), b = IN("b", 40, 210);
  const xo = C("builtin:xor", 220, 80), an = C("builtin:and", 220, 210);
  const s = OUT("sum", 420, 90), co = OUT("carry", 420, 220);
  W([a, "pin"], [xo, "a"]); W([a, "pin"], [an, "a"]);
  W([b, "pin"], [xo, "b"]); W([b, "pin"], [an, "b"]);
  W([xo, "y"], [s, "pin"]); W([an, "y"], [co, "pin"]);
}

function fullAdder(m: Maker): void {
  const { W, IN, OUT } = m;
  const a = IN("a", 40, 50), b = IN("b", 40, 150), cin = IN("cin", 40, 250);
  const r = fullAdderGates(m, 220, 50, [a, "pin"], [b, "pin"], [cin, "pin"]);
  const s = OUT("sum", 540, 90), cout = OUT("cout", 540, 220);
  W(r.sum, [s, "pin"]); W(r.cout, [cout, "pin"]);
}

function adder4(m: Maker): void {
  const { W, IN, OUT } = m;
  const cin = IN("cin", 20, 380);
  let carry: Port = [cin, "pin"];
  for (let i = 0; i < 4; i++) {
    const bx = 120 + i * 330;
    const a = IN(`a${i}`, bx, 30), b = IN(`b${i}`, bx, 130);
    const r = fullAdderGates(m, bx + 100, 40, [a, "pin"], [b, "pin"], carry);
    const s = OUT(`s${i}`, bx + 380, 80);
    W(r.sum, [s, "pin"]);
    carry = r.cout;
  }
  const cout = OUT("cout", 120 + 4 * 330, 260);
  W(carry, [cout, "pin"]);
}

function register(m: Maker): void {
  const { C, W, IN, OUT } = m;
  const d = IN("d", 40, 70, 4), clk = IN("clk", 40, 210);
  const dff = C("builtin:dff", 260, 100, { init: 0 });
  const q = OUT("q", 460, 110, 4);
  W([d, "pin"], [dff, "d"]); W([clk, "pin"], [dff, "clk"]); W([dff, "q"], [q, "pin"]);
}

/** Counter — a free-running clock drives the library 4-bit counter. */
function counter(m: Maker, lib: LibId): void {
  const { C, W, OUT } = m;
  const clk = C("builtin:clock", 80, 150, { halfPeriod: 500 });
  const ctr = C(lib("4-bit Counter"), 280, 110);
  W([clk, "y"], [ctr, "clk"]);
  for (let i = 0; i < 4; i++) {
    const o = OUT(`q${i}`, 500, 70 + i * 70);
    W([ctr, `q${i}`], [o, "pin"]);
  }
}

/** 7-Segment — set the 4-bit digit, watch the library decoder light segments. */
function sevenSeg(m: Maker, lib: LibId): void {
  const { C, W, IN, OUT } = m;
  const dec = C(lib("7-Seg Decoder"), 240, 70);
  for (let i = 0; i < 4; i++) {
    const inp = IN(`x${i}`, 40, 60 + i * 80);
    W([inp, "pin"], [dec, `x${i}`]);
  }
  ["a", "b", "c", "d", "e", "f", "g"].forEach((s, i) => {
    const o = OUT(s, 480, 40 + i * 55);
    W([dec, s], [o, "pin"]);
  });
}

const BUILDERS: Record<TemplateId, (m: Maker, lib: LibId) => void> = {
  halfAdder, fullAdder, adder4, register, counter, sevenSeg,
};

export function buildTemplate(
  id: TemplateId,
  doc: CircuitDocument,
  history: History,
  selection: Selection,
  lib: LibId,
): void {
  BUILDERS[id](maker(doc, history, selection), lib);
}

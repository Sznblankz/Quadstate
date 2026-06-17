/**
 * Example circuits loadable from Home / the editor. Built with the same document
 * commands the editor uses, laid out cleanly, and self-contained so each loads,
 * simulates, and is pokeable immediately. Each builder returns the wire ids worth
 * tracking, so a template opens with the timing diagram already showing meaningful
 * lanes. Counter / Decoder / Traffic Light are clock-driven and animate on open.
 */
import {
  addComponent, addWire, CircuitDocument, History, Selection,
  projectToJson, registerStandardLibrary,
} from "@logicsim/document";
import type { EntityId } from "@logicsim/document";
import { PartLibrary } from "@logicsim/schema";

export type TemplateId =
  | "counter" | "trafficLight" | "decoder" | "srLatch"
  | "fullAdder" | "sevenSeg" | "register" | "halfAdder" | "adder4" | "cpu";

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  desc: string;
  /** Clock-driven demo that animates the timing diagram on open. */
  timing?: boolean;
}

export const TEMPLATES: ReadonlyArray<TemplateMeta> = [
  { id: "counter", label: "Counter", desc: "4-bit counter on a clock — watch the bits cascade.", timing: true },
  { id: "trafficLight", label: "Traffic Light", desc: "Clocked FSM cycling red → green → yellow.", timing: true },
  { id: "decoder", label: "2→4 Decoder", desc: "Address counts; the one-hot output rotates.", timing: true },
  { id: "srLatch", label: "SR Latch", desc: "Set/reset memory — toggle S and R." },
  { id: "fullAdder", label: "Full Adder", desc: "Sum and carry from a, b, cin." },
  { id: "sevenSeg", label: "7-Segment", desc: "Hex digit → segment decoder." },
  { id: "register", label: "Register", desc: "4-bit value latched on the clock edge." },
  { id: "halfAdder", label: "Half Adder", desc: "Sum and carry from two bits." },
  { id: "adder4", label: "4-bit Adder", desc: "Ripple-carry across four full adders." },
  { id: "cpu", label: "4-bit CPU", desc: "Accumulator CPU: PC → ROM → ALU → acc, running a program.", timing: true },
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
  /** Add a wire and return its id (so builders can mark it as tracked). */
  const W = (a: Port, b: Port): EntityId => {
    const cmd = addWire(doc, [
      { component: a[0], pin: a[1] }, { component: b[0], pin: b[1] },
    ]);
    history.execute(doc, cmd, selection);
    return cmd.id;
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

// ---- Counter — a free-running clock drives the library 4-bit counter. The clock
//      and each output bit are tracked so the timing diagram shows the cascade.
function counter(m: Maker, lib: LibId): number[] {
  const { C, W, OUT } = m;
  const clk = C("builtin:clock", 80, 190, { halfPeriod: 500 });
  const ctr = C(lib("4-bit Counter"), 300, 150);
  const tracked: number[] = [];
  tracked.push(W([clk, "y"], [ctr, "clk"])); // clock timebase
  for (let i = 0; i < 4; i++) {
    const o = OUT(`q${i}`, 540, 60 + i * 80);
    tracked.push(W([ctr, `q${i}`], [o, "pin"]));
  }
  return tracked;
}

// ---- Traffic light FSM — clock → counter (2 low bits) → 2→4 decoder → lights.
//      Phases 00,01,10,11 map to Red, Green, Yellow, Red (red gets the extra phase).
function trafficLight(m: Maker, lib: LibId): number[] {
  const { C, W, OUT } = m;
  const clk = C("builtin:clock", 60, 200, { halfPeriod: 500 });
  const ctr = C(lib("4-bit Counter"), 240, 170);
  const dec = C(lib("2→4 Decoder"), 460, 150);
  const orRed = C("builtin:or", 660, 90);
  const red = OUT("Red", 850, 70), grn = OUT("Green", 850, 190), yel = OUT("Yellow", 850, 310);
  const tracked: number[] = [];
  tracked.push(W([clk, "y"], [ctr, "clk"]));
  W([ctr, "q0"], [dec, "a0"]); W([ctr, "q1"], [dec, "a1"]);
  W([dec, "y0"], [orRed, "a"]); W([dec, "y3"], [orRed, "b"]);
  tracked.push(W([orRed, "y"], [red, "pin"]));
  tracked.push(W([dec, "y1"], [grn, "pin"]));
  tracked.push(W([dec, "y2"], [yel, "pin"]));
  return tracked;
}

// ---- 2→4 decoder — two clocks at P and 2P count the address 00→01→10→11, so the
//      one-hot outputs y0..y3 light in rotation (all four tracked).
function decoder(m: Maker, lib: LibId): number[] {
  const { C, W, OUT } = m;
  const c0 = C("builtin:clock", 60, 120, { halfPeriod: 400 });
  const c1 = C("builtin:clock", 60, 260, { halfPeriod: 800 });
  const dec = C(lib("2→4 Decoder"), 280, 150);
  W([c0, "y"], [dec, "a0"]); W([c1, "y"], [dec, "a1"]);
  const tracked: number[] = [];
  for (let i = 0; i < 4; i++) {
    const o = OUT(`y${i}`, 520, 60 + i * 80);
    tracked.push(W([dec, `y${i}`], [o, "pin"]));
  }
  return tracked;
}

// ---- SR latch — set/reset memory. Track S, R, Q, Qn so pokes show on the scope.
function srLatch(m: Maker, lib: LibId): number[] {
  const { C, W, IN, OUT } = m;
  const s = IN("S", 60, 90), r = IN("R", 60, 230);
  const sr = C(lib("SR Latch"), 280, 130);
  const q = OUT("Q", 520, 90), qn = OUT("Qn", 520, 210);
  return [
    W([s, "pin"], [sr, "S"]),
    W([r, "pin"], [sr, "R"]),
    W([sr, "Q"], [q, "pin"]),
    W([sr, "Qn"], [qn, "pin"]),
  ];
}

function halfAdder(m: Maker): number[] {
  const { C, W, IN, OUT } = m;
  const a = IN("a", 40, 70), b = IN("b", 40, 210);
  const xo = C("builtin:xor", 220, 80), an = C("builtin:and", 220, 210);
  const s = OUT("sum", 420, 90), co = OUT("carry", 420, 220);
  const wa = W([a, "pin"], [xo, "a"]); W([a, "pin"], [an, "a"]);
  const wb = W([b, "pin"], [xo, "b"]); W([b, "pin"], [an, "b"]);
  const ws = W([xo, "y"], [s, "pin"]); const wc = W([an, "y"], [co, "pin"]);
  return [wa, wb, ws, wc];
}

function fullAdder(m: Maker): number[] {
  const { W, IN, OUT } = m;
  const a = IN("a", 40, 50), b = IN("b", 40, 150), cin = IN("cin", 40, 250);
  const r = fullAdderGates(m, 220, 50, [a, "pin"], [b, "pin"], [cin, "pin"]);
  const s = OUT("sum", 540, 90), cout = OUT("cout", 540, 220);
  return [W(r.sum, [s, "pin"]), W(r.cout, [cout, "pin"])];
}

function adder4(m: Maker): number[] {
  const { W, IN, OUT } = m;
  const cin = IN("cin", 20, 380);
  let carry: Port = [cin, "pin"];
  const tracked: number[] = [];
  for (let i = 0; i < 4; i++) {
    const bx = 120 + i * 330;
    const a = IN(`a${i}`, bx, 30), b = IN(`b${i}`, bx, 130);
    const r = fullAdderGates(m, bx + 100, 40, [a, "pin"], [b, "pin"], carry);
    const s = OUT(`s${i}`, bx + 380, 80);
    tracked.push(W(r.sum, [s, "pin"]));
    carry = r.cout;
  }
  const cout = OUT("cout", 120 + 4 * 330, 260);
  tracked.push(W(carry, [cout, "pin"]));
  return tracked;
}

function register(m: Maker): number[] {
  const { C, W, IN, OUT } = m;
  const d = IN("d", 40, 70, 4), clk = IN("clk", 40, 210);
  const dff = C("builtin:dff", 260, 100, { init: 0 });
  const q = OUT("q", 460, 110, 4);
  W([d, "pin"], [dff, "d"]);
  const wclk = W([clk, "pin"], [dff, "clk"]);
  const wq = W([dff, "q"], [q, "pin"]);
  return [wclk, wq];
}

function sevenSeg(m: Maker, lib: LibId): number[] {
  const { C, W, IN, OUT } = m;
  const dec = C(lib("7-Seg Decoder"), 240, 70);
  for (let i = 0; i < 4; i++) {
    const inp = IN(`x${i}`, 40, 60 + i * 80);
    W([inp, "pin"], [dec, `x${i}`]);
  }
  const tracked: number[] = [];
  ["a", "b", "c", "d", "e", "f", "g"].forEach((s, i) => {
    const o = OUT(s, 480, 40 + i * 55);
    tracked.push(W([dec, s], [o, "pin"]));
  });
  return tracked;
}

// ---- A small but complete 4-bit accumulator CPU, self-running off its own
//      clock. Fetch–decode–execute: a free-running counter is the program
//      counter (PC); its low 3 bits address an 8-word ROM (built from a 3→8
//      decoder + OR trees); each word is opcode[5:4] + operand[3:0]. The opcode
//      one-hot-selects an ALU op (LDI / ADD / AND / OR) over the accumulator and
//      the immediate, AND-OR muxed onto the result, which the accumulator (4
//      DFFs) latches each clock. Everything is bit-level (no buses/mergers).
//
//      The baked-in program makes the accumulator cycle 1,3,7,15,6,9,15,0:
//        0:LDI 1  1:ADD 2  2:ADD 4  3:OR 8  4:AND 6  5:ADD 3  6:ADD 6  7:LDI 0
//      Opcodes: 0=LDI(acc=imm) 1=ADD(acc+imm) 2=AND 3=OR.
const CPU_CLOCK_HALF = 400; // clock half-period (rising edges at (2k+1)·this)
const CPU_PROGRAM = [1, 0x12, 0x14, 0x38, 0x26, 0x13, 0x16, 0]; // 6-bit words

function cpu(m: Maker, lib: LibId): number[] {
  const { C, W, OUT } = m;
  // Column-based auto-layout (left→right datapath flow); positions are cosmetic.
  const colY: Record<number, number> = {};
  const at = (col: number, gap = 64): [number, number] => {
    colY[col] = (colY[col] ?? 0) + gap;
    return [60 + col * 150, colY[col]];
  };
  const NOT = (x: Port, col: number): Port => { const g = C("builtin:not", ...at(col)); W(x, [g, "a"]); return [g, "y"]; };
  const AND = (x: Port, y: Port, col: number): Port => { const g = C("builtin:and", ...at(col)); W(x, [g, "a"]); W(y, [g, "b"]); return [g, "y"]; };
  const OR = (x: Port, y: Port, col: number): Port => { const g = C("builtin:or", ...at(col)); W(x, [g, "a"]); W(y, [g, "b"]); return [g, "y"]; };
  const orAll = (ins: Port[], col: number): Port => ins.reduce((a, b) => OR(a, b, col));
  const k0 = (): Port => { const g = C("builtin:const", ...at(0), { value: 0 }); return [g, "y"]; };
  const k1 = (): Port => { const g = C("builtin:const", ...at(0), { value: 1 }); return [g, "y"]; };

  // Clock + program counter (free-running 4-bit counter → low 3 bits = address).
  const clk = C("builtin:clock", ...at(0, 130), { halfPeriod: CPU_CLOCK_HALF });
  const CLK: Port = [clk, "y"];
  const pc = C(lib("4-bit Counter"), ...at(1, 220));
  W(CLK, [pc, "clk"]);
  const A: Port[] = [[pc, "q0"], [pc, "q1"], [pc, "q2"]];

  // 3→8 one-hot address decoder.
  const An = A.map((a) => NOT(a, 2));
  const line: Port[] = [];
  for (let i = 0; i < 8; i++) {
    const lit = (b: number): Port => ((i >> b) & 1) ? A[b] : An[b];
    line.push(AND(AND(lit(0), lit(1), 3), lit(2), 3));
  }

  // ROM: each of the 6 instruction bits = OR of the addresses where it is 1.
  const romBit = (b: number): Port => {
    const mins = line.filter((_, addr) => (CPU_PROGRAM[addr] >> b) & 1);
    if (mins.length === 0) return k0();
    if (mins.length === 8) return k1();
    return orAll(mins, 4);
  };
  const imm: Port[] = [0, 1, 2, 3].map(romBit); // operand bits
  const op: Port[] = [4, 5].map(romBit);         // opcode bits

  // Opcode → one-hot op-select (2→4 decoder): y0=LDI y1=ADD y2=AND y3=OR.
  const dec = C(lib("2→4 Decoder"), ...at(5, 220));
  W(op[0], [dec, "a0"]); W(op[1], [dec, "a1"]);
  const sel: Port[] = [[dec, "y0"], [dec, "y1"], [dec, "y2"], [dec, "y3"]];

  // Accumulator registers (declared first so the ALU can read acc.q).
  const accDff = [0, 1, 2, 3].map(() => C("builtin:dff", ...at(9), { init: 0 }));
  const acc: Port[] = accDff.map((d) => [d, "q"] as Port);
  accDff.forEach((d) => W(CLK, [d, "clk"]));

  // ALU op results (bit-level).
  const ldi = imm;
  const andR = acc.map((a, i) => AND(a, imm[i], 6));
  const orR = acc.map((a, i) => OR(a, imm[i], 6));
  const addR: Port[] = [];
  let carry: Port = k0();
  for (let i = 0; i < 4; i++) {
    const fa = C(lib("Full Adder"), ...at(7, 110));
    W(acc[i], [fa, "a"]); W(imm[i], [fa, "b"]); W(carry, [fa, "cin"]);
    addR.push([fa, "sum"]);
    carry = [fa, "cout"];
  }

  // Result mux (one-hot): result[i] = OR over ops of (sel[op] & opResult[op][i]).
  const ops = [ldi, addR, andR, orR];
  for (let i = 0; i < 4; i++) {
    const gated = ops.map((r, o) => AND(sel[o], r[i], 8));
    W(orAll(gated, 8), [accDff[i], "d"]);
  }

  // Outputs (tracked on the timing diagram): clock, accumulator, PC.
  const tracked: number[] = [];
  tracked.push(W(CLK, [OUT("clk", ...at(10, 70)), "pin"]));
  for (let i = 0; i < 4; i++) tracked.push(W(acc[i], [OUT(`acc${i}`, ...at(10, 70)), "pin"]));
  for (let i = 0; i < 3; i++) tracked.push(W(A[i], [OUT(`pc${i}`, ...at(10, 70)), "pin"]));
  return tracked;
}

const BUILDERS: Record<TemplateId, (m: Maker, lib: LibId) => number[]> = {
  counter, trafficLight, decoder, srLatch, fullAdder, sevenSeg, register, halfAdder, adder4, cpu,
};

/** Build a template into `doc`; returns the wire ids to track by default. */
export function buildTemplate(
  id: TemplateId,
  doc: CircuitDocument,
  history: History,
  selection: Selection,
  lib: LibId,
): number[] {
  return BUILDERS[id](maker(doc, history, selection), lib);
}

// --- Home thumbnails: build a template in isolation and serialize it so the
//     real schematic renderer can draw a preview. The standard library is
//     registered once and reused.
let _std: { lib: PartLibrary; libId: LibId } | null = null;
function stdLib(): { lib: PartLibrary; libId: LibId } {
  if (!_std) {
    const lib = new PartLibrary();
    const parts = registerStandardLibrary(lib);
    const byName = new Map(parts.map((p) => [p.name, p.id]));
    _std = { lib, libId: (n) => byName.get(n) ?? "" };
  }
  return _std;
}

/** Self-contained project JSON for a template (for thumbnail rendering). */
export function templateProjectJson(id: TemplateId): string {
  const { lib, libId } = stdLib();
  const doc = new CircuitDocument();
  const history = new History();
  const selection = new Selection(doc);
  buildTemplate(id, doc, history, selection, libId);
  return projectToJson(doc, [], lib);
}

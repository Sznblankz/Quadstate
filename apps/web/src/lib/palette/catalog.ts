/**
 * Data-driven component catalog for the palette. Categories group items; each
 * item maps to a REAL placeable part (builtin type or a standard-library part
 * resolved by name at runtime) or is `enabled: false` ("planned") — we never
 * fake simulation support.
 *
 * Planned digital parts can be built today with Create Chip; planned analog
 * parts await the (unimplemented) analog engine.
 */

const PLANNED_DIGITAL = "Not a built-in yet — build it with Create Chip.";
const PLANNED_ANALOG = "Analog engine not implemented yet.";

export interface PaletteItem {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  tooltip: string;
  /** Builtin part type to place (e.g. "builtin:and", "io:in"). */
  builtin?: string;
  /** Initial props applied on placement (e.g. Constant 1 → { value: 1 }). */
  builtinProps?: Record<string, number>;
  /** Standard-library part NAME, resolved to its content-hash id at runtime. */
  libraryName?: string;
  /** Extra search terms. */
  aliases?: string[];
}

export interface PaletteCategory {
  id: string;
  label: string;
  defaultOpen: boolean;
  /** Filled at runtime from the user's chips instead of static items. */
  dynamic?: "userParts";
  items: PaletteItem[];
}

const on = (
  id: string, label: string, icon: string,
  part: { builtin?: string; builtinProps?: Record<string, number>; libraryName?: string },
  aliases?: string[], tooltip?: string,
): PaletteItem => ({
  id, label, icon, enabled: true, aliases,
  tooltip: tooltip ?? `Drag onto the canvas to place ${label}.`,
  ...part,
});

const planned = (
  id: string, label: string, icon: string, kind: "digital" | "analog", aliases?: string[],
): PaletteItem => ({
  id, label, icon, enabled: false, aliases,
  tooltip: kind === "analog" ? PLANNED_ANALOG : PLANNED_DIGITAL,
});

export const PALETTE_CATALOG: PaletteCategory[] = [
  {
    id: "inputs", label: "Inputs / Sources", defaultOpen: true, items: [
      on("input", "Input", "in", { builtin: "io:in" }, ["switch", "toggle", "source", "in"]),
      on("switch", "Switch", "switch", { builtin: "io:in" }, ["spst", "toggle"]),
      on("clock", "Clock", "clock", { builtin: "builtin:clock" }, ["oscillator", "osc", "clk"]),
      on("const0", "Constant 0", "const0", { builtin: "builtin:const", builtinProps: { value: 0 } }, ["low", "gnd", "zero"]),
      on("const1", "Constant 1", "const1", { builtin: "builtin:const", builtinProps: { value: 1 } }, ["high", "vcc", "one"]),
      planned("button", "Button", "button", "digital", ["momentary", "push"]),
    ],
  },
  {
    id: "gates", label: "Gates", defaultOpen: true, items: [
      on("and", "AND", "and", { builtin: "builtin:and" }),
      on("nand", "NAND", "nand", { builtin: "builtin:nand" }),
      on("or", "OR", "or", { builtin: "builtin:or" }),
      on("nor", "NOR", "nor", { builtin: "builtin:nor" }),
      on("xor", "XOR", "xor", { builtin: "builtin:xor" }),
      on("xnor", "XNOR", "xnor", { builtin: "builtin:xnor" }),
      on("not", "NOT", "not", { builtin: "builtin:not" }, ["inverter", "invert"]),
      on("buf", "Buffer", "buf", { builtin: "builtin:buf" }, ["buffer"]),
      on("tri", "Tri-state Buffer", "tri", { builtin: "builtin:tri" }, ["tristate", "3-state", "bus driver"]),
    ],
  },
  {
    id: "sequential", label: "Sequential", defaultOpen: true, items: [
      on("dff", "D Flip-Flop", "dff", { builtin: "builtin:dff" }, ["dff", "register bit", "flop"]),
      on("jkff", "JK Flip-Flop", "jkff", { libraryName: "JK Flip-Flop" }, ["jk", "flop"]),
      on("srlatch", "SR Latch", "srlatch", { libraryName: "SR Latch" }, ["sr", "latch", "set reset"]),
      on("dlatch", "D Latch", "dlatch", { libraryName: "D Latch" }, ["latch", "transparent"]),
      on("counter", "Counter (4-bit)", "counter", { libraryName: "4-bit Counter" }, ["count", "ripple"]),
      on("tff", "T Flip-Flop", "tff", { libraryName: "T Flip-Flop" }, ["toggle", "flop"]),
      on("register", "Register (4-bit)", "register", { libraryName: "Register (4-bit)" }, ["reg", "storage"]),
    ],
  },
  {
    id: "buses", label: "Buses", defaultOpen: false, items: [
      planned("splitter", "Splitter", "splitter", "digital", ["split", "bus", "slice"]),
      planned("merger", "Merger", "merger", "digital", ["merge", "combine", "bus"]),
    ],
  },
  {
    id: "arithmetic", label: "Arithmetic", defaultOpen: false, items: [
      on("halfadder", "Half Adder", "adder", { libraryName: "Half Adder" }, ["add", "sum"]),
      on("fulladder", "Full Adder", "adder", { libraryName: "Full Adder" }, ["add", "carry", "sum"]),
    ],
  },
  {
    id: "coders", label: "Decoders / Encoders", defaultOpen: true, items: [
      on("decoder", "2→4 Decoder", "decoder", { libraryName: "2→4 Decoder" }, ["decode", "demux", "1-of-n"]),
      on("encoder", "4→2 Encoder", "encoder", { libraryName: "4→2 Encoder" }, ["encode", "priority"]),
      planned("mux", "Multiplexer", "mux", "digital", ["mux", "selector", "select"]),
      planned("demux", "Demultiplexer", "demux", "digital", ["demux", "distribute"]),
    ],
  },
  {
    id: "outputs", label: "Displays / Outputs", defaultOpen: true, items: [
      on("output", "Output / LED", "out", { builtin: "io:out" }, ["led", "indicator", "lamp", "out"]),
      on("seg7", "7-Seg Decoder", "seg7", { libraryName: "7-Seg Decoder" }, ["seven segment", "display", "hex"]),
      planned("seg7disp", "7-Segment Display", "seg7", "digital", ["seven segment", "display"]),
    ],
  },
  {
    id: "debug", label: "Meters / Debug", defaultOpen: false, items: [
      {
        id: "probe", label: "Probe", icon: "probe", enabled: false, aliases: ["watch", "scope", "measure"],
        tooltip: "Select a wire, then add it to Watches / the timing diagram to probe it.",
      },
    ],
  },
  { id: "mychips", label: "My Chips", defaultOpen: true, dynamic: "userParts", items: [] },
  {
    id: "analog", label: "Analog / Electrical", defaultOpen: false, items: [
      planned("resistor", "Resistor", "resistor", "analog", ["r", "ohm"]),
      planned("pot", "Potentiometer", "pot", "analog", ["pot", "variable resistor"]),
      planned("capacitor", "Capacitor", "capacitor", "analog", ["cap", "c"]),
      planned("inductor", "Inductor", "inductor", "analog", ["coil", "l"]),
      planned("transformer", "Transformer", "transformer", "analog", ["xfmr"]),
      planned("ground", "Ground", "ground", "analog", ["gnd", "earth"]),
      planned("vsource", "Voltage Source", "vsource", "analog", ["volt", "dc"]),
      planned("isource", "Current Source", "isource", "analog", ["current", "amp"]),
      planned("sine", "Sine Source", "sine", "analog", ["ac", "sinusoid"]),
      planned("pulse", "Pulse Source", "pulse", "analog", ["square", "pwm"]),
      planned("diode", "Diode", "diode", "analog", ["rectifier"]),
      planned("zener", "Zener Diode", "zener", "analog", ["zener"]),
      planned("led_a", "LED", "led", "analog", ["light"]),
      planned("rgbled", "RGB LED", "rgbled", "analog", ["rgb"]),
      planned("npn", "NPN Transistor", "npn", "analog", ["bjt", "transistor"]),
      planned("pnp", "PNP Transistor", "pnp", "analog", ["bjt", "transistor"]),
      planned("nmos", "NMOS", "nmos", "analog", ["mosfet", "fet"]),
      planned("pmos", "PMOS", "pmos", "analog", ["mosfet", "fet"]),
      planned("opamp", "Op-Amp", "opamp", "analog", ["amplifier", "opamp"]),
      planned("timer555", "555 Timer", "timer", "analog", ["555"]),
      planned("adc", "ADC", "adc", "analog", ["analog to digital"]),
      planned("dac", "DAC", "dac", "analog", ["digital to analog"]),
      planned("voltmeter", "Voltmeter", "meterV", "analog", ["volt", "meter"]),
      planned("ammeter", "Ammeter", "meterA", "analog", ["amp", "meter"]),
      planned("ohmmeter", "Ohmmeter", "meterO", "analog", ["ohm", "meter"]),
      planned("lamp", "Lamp", "lamp", "analog", ["bulb", "light"]),
      planned("motor", "DC Motor", "motor", "analog", ["motor"]),
      planned("relay", "Relay", "relay", "analog", ["relay"]),
      planned("csource", "Controlled Source", "csource", "analog", ["vcvs", "vccs", "ccvs", "cccs"]),
    ],
  },
];

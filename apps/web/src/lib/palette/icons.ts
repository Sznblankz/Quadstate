/**
 * Monochrome schematic-style icons for the component palette. Each entry is the
 * INNER markup of a 24×24 SVG; the tile wraps it with
 * `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ...>`.
 *
 * Rules: stroke/fill use `currentColor` only — NEVER signal-state colors
 * (those are reserved for live circuit state on the canvas). Drawn in
 * QuadState's own style; not derived from any other product's assets.
 */

const IN2 = '<path d="M2 9h6M2 15h6"/>';
const OUT = '<path d="M19 12h3"/>';
const BUBBLE = '<circle cx="20.3" cy="12" r="1.3"/><path d="M21.6 12h1.4"/>';

const AND_BODY = '<path d="M8 5h4a7 7 0 0 1 0 14h-4z"/>';
const OR_BODY = '<path d="M5 5c3 3 3 11 0 14c7 0 11-3 14-7c-3-4-7-7-14-7z"/>';
const OR_IN = '<path d="M2 9h3.4M2 15h3.4"/>';
const TRI_BODY = '<path d="M8 5v14l9-7z"/>';

/** Generic IC chip: rectangle, pin stubs, centered abbreviation. */
function chip(abbr: string): string {
  const fs = abbr.length > 2 ? 4.6 : 6;
  return '<rect x="5.5" y="4.5" width="13" height="15" rx="1.5"/>'
    + '<path d="M2.5 8h3M2.5 16h3M18.5 8h3M18.5 16h3"/>'
    + `<text x="12" y="12" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${abbr}</text>`;
}

/** Flip-flop / latch box with a letter and an optional clock notch. */
function ff(letter: string, clocked: boolean): string {
  const fs = letter.length > 1 ? 5 : 6.5;
  return '<rect x="6" y="4.5" width="12" height="15" rx="1"/>'
    + '<path d="M2.5 8h3.5M2.5 16h3.5M18 8h3.5M18 16h3.5"/>'
    + (clocked ? '<path d="M6 14l2.4 1.6L6 17.2"/>' : '')
    + `<text x="12.4" y="11.4" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${letter}</text>`;
}

/** Circle symbol with a centered glyph (sources, meters, motor, lamp). */
function circleLabel(txt: string): string {
  return '<circle cx="12" cy="12" r="7.5"/><path d="M2 12h2.5M19.5 12h2.5"/>'
    + `<text x="12" y="12" font-size="7" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">${txt}</text>`;
}

const ICONS: Record<string, string> = {
  // --- inputs / sources ---
  in: '<rect x="4" y="7" width="8" height="10" rx="2"/><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none"/><path d="M12 12h9"/>',
  switch: '<circle cx="5" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M5 14l9-4M19 14h-2M5 14H2M19 14h3"/>',
  button: '<rect x="9" y="9" width="6" height="4" rx="2"/><path d="M12 9V6M4 16h5M15 16h5M9 16v-2M15 16v-2"/>',
  clock: '<path d="M3 16h3V8h4v8h4V8h4v8h3"/>',
  const0: '<rect x="5" y="6.5" width="11" height="11" rx="1.5"/><path d="M16 12h6"/><text x="10.5" y="12" font-size="7" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">0</text>',
  const1: '<rect x="5" y="6.5" width="11" height="11" rx="1.5"/><path d="M16 12h6"/><text x="10.5" y="12" font-size="7" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none">1</text>',

  // --- gates ---
  and: AND_BODY + IN2 + OUT,
  nand: AND_BODY + IN2 + BUBBLE,
  or: OR_BODY + OR_IN + OUT,
  nor: OR_BODY + OR_IN + BUBBLE,
  xor: OR_BODY + '<path d="M2.5 5c3 3 3 11 0 14"/><path d="M0.5 9h3.4M0.5 15h3.4"/>' + OUT,
  xnor: OR_BODY + '<path d="M2.5 5c3 3 3 11 0 14"/><path d="M0.5 9h3.4M0.5 15h3.4"/>' + BUBBLE,
  not: TRI_BODY + '<path d="M2 12h6"/>' + '<circle cx="18.3" cy="12" r="1.3"/><path d="M19.6 12h2.4"/>',
  buf: TRI_BODY + '<path d="M2 12h6"/><path d="M17 12h5"/>',
  tri: TRI_BODY + '<path d="M2 12h6"/><path d="M17 12h5"/><path d="M12.5 4v4.5"/>',

  // --- sequential ---
  dff: ff('D', true),
  tff: ff('T', true),
  jkff: ff('JK', true),
  srlatch: ff('SR', false),
  dlatch: ff('D', false),
  register: chip('REG'),
  counter: chip('CTR'),

  // --- buses ---
  splitter: '<path d="M3 12h7M10 12l8-5M10 12h8M10 12l8 5"/>',
  merger: '<path d="M21 12h-7M14 12l-8-5M14 12H6M14 12l-8 5"/>',

  // --- arithmetic ---
  adder: chip('Σ'),

  // --- decoders / encoders ---
  mux: '<path d="M7 5l8 4v6l-8 4z"/><path d="M2 9h5M2 15h5M15 12h7M11 19v3"/>',
  demux: '<path d="M17 5l-8 4v6l8 4z"/><path d="M22 9h-5M22 15h-5M9 12H2M13 19v3"/>',
  decoder: chip('DEC'),
  encoder: chip('ENC'),

  // --- displays / outputs ---
  out: '<circle cx="13" cy="12" r="6"/><path d="M2 12h5"/>',
  seg7: '<path d="M9 5h6M9 5v7M15 5v7M9 12h6M9 12v7M15 12v7M9 19h6"/>',

  // --- meters / debug ---
  probe: '<circle cx="10" cy="10" r="5"/><path d="M13.5 13.5l6 6"/>',

  // --- my chips ---
  chip: '<rect x="6" y="5" width="12" height="14" rx="1.5"/><path d="M3 9h3M3 15h3M18 9h3M18 15h3"/><circle cx="12" cy="12" r="2.2"/>',

  // --- analog / electrical (all disabled "planned") ---
  resistor: '<path d="M2 12h3l1.5-4 3 8 3-8 3 8 1.5-4h3"/>',
  pot: '<path d="M2 12h3l1.5-4 3 8 3-8 3 8 1.5-4h3"/><path d="M12 22v-6l-2 2"/>',
  capacitor: '<path d="M2 12h8M14 12h8M10 6v12M14 6v12"/>',
  inductor: '<path d="M2 13h2"/><path d="M4 13a2 2 0 0 1 4 0a2 2 0 0 1 4 0a2 2 0 0 1 4 0"/><path d="M16 13h2"/>',
  transformer: '<path d="M10 5v14M14 5v14"/><path d="M8 7a2 2 0 0 0 0 3a2 2 0 0 0 0 3"/><path d="M16 7a2 2 0 0 1 0 3a2 2 0 0 1 0 3"/>',
  ground: '<path d="M12 4v9M7 13h10M9 16h6M11 19h2"/>',
  vsource: '<circle cx="12" cy="12" r="7"/><path d="M2 12h3M19 12h3"/><path d="M9.5 8h3M11 6.5v3M9.5 16h3"/>',
  isource: '<circle cx="12" cy="12" r="7"/><path d="M2 12h3M19 12h3"/><path d="M12 8.5v7M9.5 13l2.5 3 2.5-3"/>',
  sine: '<circle cx="12" cy="12" r="7"/><path d="M2 12h3M19 12h3"/><path d="M8 12q2-4 4 0t4 0"/>',
  pulse: '<circle cx="12" cy="12" r="7"/><path d="M2 12h3M19 12h3"/><path d="M8 14h2v-4h3v4h3"/>',
  diode: '<path d="M2 12h7M9 8l7 4-7 4zM16 7v10M16 12h6"/>',
  zener: '<path d="M2 12h7M9 8l7 4-7 4zM16 7l-1.5 1.5M16 7v10M16 17l1.5-1.5M16 12h6"/>',
  led: '<path d="M3 12h6M9 8l7 4-7 4zM16 7v10M16 12h5"/><path d="M13 6l2.5-2.5M15 3.5h2v2"/>',
  rgbled: '<path d="M3 12h6M9 8l7 4-7 4zM16 7v10M16 12h5"/><path d="M12 5l2-2M15 3h2v2"/><path d="M15 5l2-2M18 3h2v2"/>',
  npn: '<circle cx="12" cy="12" r="8"/><path d="M3 12h5M8 7v10M8 10l6-4M14 4v3M8 14l6 4M14 17v3"/><path d="M11.5 16.2l2.5 1.8-1-2.7"/>',
  pnp: '<circle cx="12" cy="12" r="8"/><path d="M3 12h5M8 7v10M8 10l6-4M14 4v3M8 14l6 4M14 17v3"/><path d="M8.3 11.3l2.7-1 0.9 2.6"/>',
  nmos: '<path d="M3 12h4M7 7v10M10 7v10"/><path d="M10 8h7M10 16h7M17 6v5M17 13v5M17 12h5"/>',
  pmos: '<path d="M3 12h4M7 7v10M10 7v10"/><path d="M10 8h7M10 16h7M17 6v5M17 13v5M17 12h5"/><circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none"/>',
  opamp: '<path d="M6 4v16l13-8z"/><path d="M2 9h4M2 15h4M19 12h3"/><path d="M3.4 9h1.4M4.1 8.3v1.4M3.4 15h1.4"/>',
  timer: chip('555'),
  adc: chip('ADC'),
  dac: chip('DAC'),
  meterV: circleLabel('V'),
  meterA: circleLabel('A'),
  meterO: circleLabel('Ω'),
  lamp: '<circle cx="12" cy="12" r="7"/><path d="M2 12h3M19 12h3M8 8l8 8M16 8l-8 8"/>',
  motor: circleLabel('M'),
  relay: '<rect x="3.5" y="8" width="5" height="8" rx="1"/><path d="M6 8v8" stroke-dasharray="2 1.5"/><path d="M13 10h7M13 10l-1.5 5.5M20 16h-7"/>',
  csource: '<path d="M12 4l8 8-8 8-8-8z"/><path d="M2 12h4M18 12h4M12 8.5v7M9.5 13l2.5 3 2.5-3"/>',
};

/** Inner SVG markup for a palette icon, falling back to the generic chip box. */
export function iconSvg(key: string): string {
  return ICONS[key] ?? chip('?');
}

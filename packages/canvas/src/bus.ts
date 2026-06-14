import { HI, LO, X, Z } from "@logicsim/engine";

/**
 * Bus value helpers shared by the renderer (wire colour) and the app shell
 * (watch formatting), so both agree on how a multi-bit net reads.
 *
 * Aggregate precedence (VISUAL doc 9): any X → X, any Z → Z, all-1 → HI,
 * all-0 → LO, otherwise a defined mixed value (MIXED — drawn as a calm solid,
 * no glow). Values are LSB-first.
 */
export const MIXED = 5;

export function aggregateBus(values: number[]): number {
  if (values.length === 0) return Z;
  let all1 = true, all0 = true, anyX = false, anyZ = false;
  for (const v of values) {
    if (v === X) anyX = true;
    else if (v === Z) anyZ = true;
    if (v !== HI) all1 = false;
    if (v !== LO) all0 = false;
  }
  if (anyX) return X;
  if (anyZ) return Z;
  if (all1) return HI;
  if (all0) return LO;
  return MIXED;
}

const HEX = "0123456789ABCDEF";

/** Hex string, 4-state honest: a nibble with any X/Z shows "X"/"Z". */
export function busHex(values: number[]): string {
  const nibbles = Math.max(1, Math.ceil(values.length / 4));
  let out = "";
  for (let n = nibbles - 1; n >= 0; n--) {
    let flag: string | null = null;
    let v = 0;
    for (let b = 0; b < 4; b++) {
      const bit = values[n * 4 + b] ?? LO;
      if (bit === X) { flag = "X"; break; }
      if (bit === Z) { flag = "Z"; break; }
      if (bit === HI) v |= 1 << b;
    }
    out += flag ?? HEX[v];
  }
  return "0x" + out;
}

/** Binary string, MSB-first, with X/Z shown literally. */
export function busBin(values: number[]): string {
  let out = "";
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    out += v === HI ? "1" : v === LO ? "0" : v === X ? "X" : "Z";
  }
  return "0b" + out;
}

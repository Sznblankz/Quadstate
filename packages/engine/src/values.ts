/**
 * 4-value logic: LO, HI, X (unknown/conflict), Z (high impedance).
 * Values are 2-bit codes so a pair packs into a 4-bit lookup-table index.
 * All gate evaluation is table lookups — no branching in the hot path,
 * and trivially portable to WASM later.
 */

export const LO = 0;
export const HI = 1;
export const X = 2;
export const Z = 3;

export type Logic = 0 | 1 | 2 | 3;

/** A gate input reads a floating (Z) net as unknown. */
export function asInput(v: number): number {
  return v === Z ? X : v;
}

function isKnown(v: number): boolean {
  return v === LO || v === HI;
}

function build2(fn: (a: number, b: number) => number): Uint8Array {
  const t = new Uint8Array(16);
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      t[(a << 2) | b] = fn(asInput(a), asInput(b));
    }
  }
  return t;
}

/** Binary ops indexed by `(a << 2) | b`. Z inputs behave as X. */
export const AND2 = build2((a, b) =>
  a === LO || b === LO ? LO : a === HI && b === HI ? HI : X,
);
export const OR2 = build2((a, b) =>
  a === HI || b === HI ? HI : a === LO && b === LO ? LO : X,
);
export const XOR2 = build2((a, b) => (isKnown(a) && isKnown(b) ? a ^ b : X));

/** Unary NOT indexed by the raw value. Z behaves as X. */
export const NOT1 = new Uint8Array(4);
for (let a = 0; a < 4; a++) {
  const ia = asInput(a);
  NOT1[a] = ia === LO ? HI : ia === HI ? LO : X;
}

/**
 * Net resolution for multi-driver nets, indexed by `(a << 2) | b`.
 * All drivers are strong: Z defers to the other driver, agreement wins,
 * disagreement (or any X) resolves to X. Folding this table over all
 * drivers of a net is associative and commutative, so driver order
 * cannot affect the result.
 */
export const RES2 = (() => {
  const t = new Uint8Array(16);
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      t[(a << 2) | b] = a === Z ? b : b === Z ? a : a === b ? a : X;
    }
  }
  return t;
})();

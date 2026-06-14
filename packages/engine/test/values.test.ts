import { describe, expect, it } from "vitest";
import { AND2, OR2, XOR2, NOT1, RES2, LO, HI, X, Z } from "../src/values.js";

const ALL = [LO, HI, X, Z];
const op = (t: Uint8Array, a: number, b: number) => t[(a << 2) | b];

describe("4-value tables", () => {
  it("AND: 0 dominates, 1&1=1, unknown otherwise", () => {
    expect(op(AND2, LO, HI)).toBe(LO);
    expect(op(AND2, LO, X)).toBe(LO);
    expect(op(AND2, LO, Z)).toBe(LO);
    expect(op(AND2, HI, HI)).toBe(HI);
    expect(op(AND2, HI, X)).toBe(X);
    expect(op(AND2, HI, Z)).toBe(X); // Z reads as X at a gate input
    expect(op(AND2, X, Z)).toBe(X);
  });

  it("OR: 1 dominates, 0|0=0, unknown otherwise", () => {
    expect(op(OR2, HI, LO)).toBe(HI);
    expect(op(OR2, HI, X)).toBe(HI);
    expect(op(OR2, HI, Z)).toBe(HI);
    expect(op(OR2, LO, LO)).toBe(LO);
    expect(op(OR2, LO, X)).toBe(X);
    expect(op(OR2, LO, Z)).toBe(X);
  });

  it("XOR: any unknown poisons", () => {
    expect(op(XOR2, LO, HI)).toBe(HI);
    expect(op(XOR2, HI, HI)).toBe(LO);
    expect(op(XOR2, HI, X)).toBe(X);
    expect(op(XOR2, LO, Z)).toBe(X);
  });

  it("NOT inverts known values, X otherwise", () => {
    expect(NOT1[LO]).toBe(HI);
    expect(NOT1[HI]).toBe(LO);
    expect(NOT1[X]).toBe(X);
    expect(NOT1[Z]).toBe(X);
  });

  it("resolution: Z defers, agreement wins, conflict is X", () => {
    expect(op(RES2, Z, Z)).toBe(Z);
    expect(op(RES2, Z, HI)).toBe(HI);
    expect(op(RES2, LO, Z)).toBe(LO);
    expect(op(RES2, HI, HI)).toBe(HI);
    expect(op(RES2, HI, LO)).toBe(X);
    expect(op(RES2, X, Z)).toBe(X);
    expect(op(RES2, X, HI)).toBe(X);
  });

  it("resolution is commutative and associative (driver order can't matter)", () => {
    for (const a of ALL) {
      for (const b of ALL) {
        expect(op(RES2, a, b)).toBe(op(RES2, b, a));
        for (const c of ALL) {
          expect(op(RES2, op(RES2, a, b), c)).toBe(op(RES2, a, op(RES2, b, c)));
        }
      }
    }
  });
});

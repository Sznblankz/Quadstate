import { describe, expect, it } from "vitest";
import { partId, canonicalJson } from "../src/canonical.js";
import { sha256HexUtf8 } from "../src/sha256.js";
import { halfAdder } from "./parts.js";

describe("sha256", () => {
  it("matches the standard test vectors", () => {
    expect(sha256HexUtf8("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256HexUtf8("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("canonical part id", () => {
  it("is invariant under name, version, appearance, and internal id renames", () => {
    const base = partId(halfAdder());

    expect(partId(halfAdder({ name: "renamed", version: "9.9.9" }))).toBe(base);
    expect(partId(halfAdder({ appearance: { color: "red" } }))).toBe(base);

    const renamedIds = halfAdder();
    if (renamedIds.body.kind === "structural") {
      renamedIds.body.instances[0].id = "myXor";
      renamedIds.body.instances[1].id = "myAnd";
    }
    expect(partId(renamedIds)).toBe(base);
  });

  it("changes when structure changes", () => {
    const base = partId(halfAdder());
    const different = halfAdder();
    if (different.body.kind === "structural") {
      different.body.instances[0].part = "builtin:xnor";
    }
    expect(partId(different)).not.toBe(base);

    const widened = halfAdder();
    widened.interface.pins[0].width = 2;
    expect(partId(widened)).not.toBe(base);
  });

  it("canonical JSON sorts keys and rejects non-integers", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }))
      .toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    expect(() => canonicalJson({ x: 0.5 })).toThrow(/safe integers/);
  });

  it("is stable across runs (golden)", () => {
    expect(partId(halfAdder())).toMatchSnapshot();
  });
});

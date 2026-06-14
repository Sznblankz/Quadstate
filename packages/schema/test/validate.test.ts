import { describe, expect, it } from "vitest";
import { PartLibrary, SchemaError } from "../src/library.js";
import { validatePart } from "../src/validate.js";
import type { PartDefinition } from "../src/types.js";
import { halfAdder } from "./parts.js";

const lib = () => new PartLibrary();

function issuesOf(def: PartDefinition): string[] {
  const l = lib();
  return validatePart(def, (id) => l.resolveInterface(id)).map((i) => `${i.path}: ${i.message}`);
}

describe("validatePart", () => {
  it("accepts a well-formed structural part", () => {
    expect(issuesOf(halfAdder())).toEqual([]);
  });

  it("rejects unknown schema versions without parsing further", () => {
    const issues = issuesOf(halfAdder({ schemaVersion: 2 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/unsupported schema version 2/);
  });

  it("rejects the reserved params key", () => {
    const def = { ...halfAdder(), params: { width: 8 } } as unknown as PartDefinition;
    expect(issuesOf(def).join()).toMatch(/reserved/);
  });

  it("rejects widths outside 1..64 with the entity named", () => {
    const def = halfAdder();
    def.interface.pins[0].width = 65;
    const issues = issuesOf(def);
    expect(issues.join()).toMatch(/pin "a" width 65 outside 1\.\.64/);

    const def2 = halfAdder();
    def2.interface.pins[1].width = 0;
    expect(issuesOf(def2).join()).toMatch(/width 0 outside/);
  });

  it("rejects duplicate pin names and unknown parts", () => {
    const def = halfAdder();
    def.interface.pins[1].name = "a";
    expect(issuesOf(def).join()).toMatch(/duplicate pin name "a"/);

    const def2 = halfAdder();
    def2.body.kind === "structural" && (def2.body.instances[0].part = "builtin:nope");
    expect(issuesOf(def2).join()).toMatch(/unknown part "builtin:nope"/);
  });

  it("rejects width mismatches across a builtin instance", () => {
    const def = halfAdder();
    def.interface.pins[0].width = 8; // a is 8 wide, b stays 1
    expect(issuesOf(def).join()).toMatch(/width mismatch/);
  });

  it("rejects missing and superfluous connections", () => {
    const def = halfAdder();
    if (def.body.kind === "structural") {
      delete (def.body.instances[0].connections as Record<string, string>).b;
      def.body.instances[1].connections.zz = "a";
    }
    const joined = issuesOf(def).join();
    expect(joined).toMatch(/pin "b" of "builtin:xor" is not connected/);
    expect(joined).toMatch(/has no pin "zz"/);
  });

  it("rejects truth tables over the 16-input-bit limit and bad rows", () => {
    const tt: PartDefinition = {
      schemaVersion: 1,
      name: "big",
      version: "1.0.0",
      interface: {
        pins: [
          { name: "a", dir: "in", width: 17 },
          { name: "y", dir: "out", width: 1 },
        ],
      },
      body: { kind: "behavioral", truthTable: { inputs: ["a"], outputs: ["y"], rows: {} } },
    };
    expect(issuesOf(tt).join()).toMatch(/17 exceed the limit of 16/);

    const badRow: PartDefinition = {
      schemaVersion: 1,
      name: "bad",
      version: "1.0.0",
      interface: {
        pins: [
          { name: "a", dir: "in", width: 2 },
          { name: "y", dir: "out", width: 1 },
        ],
      },
      body: {
        kind: "behavioral",
        truthTable: { inputs: ["a"], outputs: ["y"], rows: { "0": "1" } },
      },
    };
    expect(issuesOf(badRow).join()).toMatch(/row key must be 2 binary digits/);
  });

  it("library.add throws SchemaError carrying the issue list", () => {
    const l = lib();
    const def = halfAdder({ version: "not-semver" });
    expect(() => l.add(def)).toThrow(SchemaError);
    try {
      l.add(def);
    } catch (e) {
      expect((e as SchemaError).issues[0].path).toBe("version");
    }
  });
});

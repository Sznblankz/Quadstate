import { describe, expect, it } from "vitest";
import { HI, LO } from "@logicsim/engine";
import { PartLibrary, instantiate } from "@logicsim/schema";
import { CircuitDocument } from "../src/model.js";
import { addComponent, addWire } from "../src/commands.js";
import { History } from "../src/undo.js";
import { createChipFromSelection } from "../src/chip.js";
import { exportProject } from "../src/export.js";
import { projectFromJson, projectToJson, replaceDocumentContents } from "../src/project.js";

function chipProject() {
  const doc = new CircuitDocument();
  const h = new History();
  const lib = new PartLibrary();
  const comp = (part: string, props = {}) => {
    const cmd = addComponent(doc, { part, x: 0, y: 0, rot: 0, props });
    h.execute(doc, cmd);
    return cmd.id;
  };
  const ioA = comp("io:in", { name: "a" });
  const ioY = comp("io:out", { name: "y" });
  const xor = comp("builtin:xor");
  const wire = (ports: Array<[number, string]>) =>
    h.execute(doc, addWire(doc, ports.map(([c, p]) => ({ component: c, pin: p }))));
  wire([[ioA, "pin"], [xor, "a"]]);
  wire([[ioA, "pin"], [xor, "b"]]);
  wire([[xor, "y"], [ioY, "pin"]]);
  const chip = createChipFromSelection(doc, lib, [xor], { name: "XA", version: "1.0.0" });
  h.execute(doc, chip.command);
  return { doc, lib, userParts: [{ id: chip.partId, name: "XA" }] };
}

describe("project files", () => {
  it("round-trips document + chip library and stays simulable", () => {
    const { doc, lib, userParts } = chipProject();
    const json = projectToJson(doc, userParts, lib);

    // Load into a COMPLETELY fresh library, as a new session would.
    const lib2 = new PartLibrary();
    const { doc: doc2, userParts: parts2 } = projectFromJson(json, lib2);

    expect([...doc2.components.keys()]).toEqual([...doc.components.keys()]);
    expect(doc2.nextId).toBe(doc.nextId);
    expect(parts2).toEqual(userParts); // same content-hash ids re-derived
    expect(lib2.get(parts2[0].id)?.name).toBe("XA");

    const { def } = exportProject(doc2, lib2, { name: "p", version: "1.0.0" });
    const live = instantiate(lib2, lib2.add(def));
    live.sim.setInput(live.elab.inputs.get("a")![0], HI, 5);
    live.sim.run(5);
    expect(live.sim.value(live.elab.outputs.get("y")![0])).toBe(LO); // XOR(a,a)=0
  });

  it("rejects tampered part definitions via the hash check", () => {
    const { doc, lib, userParts } = chipProject();
    const file = JSON.parse(projectToJson(doc, userParts, lib));
    file.parts[0].def.body.instances[0].part = "builtin:xnor"; // tamper
    expect(() => projectFromJson(JSON.stringify(file), new PartLibrary()))
      .toThrow(/re-hashed to a different id/);
  });

  it("rejects unknown file versions and dangling part references", () => {
    const { doc, lib, userParts } = chipProject();
    const v9 = JSON.parse(projectToJson(doc, userParts, lib));
    v9.fileVersion = 9;
    expect(() => projectFromJson(JSON.stringify(v9), new PartLibrary()))
      .toThrow(/unsupported project file version 9/);

    const missing = JSON.parse(projectToJson(doc, userParts, lib));
    missing.parts = []; // drop the library the document depends on
    expect(() => projectFromJson(JSON.stringify(missing), new PartLibrary()))
      .toThrow(/unknown part/);
  });

  it("round-trips tracked signals (wire + path), defaulting to none for older files", () => {
    const { doc, lib, userParts } = chipProject();
    const tracked = [
      { kind: "wire" as const, wireId: 7 },
      { kind: "path" as const, path: "c1/y" },
    ];
    const json = projectToJson(doc, userParts, lib, tracked);
    const { tracked: back } = projectFromJson(json, new PartLibrary());
    expect(back).toEqual(tracked);

    // Older files (no trackedSignals field) load with an empty list, not undefined.
    const legacy = JSON.parse(projectToJson(doc, userParts, lib));
    delete legacy.trackedSignals;
    expect(projectFromJson(JSON.stringify(legacy), new PartLibrary()).tracked).toEqual([]);
  });

  it("replaceDocumentContents preserves instance identity", () => {
    const { doc } = chipProject();
    const target = new CircuitDocument();
    const before = target.revision;
    replaceDocumentContents(target, doc);
    expect(target.components.size).toBe(doc.components.size);
    expect(target.nextId).toBe(doc.nextId);
    expect(target.revision).toBe(before + 1);
  });
});

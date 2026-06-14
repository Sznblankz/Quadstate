import { describe, expect, it } from "vitest";
import { HI, LO } from "@logicsim/engine";
import { PartLibrary, instantiate } from "@logicsim/schema";
import { CircuitDocument } from "../src/model.js";
import { addComponent, addWire } from "../src/commands.js";
import { History } from "../src/undo.js";
import { createChipFromSelection } from "../src/chip.js";
import { exportProject } from "../src/export.js";

function halfAdderDoc() {
  const doc = new CircuitDocument();
  const h = new History();
  const lib = new PartLibrary();
  const comp = (part: string, x: number, props = {}) => {
    const cmd = addComponent(doc, { part, x, y: 0, rot: 0, props });
    h.execute(doc, cmd);
    return cmd.id;
  };
  const ioA = comp("io:in", 0, { name: "a" });
  const ioB = comp("io:in", 0, { name: "b" });
  const ioS = comp("io:out", 200, { name: "s" });
  const ioC = comp("io:out", 200, { name: "c" });
  const xor = comp("builtin:xor", 100);
  const and = comp("builtin:and", 100);
  const wire = (ports: Array<[number, string]>) => {
    const cmd = addWire(doc, ports.map(([component, pin]) => ({ component, pin })));
    h.execute(doc, cmd);
    return cmd.id;
  };
  wire([[ioA, "pin"], [xor, "a"], [and, "a"]]);
  wire([[ioB, "pin"], [xor, "b"], [and, "b"]]);
  wire([[xor, "y"], [ioS, "pin"]]);
  wire([[and, "y"], [ioC, "pin"]]);
  return { doc, h, lib, ioA, ioB, ioS, ioC, xor, and };
}

describe("createChipFromSelection", () => {
  it("replaces the selection with one instance and stays simulable", () => {
    const { doc, h, lib, xor, and } = halfAdderDoc();
    const before = { components: doc.components.size, wires: doc.wires.size };

    const { command, partId, componentId } =
      createChipFromSelection(doc, lib, [xor, and], { name: "HA", version: "1.0.0" });
    h.execute(doc, command);

    // 4 io + 1 chip; all 4 wires survive, rewired to chip pins.
    expect(doc.components.size).toBe(5);
    expect(doc.wires.size).toBe(4);
    const chip = doc.components.get(componentId)!;
    expect(chip.part).toBe(partId);
    for (const w of doc.wires.values()) {
      expect(w.ports.some((p) => p.component === componentId)).toBe(true);
      expect(w.ports.some((p) => p.component === xor || p.component === and)).toBe(false);
    }

    // The chip definition: 2 in pins (driven from outside), 2 out pins.
    const def = lib.get(partId)!;
    expect(def.interface.pins.map((p) => p.dir).sort()).toEqual(["in", "in", "out", "out"]);
    expect(def.body.kind === "structural" && def.body.instances).toHaveLength(2);

    // Whole project still compiles and computes a half adder.
    const { def: projDef } = exportProject(doc, lib, { name: "p", version: "1.0.0" });
    const live = instantiate(lib, lib.add(projDef));
    live.sim.setInput(live.elab.inputs.get("a")![0], HI, 10);
    live.sim.setInput(live.elab.inputs.get("b")![0], HI, 10);
    live.sim.run(10);
    expect(live.sim.value(live.elab.outputs.get("s")![0])).toBe(LO);
    expect(live.sim.value(live.elab.outputs.get("c")![0])).toBe(HI);

    // Undo restores the original structure exactly.
    h.undo(doc);
    expect(doc.components.size).toBe(before.components);
    expect(doc.wires.size).toBe(before.wires);
    expect(doc.components.has(componentId)).toBe(false);
    expect(doc.components.has(xor)).toBe(true);
    for (const w of doc.wires.values()) {
      expect(w.ports.some((p) => p.component === componentId)).toBe(false);
    }

    // Redo reinserts the SAME chip component id (stable-ID rule).
    h.redo(doc);
    expect(doc.components.has(componentId)).toBe(true);
  });

  it("fully-inside wires become internal nets of the chip", () => {
    const doc = new CircuitDocument();
    const h = new History();
    const lib = new PartLibrary();
    const comp = (part: string, x: number, props = {}) => {
      const cmd = addComponent(doc, { part, x, y: 0, rot: 0, props });
      h.execute(doc, cmd);
      return cmd.id;
    };
    const ioIn = comp("io:in", 0, { name: "d" });
    const ioOut = comp("io:out", 300, { name: "q" });
    const n1 = comp("builtin:not", 100);
    const n2 = comp("builtin:not", 200);
    const wire = (ports: Array<[number, string]>) =>
      h.execute(doc, addWire(doc, ports.map(([c, p]) => ({ component: c, pin: p }))));
    wire([[ioIn, "pin"], [n1, "a"]]);
    wire([[n1, "y"], [n2, "a"]]); // fully inside the selection
    wire([[n2, "y"], [ioOut, "pin"]]);

    const { command, partId } =
      createChipFromSelection(doc, lib, [n1, n2], { name: "BUF2", version: "1.0.0" });
    h.execute(doc, command);

    const def = lib.get(partId)!;
    expect(def.interface.pins).toHaveLength(2);
    expect(def.body.kind === "structural" &&
      def.body.nets.some((n) => n.name.startsWith("w"))).toBe(true);
    expect(doc.wires.size).toBe(2); // the internal wire was absorbed

    // Double inverter behaves as a buffer end-to-end.
    const { def: projDef } = exportProject(doc, lib, { name: "p", version: "1.0.0" });
    const live = instantiate(lib, lib.add(projDef));
    live.sim.setInput(live.elab.inputs.get("d")![0], HI, 5);
    live.sim.run(5);
    expect(live.sim.value(live.elab.outputs.get("q")![0])).toBe(HI);
  });

  it("rejects io parts inside, grouped members, and pinless selections", () => {
    const { doc, lib, ioA, xor, and } = halfAdderDoc();
    expect(() => createChipFromSelection(doc, lib, [ioA, xor], { name: "x", version: "1.0.0" }))
      .toThrow(/IO pins cannot be inside/);
    expect(() => createChipFromSelection(doc, lib, [], { name: "x", version: "1.0.0" }))
      .toThrow(/at least one component/);

    // An isolated gate with nothing connected has no pins -> friendly error.
    const lone = new CircuitDocument();
    const h = new History();
    const cmd = addComponent(lone, { part: "builtin:and", x: 0, y: 0, rot: 0, props: {} });
    h.execute(lone, cmd);
    expect(() => createChipFromSelection(lone, lib, [cmd.id], { name: "x", version: "1.0.0" }))
      .toThrow(/no external connections/);
    void and;
  });

  it("merged nets cross the boundary as ONE pin (wire-tool fan-out)", () => {
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
    // Two separate wires from the io port to both gate inputs: one net.
    h.execute(doc, addWire(doc, [{ component: ioA, pin: "pin" }, { component: xor, pin: "a" }]));
    h.execute(doc, addWire(doc, [{ component: ioA, pin: "pin" }, { component: xor, pin: "b" }]));
    h.execute(doc, addWire(doc, [{ component: xor, pin: "y" }, { component: ioY, pin: "pin" }]));

    const { command, partId, componentId } =
      createChipFromSelection(doc, lib, [xor], { name: "XA", version: "1.0.0" });
    h.execute(doc, command);

    // One in pin (the merged fan-out net), one out pin.
    const def = lib.get(partId)!;
    expect(def.interface.pins.map((p) => `${p.dir}:${p.name}`).sort())
      .toEqual(["in:in1", "out:out1"]);

    // Both fan-out wires now terminate at the SAME chip pin.
    const chipPorts = [...doc.wires.values()]
      .flatMap((w) => w.ports)
      .filter((p) => p.component === componentId);
    expect(chipPorts.map((p) => p.pin).sort()).toEqual(["in1", "in1", "out1"]);

    // Still simulates: XOR(a, a) = 0.
    const { def: projDef } = exportProject(doc, lib, { name: "p", version: "1.0.0" });
    const live = instantiate(lib, lib.add(projDef));
    live.sim.setInput(live.elab.inputs.get("a")![0], HI, 5);
    live.sim.run(5);
    expect(live.sim.value(live.elab.outputs.get("y")![0])).toBe(LO);

    // Undo restores the original three wires untouched.
    h.undo(doc);
    expect(doc.wires.size).toBe(3);
    expect([...doc.wires.values()].every((w) =>
      w.ports.every((p) => p.component !== componentId))).toBe(true);
  });

  it("chips nest: a chip can contain another chip", () => {
    const { doc, h, lib, xor, and } = halfAdderDoc();
    const first = createChipFromSelection(doc, lib, [xor, and], { name: "HA", version: "1.0.0" });
    h.execute(doc, first.command);

    // Wrap the HA chip itself into another chip.
    const second = createChipFromSelection(
      doc, lib, [first.componentId], { name: "WRAP", version: "1.0.0" });
    h.execute(doc, second.command);

    const wrapDef = lib.get(second.partId)!;
    expect(wrapDef.body.kind === "structural" &&
      wrapDef.body.instances[0].part).toBe(first.partId);

    const { def: projDef } = exportProject(doc, lib, { name: "p", version: "1.0.0" });
    const live = instantiate(lib, lib.add(projDef));
    live.sim.setInput(live.elab.inputs.get("a")![0], HI, 10);
    live.sim.setInput(live.elab.inputs.get("b")![0], LO, 10);
    live.sim.run(10);
    expect(live.sim.value(live.elab.outputs.get("s")![0])).toBe(HI);
  });
});

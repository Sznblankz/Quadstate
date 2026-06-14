import { describe, expect, it } from "vitest";
import { LO, HI } from "@logicsim/engine";
import { PartLibrary, instantiate } from "@logicsim/schema";
import { CircuitDocument } from "../src/model.js";
import { addComponent, addWire } from "../src/commands.js";
import { History } from "../src/undo.js";
import { exportAsPart, exportProject } from "../src/export.js";

/**
 * The M2 end-to-end test: build a half adder with document commands,
 * export it as a part definition, register it, elaborate it, and verify
 * it computes — the full doc -> JSON -> netlist -> simulation pipeline.
 */
describe("document -> part -> simulation", () => {
  it("a half adder built from commands simulates correctly", () => {
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

    const wire = (ports: Array<[number, string]>) =>
      h.execute(doc, addWire(doc, ports.map(([component, pin]) => ({ component, pin }))));
    wire([[ioA, "pin"], [xor, "a"], [and, "a"]]);
    wire([[ioB, "pin"], [xor, "b"], [and, "b"]]);
    wire([[xor, "y"], [ioS, "pin"]]);
    wire([[and, "y"], [ioC, "pin"]]);

    const def = exportAsPart(doc, lib, { name: "doc-half-adder", version: "1.0.0" });
    expect(def.interface.pins.map((p) => `${p.dir}:${p.name}`))
      .toEqual(["in:a", "in:b", "out:s", "out:c"]);
    // Instance ids derive from stable entity ids.
    expect(def.body.kind === "structural" &&
      def.body.instances.map((i) => i.id)).toEqual([`c${xor}`, `c${and}`]);

    const id = lib.add(def);
    const live = instantiate(lib, id);
    const a = live.elab.inputs.get("a")![0];
    const b = live.elab.inputs.get("b")![0];

    live.sim.setInput(a, HI, 10);
    live.sim.setInput(b, HI, 10);
    live.sim.run(10);
    expect(live.sim.value(live.elab.outputs.get("s")![0])).toBe(LO);
    expect(live.sim.value(live.elab.outputs.get("c")![0])).toBe(HI);

    live.sim.setInput(b, LO, 20);
    live.sim.run(20);
    expect(live.sim.value(live.elab.outputs.get("s")![0])).toBe(HI);
    expect(live.sim.value(live.elab.outputs.get("c")![0])).toBe(LO);
  });

  it("wires sharing a port merge into one electrical net (wire-tool fan-out)", () => {
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
    // The wire tool's natural output: TWO 2-port wires from the same io
    // port, fanning out to both gate inputs.
    h.execute(doc, addWire(doc, [{ component: ioA, pin: "pin" }, { component: xor, pin: "a" }]));
    h.execute(doc, addWire(doc, [{ component: ioA, pin: "pin" }, { component: xor, pin: "b" }]));
    h.execute(doc, addWire(doc, [{ component: xor, pin: "y" }, { component: ioY, pin: "pin" }]));

    const { def, wireNet } = exportProject(doc, lib, { name: "p", version: "1.0.0" });
    // Both fan-out wires map to the same net: pin "a".
    const names = [...wireNet.values()];
    expect(names.filter((n) => n === "a")).toHaveLength(2);

    // XOR(a, a) = 0 — and it actually simulates.
    const live = instantiate(lib, lib.add(def));
    live.sim.setInput(live.elab.inputs.get("a")![0], HI, 5);
    live.sim.run(5);
    expect(live.sim.value(live.elab.outputs.get("y")![0])).toBe(LO);
  });

  it("io:in wired straight to io:out gets a synthesized buffer", () => {
    const doc = new CircuitDocument();
    const h = new History();
    const lib = new PartLibrary();
    const ioA = addComponent(doc, { part: "io:in", x: 0, y: 0, rot: 0, props: { name: "a" } });
    h.execute(doc, ioA);
    const ioY = addComponent(doc, { part: "io:out", x: 0, y: 0, rot: 0, props: { name: "y" } });
    h.execute(doc, ioY);
    h.execute(doc, addWire(doc, [
      { component: ioA.id, pin: "pin" }, { component: ioY.id, pin: "pin" },
    ]));

    const { def } = exportProject(doc, lib, { name: "p", version: "1.0.0" });
    expect(def.body.kind === "structural" &&
      def.body.instances.some((i) => i.part === "builtin:buf")).toBe(true);

    const live = instantiate(lib, lib.add(def));
    live.sim.setInput(live.elab.inputs.get("a")![0], HI, 5);
    live.sim.run(5);
    expect(live.sim.value(live.elab.outputs.get("y")![0])).toBe(HI);
  });

  it("rejects two input pins on one net", () => {
    const doc = new CircuitDocument();
    const h = new History();
    const lib = new PartLibrary();
    const a = addComponent(doc, { part: "io:in", x: 0, y: 0, rot: 0, props: { name: "a" } });
    h.execute(doc, a);
    const b = addComponent(doc, { part: "io:in", x: 0, y: 0, rot: 0, props: { name: "b" } });
    h.execute(doc, b);
    h.execute(doc, addWire(doc, [
      { component: a.id, pin: "pin" }, { component: b.id, pin: "pin" },
    ]));
    expect(() => exportProject(doc, lib, { name: "p", version: "1.0.0" }))
      .toThrow(/input pins "a" and "b" are on the same net/);
  });

  it("unconnected pins become private floating nets, not errors", () => {
    const doc = new CircuitDocument();
    const h = new History();
    const lib = new PartLibrary();
    const ioY = addComponent(doc, { part: "io:out", x: 0, y: 0, rot: 0, props: { name: "y" } });
    h.execute(doc, ioY);
    const not = addComponent(doc, { part: "builtin:not", x: 0, y: 0, rot: 0, props: {} });
    h.execute(doc, not); // input "a" left dangling
    h.execute(doc, addWire(doc, [
      { component: not.id, pin: "y" }, { component: ioY.id, pin: "pin" },
    ]));

    const def = exportAsPart(doc, lib, { name: "dangling", version: "1.0.0" });
    const id = lib.add(def); // validator accepts: floating net exists
    const live = instantiate(lib, id);
    // NOT of a floating (Z -> X) input is X: honest 4-value answer.
    expect(live.sim.value(live.elab.outputs.get("y")![0])).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { CircuitDocument } from "../src/model.js";
import {
  addComponent, addStroke, addWire, createGroup, moveComponents,
  pokeInput, removeEntities, setProp,
} from "../src/commands.js";
import { History } from "../src/undo.js";
import { Selection } from "../src/selection.js";
import { fromJSON, toJSON } from "../src/serialize.js";

function docWithGate() {
  const doc = new CircuitDocument();
  const h = new History();
  const and = addComponent(doc, { part: "builtin:and", x: 10, y: 10, rot: 0, props: {} });
  h.execute(doc, and);
  return { doc, h, andId: and.id };
}

describe("stable entity ids", () => {
  it("survive save/load byte-for-byte and never collide after reload", () => {
    const { doc, h, andId } = docWithGate();
    const not = addComponent(doc, { part: "builtin:not", x: 50, y: 10, rot: 0, props: {} });
    h.execute(doc, not);
    const wire = addWire(doc, [
      { component: andId, pin: "y" },
      { component: not.id, pin: "a" },
    ]);
    h.execute(doc, wire);

    const json = JSON.parse(JSON.stringify(toJSON(doc)));
    const loaded = fromJSON(json);

    expect([...loaded.components.keys()]).toEqual([...doc.components.keys()]);
    expect(loaded.wires.get(wire.id)!.ports).toEqual(doc.wires.get(wire.id)!.ports);
    expect(loaded.nextId).toBe(doc.nextId);
    expect(loaded.mintId()).toBe(doc.nextId); // no collision with any loaded id
  });

  it("undo -> redo reinserts the SAME id", () => {
    const doc = new CircuitDocument();
    const h = new History();
    const c = addComponent(doc, { part: "builtin:xor", x: 0, y: 0, rot: 0, props: {} });
    h.execute(doc, c);
    h.undo(doc);
    expect(doc.components.size).toBe(0);
    h.redo(doc);
    expect(doc.components.has(c.id)).toBe(true);
  });

  it("rejects documents whose nextId could re-mint an existing id", () => {
    const { doc } = docWithGate();
    const json = toJSON(doc);
    json.nextId = 1;
    expect(() => fromJSON(json)).toThrow(/nextId/);
  });
});

describe("commands and undo", () => {
  it("delete cascades to touching wires and revert restores all of it", () => {
    const { doc, h, andId } = docWithGate();
    const not = addComponent(doc, { part: "builtin:not", x: 50, y: 10, rot: 0, props: {} });
    h.execute(doc, not);
    const wire = addWire(doc, [
      { component: andId, pin: "y" },
      { component: not.id, pin: "a" },
    ]);
    h.execute(doc, wire);

    h.execute(doc, removeEntities([andId]));
    expect(doc.components.has(andId)).toBe(false);
    expect(doc.wires.size).toBe(0); // cascade
    expect(doc.components.has(not.id)).toBe(true);

    h.undo(doc);
    expect(doc.components.has(andId)).toBe(true);
    expect(doc.wires.has(wire.id)).toBe(true);
  });

  it("move and prop edits invert exactly", () => {
    const { doc, h, andId } = docWithGate();
    h.execute(doc, moveComponents([andId], 30, -10));
    expect(doc.components.get(andId)!.x).toBe(40);
    h.undo(doc);
    expect(doc.components.get(andId)!.x).toBe(10);

    h.execute(doc, setProp(andId, "label", "main"));
    h.execute(doc, setProp(andId, "label", "renamed"));
    h.undo(doc);
    expect(doc.components.get(andId)!.props.label).toBe("main");
    h.undo(doc);
    expect(doc.components.get(andId)!.props.label).toBeUndefined();
  });

  it("pokeInput demands a simulation tick (determinism rule)", () => {
    const { doc, h, andId } = docWithGate();
    expect(() => pokeInput(andId, 1, 2.5)).toThrow(/simulation tick/);
    const poke = pokeInput(andId, 1, 400);
    expect(poke.simTick).toBe(400);
    h.execute(doc, poke);
    expect(doc.components.get(andId)!.props.value).toBe(1);
  });
});

describe("selection subsystem", () => {
  it("maintains per-type indexes incrementally", () => {
    const { doc, h, andId } = docWithGate();
    const stroke = addStroke(doc, {
      points: [{ x: 0, y: 0, p: 0.5 }], baseWidth: 2, color: "#000",
    });
    h.execute(doc, stroke);

    const sel = new Selection(doc);
    sel.add([andId, stroke.id]);
    expect(sel.size).toBe(2);
    expect(sel.ofType("component").has(andId)).toBe(true);
    expect(sel.ofType("stroke").has(stroke.id)).toBe(true);

    sel.toggle(andId);
    expect(sel.ofType("component").size).toBe(0);
    expect(sel.size).toBe(1);
  });

  it("groups select as a unit", () => {
    const { doc, h, andId } = docWithGate();
    const b = addComponent(doc, { part: "builtin:or", x: 80, y: 0, rot: 0, props: {} });
    h.execute(doc, b);
    const g = createGroup(doc, [andId, b.id]);
    h.execute(doc, g);

    const sel = new Selection(doc);
    sel.add([andId]); // selecting one member pulls in the whole group
    expect(sel.has(g.id)).toBe(true);
    expect(sel.has(b.id)).toBe(true);
    expect(sel.size).toBe(3);
  });

  it("undo of a delete restores the deleted entities as the selection", () => {
    const { doc, h, andId } = docWithGate();
    const sel = new Selection(doc);
    sel.add([andId]);

    h.execute(doc, removeEntities(sel.ids()), sel);
    sel.prune();
    expect(sel.size).toBe(0);

    h.undo(doc, sel);
    expect(sel.has(andId)).toBe(true); // plan ripple-effect #5
  });
});

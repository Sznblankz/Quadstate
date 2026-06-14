import { describe, expect, it } from "vitest";
import { CircuitDocument, History, addComponent, addWire } from "@logicsim/document";
import { PartLibrary } from "@logicsim/schema";
import { SpatialGrid } from "../src/grid.js";
import { componentBounds, componentGeom, hitTest, layoutInterface, stampOrigin, wireBounds } from "../src/symbols.js";

function setup() {
  const doc = new CircuitDocument();
  const h = new History();
  const lib = new PartLibrary();
  const grid = new SpatialGrid(100);
  const and = addComponent(doc, { part: "builtin:and", x: 100, y: 100, rot: 0, props: {} });
  h.execute(doc, and);
  const b = componentBounds(doc.components.get(and.id)!, lib);
  grid.insert(and.id, b.x0, b.y0, b.x1, b.y1);
  return { doc, h, lib, grid, andId: and.id };
}

describe("symbol geometry", () => {
  it("lays out in-pins left, out-pins right, deterministically", () => {
    const { doc, lib, andId } = setup();
    const geom = componentGeom(doc.components.get(andId)!, layoutInterface("builtin:and", lib));
    const a = geom.ports.find((p) => p.pin === "a")!;
    const y = geom.ports.find((p) => p.pin === "y")!;
    expect(a.x).toBe(100);          // left edge
    expect(y.x).toBe(100 + geom.w); // right edge
    expect(a.dir).toBe("in");
    expect(y.dir).toBe("out");
  });
});

describe("stampOrigin (drag-preview / placement centring)", () => {
  const lib = new PartLibrary();

  it("centres a part's real footprint on the cursor, snapped to grid", () => {
    // Cursor at (533, 424). Each part should end up centred on it (to a snap).
    const wx = 533, wy = 424;

    // Iconic gate: 60x40 -> centre = origin + (30, 20).
    const and = stampOrigin("builtin:and", lib, wx, wy);
    const andGeom = componentGeom(
      { id: -1, part: "builtin:and", x: and.x, y: and.y, rot: 0, props: {} },
      layoutInterface("builtin:and", lib),
    );
    expect(andGeom.x + andGeom.w / 2).toBe(530); // 533 -> nearest 10
    expect(andGeom.y + andGeom.h / 2).toBe(420);

    // IO pin: 30x30 -> a different origin, but the SAME centre under the cursor.
    const io = stampOrigin("io:in", lib, wx, wy);
    const ioGeom = componentGeom(
      { id: -1, part: "io:in", x: io.x, y: io.y, rot: 0, props: {} },
      layoutInterface("io:in", lib),
    );
    expect(ioGeom.x + ioGeom.w / 2).toBe(535);
    expect(ioGeom.y + ioGeom.h / 2).toBe(425);

    // The two parts therefore get DIFFERENT origins (footprint-aware), which is
    // the whole point: the ghost preview lands where the part actually drops.
    expect(and).not.toEqual(io);
  });

  it("is grid-snapped", () => {
    const o = stampOrigin("builtin:or", lib, 137, 249);
    expect(o.x % 10).toBe(0);
    expect(o.y % 10).toBe(0);
  });
});

describe("hitTest priority", () => {
  it("ports beat the component body; body beats wires; empty misses", () => {
    const { doc, lib, grid, andId } = setup();
    const geom = componentGeom(doc.components.get(andId)!, layoutInterface("builtin:and", lib));
    const portA = geom.ports.find((p) => p.pin === "a")!;

    expect(hitTest(doc, lib, grid, portA.x + 2, portA.y)).toMatchObject({
      type: "port", component: andId, pin: "a",
    });
    expect(hitTest(doc, lib, grid, geom.x + 30, geom.y + 20)).toMatchObject({
      type: "component", id: andId,
    });
    expect(hitTest(doc, lib, grid, geom.x - 50, geom.y - 50)).toBeNull();
  });

  it("hits wires along their segments", () => {
    const { doc, h, lib, grid, andId } = setup();
    const not = addComponent(doc, { part: "builtin:not", x: 300, y: 100, rot: 0, props: {} });
    h.execute(doc, not);
    const nb = componentBounds(doc.components.get(not.id)!, lib);
    grid.insert(not.id, nb.x0, nb.y0, nb.x1, nb.y1);

    const wire = addWire(doc, [
      { component: andId, pin: "y" },
      { component: not.id, pin: "a" },
    ]);
    h.execute(doc, wire);
    const wb = wireBounds(doc, lib, wire.id)!;
    grid.insert(wire.id, wb.x0, wb.y0, wb.x1, wb.y1);

    // Midpoint between the two ports lies on the segment.
    const midX = (160 + 300) / 2;
    expect(hitTest(doc, lib, grid, midX, 120)).toMatchObject({ type: "wire", id: wire.id });
  });
});

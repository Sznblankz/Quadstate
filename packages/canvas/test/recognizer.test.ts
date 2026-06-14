import { beforeEach, describe, expect, it } from "vitest";
import { GestureRecognizer } from "../src/input/recognizer.js";
import type { Intent, PointerInput, PointerKind } from "../src/input/types.js";
import type { HitResult } from "../src/symbols.js";

/** Scripted-sequence tests for the device policy table (plan, Pillar 3). */

let intents: Intent[] = [];
let hits: Map<string, HitResult>;
let rec: GestureRecognizer;

function makeRec() {
  intents = [];
  hits = new Map();
  rec = new GestureRecognizer({
    hitTest: (wx, wy) => hits.get(`${wx},${wy}`) ?? null,
    emit: (i) => intents.push(i),
  });
}

function p(
  kind: PointerKind, id: number, phase: PointerInput["phase"],
  x: number, y: number,
  over: Partial<PointerInput> = {},
): void {
  rec.pointer({
    id, kind, phase, sx: x, sy: y, wx: x, wy: y,
    pressure: kind === "pen" ? 0.7 : 1, button: 0, shift: false, ...over,
  });
}

const types = () => intents.map((i) => i.type);
const COMP: HitResult = { type: "component", id: 42 };

beforeEach(makeRec);

describe("mouse policy", () => {
  it("press + release within slop = tap with the down-point target", () => {
    hits.set("10,10", COMP);
    p("mouse", 1, "down", 10, 10);
    p("mouse", 1, "move", 12, 11); // within 4px slop
    p("mouse", 1, "up", 12, 11);
    expect(types()).toEqual(["tap"]);
    expect(intents[0]).toMatchObject({ target: COMP });
  });

  it("press + move past slop = dragStart/dragMove/dragEnd", () => {
    hits.set("10,10", COMP);
    p("mouse", 1, "down", 10, 10);
    p("mouse", 1, "move", 30, 10);
    p("mouse", 1, "move", 50, 20);
    p("mouse", 1, "up", 50, 20);
    expect(types()).toEqual(["dragStart", "dragMove", "dragMove", "dragEnd"]);
    expect(intents[0]).toMatchObject({ target: COMP });
  });

  it("drag on empty emits drag with null target (tool decides marquee/wire)", () => {
    p("mouse", 1, "down", 10, 10);
    p("mouse", 1, "move", 40, 40);
    p("mouse", 1, "up", 40, 40);
    expect(intents[0]).toMatchObject({ type: "dragStart", target: null });
  });

  it("middle button pans, never drags", () => {
    hits.set("10,10", COMP);
    p("mouse", 1, "down", 10, 10, { button: 1 });
    p("mouse", 1, "move", 30, 25, { button: 1 });
    p("mouse", 1, "up", 30, 25, { button: 1 });
    expect(types()).toEqual(["pan"]);
    expect(intents[0]).toMatchObject({ dsx: 20, dsy: 15 });
  });

  it("wheel zooms at the cursor", () => {
    rec.wheel({ sx: 200, sy: 150, deltaY: -100 });
    expect(intents[0].type).toBe("zoom");
    const z = intents[0] as Extract<Intent, { type: "zoom" }>;
    expect(z.factor).toBeGreaterThan(1);
    expect(z.sx).toBe(200);
  });
});

describe("touch policy", () => {
  it("one finger on empty canvas pans immediately", () => {
    p("touch", 1, "down", 100, 100);
    p("touch", 1, "move", 120, 90);
    p("touch", 1, "up", 120, 90);
    expect(types()).toEqual(["pan"]);
  });

  it("one finger on a component drags it (slop-gated)", () => {
    hits.set("100,100", COMP);
    p("touch", 1, "down", 100, 100);
    p("touch", 1, "move", 130, 100);
    p("touch", 1, "up", 130, 100);
    expect(types()).toEqual(["dragStart", "dragMove", "dragEnd"]);
  });

  it("a second finger converts an active drag into pinch (dragCancel first)", () => {
    hits.set("100,100", COMP);
    p("touch", 1, "down", 100, 100);
    p("touch", 1, "move", 130, 100); // drag started
    p("touch", 2, "down", 200, 200); // pinch begins
    p("touch", 1, "move", 90, 100);
    expect(types()).toEqual(["dragStart", "dragMove", "dragCancel", "zoom", "pan"]);
  });

  it("pinch emits zoom proportional to finger distance", () => {
    p("touch", 1, "down", 100, 100);
    p("touch", 2, "down", 200, 100); // dist 100
    p("touch", 1, "move", 50, 100);  // dist 150
    const zooms = intents.filter((i) => i.type === "zoom") as Array<Extract<Intent, { type: "zoom" }>>;
    expect(zooms).toHaveLength(1);
    expect(zooms[0].factor).toBeCloseTo(1.5);
  });
});

describe("pen policy (palm rejection)", () => {
  it("pen behaves as a precise pointer with pressure", () => {
    hits.set("10,10", COMP);
    p("pen", 1, "down", 10, 10, { pressure: 0.3 });
    p("pen", 1, "move", 40, 10, { pressure: 0.8 });
    p("pen", 1, "up", 40, 10);
    expect(types()).toEqual(["dragStart", "dragMove", "dragEnd"]);
    expect((intents[1] as Extract<Intent, { type: "dragMove" }>).pressure).toBe(0.8);
  });

  it("while the pen is down, a touch on an entity only pans (palm)", () => {
    hits.set("10,10", COMP);
    hits.set("300,300", COMP); // palm lands ON a component
    p("pen", 1, "down", 10, 10);
    p("pen", 1, "move", 40, 10);     // pen dragging (drawing)
    p("touch", 2, "down", 300, 300); // palm
    p("touch", 2, "move", 310, 305);
    p("pen", 1, "move", 60, 10);     // pen keeps drawing
    p("pen", 1, "up", 60, 10);
    expect(types()).toEqual(["dragStart", "dragMove", "pan", "dragMove", "dragEnd"]);
  });
});

describe("cancellation", () => {
  it("pointercancel mid-drag emits dragCancel", () => {
    hits.set("10,10", COMP);
    p("mouse", 1, "down", 10, 10);
    p("mouse", 1, "move", 40, 10);
    p("mouse", 1, "cancel", 40, 10);
    expect(types()).toEqual(["dragStart", "dragMove", "dragCancel"]);
  });
});

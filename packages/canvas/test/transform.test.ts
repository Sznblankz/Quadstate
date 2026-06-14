import { describe, expect, it } from "vitest";
import { Viewport } from "../src/transform.js";

describe("Viewport", () => {
  it("round-trips screen <-> world", () => {
    const v = new Viewport();
    v.x = 100; v.y = -50; v.zoom = 2;
    expect(v.worldX(v.screenX(123.5))).toBeCloseTo(123.5);
    expect(v.worldY(v.screenY(-77))).toBeCloseTo(-77);
  });

  it("zoomAt keeps the focal world point fixed on screen", () => {
    const v = new Viewport();
    v.x = 20; v.y = 30; v.zoom = 1;
    const sx = 400, sy = 300;
    const wxBefore = v.worldX(sx), wyBefore = v.worldY(sy);
    v.zoomAt(sx, sy, 1.75);
    expect(v.worldX(sx)).toBeCloseTo(wxBefore);
    expect(v.worldY(sy)).toBeCloseTo(wyBefore);
  });

  it("clamps zoom to limits", () => {
    const v = new Viewport();
    v.zoomAt(0, 0, 1e9);
    expect(v.zoom).toBe(Viewport.MAX_ZOOM);
    v.zoomAt(0, 0, 1e-9);
    expect(v.zoom).toBe(Viewport.MIN_ZOOM);
  });

  it("panByScreen shifts the visible rect by the screen delta", () => {
    const v = new Viewport();
    v.zoom = 2;
    v.panByScreen(100, -40);
    expect(v.x).toBeCloseTo(-50);
    expect(v.y).toBeCloseTo(20);
  });
});

import { describe, expect, it } from "vitest";
import { SpatialGrid } from "../src/grid.js";

describe("SpatialGrid", () => {
  it("returns inserted ids for intersecting queries only", () => {
    const g = new SpatialGrid(100);
    g.insert(1, 10, 10, 50, 50);
    g.insert(2, 500, 500, 520, 520);
    expect(g.query(0, 0, 100, 100)).toEqual([1]);
    expect(g.query(490, 490, 600, 600)).toEqual([2]);
    expect(g.query(0, 0, 600, 600).sort()).toEqual([1, 2]);
    expect(g.query(200, 200, 300, 300)).toEqual([]);
  });

  it("entities spanning multiple cells are returned once", () => {
    const g = new SpatialGrid(100);
    g.insert(7, 50, 50, 350, 150); // spans several cells
    expect(g.query(0, 0, 400, 200)).toEqual([7]);
  });

  it("re-insert moves and remove deletes", () => {
    const g = new SpatialGrid(100);
    g.insert(1, 0, 0, 10, 10);
    g.insert(1, 900, 900, 910, 910); // move
    expect(g.query(0, 0, 100, 100)).toEqual([]);
    expect(g.query(850, 850, 950, 950)).toEqual([1]);
    g.remove(1);
    expect(g.query(850, 850, 950, 950)).toEqual([]);
  });
});

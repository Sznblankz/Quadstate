/**
 * Uniform spatial grid over world space. Serves both viewport culling
 * (renderer) and hit-test candidate lookup (input layer), per plan.
 */
export class SpatialGrid {
  private cells = new Map<string, Set<number>>();
  private placed = new Map<number, string[]>();

  constructor(readonly cellSize = 200) {}

  private key(cx: number, cy: number): string {
    return cx + "," + cy;
  }

  insert(id: number, x0: number, y0: number, x1: number, y1: number): void {
    this.remove(id);
    const keys: string[] = [];
    const c0x = Math.floor(x0 / this.cellSize), c1x = Math.floor(x1 / this.cellSize);
    const c0y = Math.floor(y0 / this.cellSize), c1y = Math.floor(y1 / this.cellSize);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const k = this.key(cx, cy);
        let set = this.cells.get(k);
        if (!set) this.cells.set(k, (set = new Set()));
        set.add(id);
        keys.push(k);
      }
    }
    this.placed.set(id, keys);
  }

  remove(id: number): void {
    const keys = this.placed.get(id);
    if (!keys) return;
    for (const k of keys) {
      const set = this.cells.get(k);
      set?.delete(id);
      if (set && set.size === 0) this.cells.delete(k);
    }
    this.placed.delete(id);
  }

  clear(): void {
    this.cells.clear();
    this.placed.clear();
  }

  /** Ids whose inserted bounds intersect the query rect (superset; caller
   *  does precise tests). Deterministic order (insertion-ordered sets). */
  query(x0: number, y0: number, x1: number, y1: number): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    const c0x = Math.floor(x0 / this.cellSize), c1x = Math.floor(x1 / this.cellSize);
    const c0y = Math.floor(y0 / this.cellSize), c1y = Math.floor(y1 / this.cellSize);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const set = this.cells.get(this.key(cx, cy));
        if (!set) continue;
        for (const id of set) {
          if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
          }
        }
      }
    }
    return out;
  }
}

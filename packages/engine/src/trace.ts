/**
 * Incremental FNV-1a hash over the stream of applied net changes.
 * Two runs are semantically identical iff their traces are identical,
 * so golden tests and the cross-platform determinism gate compare this
 * single 32-bit digest instead of storing full traces.
 */
export class TraceHasher {
  private h = 0x811c9dc5;
  /** Number of net-change records folded in (also the perf metric). */
  count = 0;

  private byte(b: number): void {
    this.h = Math.imul(this.h ^ (b & 0xff), 0x01000193) >>> 0;
  }

  private u32(v: number): void {
    this.byte(v);
    this.byte(v >>> 8);
    this.byte(v >>> 16);
    this.byte(v >>> 24);
  }

  /** Record one applied net change. `time` is an integer tick (≤ 2^53). */
  update(time: number, delta: number, net: number, val: number): void {
    this.u32(time >>> 0);
    this.u32(Math.floor(time / 0x100000000));
    this.u32(delta);
    this.u32(net);
    this.byte(val);
    this.count++;
  }

  get digest(): number {
    return this.h >>> 0;
  }
}

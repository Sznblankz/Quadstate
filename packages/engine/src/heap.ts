/**
 * Binary min-heap over numeric event records held in parallel typed arrays.
 * Ordering key is (time, seq) — seq is a monotonic counter assigned at
 * scheduling time, which gives a total order and therefore deterministic
 * pop order regardless of platform. No per-event object allocation.
 */
export class EventHeap {
  private time: Float64Array;
  private seq: Float64Array;
  private node: Int32Array;
  private val: Uint8Array;
  private n = 0;

  constructor(capacity = 1024) {
    this.time = new Float64Array(capacity);
    this.seq = new Float64Array(capacity);
    this.node = new Int32Array(capacity);
    this.val = new Uint8Array(capacity);
  }

  get size(): number {
    return this.n;
  }

  /** Time of the earliest event; Infinity when empty. */
  get minTime(): number {
    return this.n === 0 ? Infinity : this.time[0];
  }

  private grow(): void {
    const cap = this.time.length * 2;
    const t = new Float64Array(cap); t.set(this.time); this.time = t;
    const s = new Float64Array(cap); s.set(this.seq); this.seq = s;
    const nd = new Int32Array(cap); nd.set(this.node); this.node = nd;
    const v = new Uint8Array(cap); v.set(this.val); this.val = v;
  }

  private less(a: number, b: number): boolean {
    const ta = this.time[a], tb = this.time[b];
    return ta !== tb ? ta < tb : this.seq[a] < this.seq[b];
  }

  private swap(a: number, b: number): void {
    const { time, seq, node, val } = this;
    let f = time[a]; time[a] = time[b]; time[b] = f;
    f = seq[a]; seq[a] = seq[b]; seq[b] = f;
    let i = node[a]; node[a] = node[b]; node[b] = i;
    i = val[a]; val[a] = val[b]; val[b] = i;
  }

  push(time: number, seq: number, node: number, val: number): void {
    if (this.n === this.time.length) this.grow();
    let i = this.n++;
    this.time[i] = time;
    this.seq[i] = seq;
    this.node[i] = node;
    this.val[i] = val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  /** Pops the min event into `out` = [node, val]. Caller checks size first. */
  pop(out: Int32Array): void {
    out[0] = this.node[0];
    out[1] = this.val[0];
    this.n--;
    if (this.n > 0) {
      this.time[0] = this.time[this.n];
      this.seq[0] = this.seq[this.n];
      this.node[0] = this.node[this.n];
      this.val[0] = this.val[this.n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.n && this.less(l, m)) m = l;
        if (r < this.n && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
  }
}

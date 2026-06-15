import { describe, expect, it, beforeEach, vi } from "vitest";
import { SimBridge } from "../src/lib/sim/bridge.js";

// Minimal Worker stub: SimBridge only uses postMessage + onmessage. We capture
// the instance and posted messages, and drive onmessage to simulate the worker.
let lastWorker: MockWorker;
class MockWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  posted: unknown[] = [];
  constructor(_url?: unknown, _opts?: unknown) { lastWorker = this; }
  postMessage(m: unknown) { this.posted.push(m); }
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}
vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);

type Msg = { type: string; nets?: number[] };
const posted = () => lastWorker.posted as Msg[];
const find = (type: string) => posted().find((m) => m.type === type);

/** An empty document hits compile()'s early return AFTER the clears run. */
function emptyDoc(): never {
  return { components: new Map(), wires: new Map() } as never;
}

describe("SimBridge scope API", () => {
  let bridge: SimBridge;
  beforeEach(() => {
    bridge = new SimBridge();
    lastWorker.posted.length = 0;
  });

  it("scopeSubscribe posts unique nets and dedupes against existing subscriptions", () => {
    bridge.scopeSubscribe([1, 2, 2, 3]);
    expect(find("scopeSubscribe")?.nets).toEqual([1, 2, 3]);

    lastWorker.posted.length = 0;
    bridge.scopeSubscribe([2, 4]); // 2 already subscribed
    expect(find("scopeSubscribe")?.nets).toEqual([4]);

    lastWorker.posted.length = 0;
    bridge.scopeSubscribe([2]); // nothing new -> no message
    expect(find("scopeSubscribe")).toBeUndefined();
  });

  it("scopeUnsubscribe posts and drops mirrored history", () => {
    bridge.scopeSubscribe([1]);
    bridge.scopeHistory.set(1, [{ tick: 0, value: 0 }]);
    lastWorker.posted.length = 0;

    bridge.scopeUnsubscribe([1]);
    expect(bridge.scopeHistory.has(1)).toBe(false);
    expect(find("scopeUnsubscribe")?.nets).toEqual([1]);
  });

  it("ingests trace deltas, appends, and fires onTrace", () => {
    const spy = vi.fn();
    bridge.onTrace = spy;

    lastWorker.onmessage!({
      data: { type: "trace", time: 5, reset: false, deltas: [{ net: 1, transitions: [{ tick: 0, value: 0 }, { tick: 5, value: 1 }] }] },
    });
    expect(bridge.scopeHistory.get(1)).toEqual([{ tick: 0, value: 0 }, { tick: 5, value: 1 }]);
    expect(spy).toHaveBeenCalledTimes(1);

    lastWorker.onmessage!({
      data: { type: "trace", time: 10, reset: false, deltas: [{ net: 1, transitions: [{ tick: 10, value: 0 }] }] },
    });
    expect(bridge.scopeHistory.get(1)).toEqual([{ tick: 0, value: 0 }, { tick: 5, value: 1 }, { tick: 10, value: 0 }]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("a reset trace clears mirrored history before applying deltas", () => {
    bridge.scopeHistory.set(1, [{ tick: 0, value: 0 }]);
    lastWorker.onmessage!({
      data: { type: "trace", time: 0, reset: true, deltas: [{ net: 2, transitions: [{ tick: 0, value: 1 }] }] },
    });
    expect(bridge.scopeHistory.has(1)).toBe(false); // old net gone
    expect(bridge.scopeHistory.get(2)).toEqual([{ tick: 0, value: 1 }]); // new applied after clear
  });

  it("compile() clears scopeHistory synchronously (no stale net-index flash)", () => {
    bridge.scopeHistory.set(7, [{ tick: 1, value: 1 }]);
    const res = bridge.compile(emptyDoc(), {} as never);
    expect(res.ok).toBe(false); // empty doc early-returns, but the clears ran first
    expect(bridge.scopeHistory.size).toBe(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { TrackedSignal } from "@logicsim/document";

// SimBridge (constructed inside AppController) only needs postMessage/onmessage.
// compile() resolves the netlist + populates wireBus/elab synchronously on the
// main thread, so a stub worker is enough to exercise the scope-resolution code.
class MockWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}
vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);

import { AppController } from "../src/lib/controller.js";

/** A controller with the Counter example loaded (real doc, real tracked wires,
 *  recompiled → bridge.wireBus / bridge.elab populated). */
function counter(): AppController {
  const c = new AppController();
  c.openTemplate("counter");
  return c;
}
const tracked = (c: AppController) => (c as unknown as { tracked: TrackedSignal[] }).tracked;
const resolve = (c: AppController, t: TrackedSignal) =>
  (c as unknown as { resolveTracked(t: TrackedSignal): { nets: number[] | null; label: string } }).resolveTracked(t);
const sync = (c: AppController) =>
  (c as unknown as { syncScopeSubscription(): void }).syncScopeSubscription();

describe("AppController.resolveTracked", () => {
  it("maps every tracked wire to live engine nets with a label", () => {
    const c = counter();
    expect(tracked(c).length).toBeGreaterThan(0);
    for (const t of tracked(c)) {
      const { nets, label } = resolve(c, t);
      expect(nets).not.toBeNull();
      expect(nets!.length).toBeGreaterThan(0);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("returns null nets for a wire that no longer exists", () => {
    const c = counter();
    const { nets } = resolve(c, { kind: "wire", wireId: 999_999 });
    expect(nets).toBeNull();
  });

  it("labels a probe path by its last segment and returns null when unresolved", () => {
    const c = counter();
    const { nets, label } = resolve(c, { kind: "path", path: "does/not/exist" });
    expect(nets).toBeNull();
    expect(label).toBe("exist");
  });
});

describe("AppController.syncScopeSubscription", () => {
  it("resubscribes the deduped union of every tracked signal's nets", () => {
    const c = counter();
    const spy = vi.fn();
    (c.bridge as unknown as { scopeResubscribe: (n: number[]) => void }).scopeResubscribe = spy;

    sync(c);

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0] as number[];

    const expected = new Set<number>();
    for (const t of tracked(c)) {
      const { nets } = resolve(c, t);
      if (nets) for (const n of nets) expected.add(n);
    }
    expect(new Set(arg)).toEqual(expected);
    expect(arg.length).toBe(new Set(arg).size); // no duplicates posted
  });
});

describe("AppController.loadProjectString", () => {
  it("round-trips serializeProject to a stable fixpoint and preserves structure", () => {
    const a = counter();
    const j1 = a.serializeProject();

    const b = new AppController();
    expect(b.loadProjectString(j1)).toBeNull();
    const j2 = b.serializeProject();

    // Re-loading the serialized form reproduces it exactly (round-trip fixpoint).
    const cc = new AppController();
    expect(cc.loadProjectString(j2)).toBeNull();
    expect(cc.serializeProject()).toBe(j2);

    // The reload preserves the document and the tracked-signal list.
    expect(b.doc.components.size).toBe(a.doc.components.size);
    expect(b.doc.wires.size).toBe(a.doc.wires.size);
    expect(tracked(b).length).toBe(tracked(a).length);
  });

  it("reports an error (and does not throw) on unparseable JSON", () => {
    const c = new AppController();
    const err = c.loadProjectString("{not valid json");
    expect(err).not.toBeNull();
    expect(typeof err).toBe("string");
  });

  it("drops tracked wires whose wire is absent after a load", () => {
    const a = counter();
    const json = a.serializeProject();

    const b = new AppController();
    expect(b.loadProjectString(json)).toBeNull();
    // Every restored wire-kind tracked signal points at a real wire.
    for (const t of tracked(b)) {
      if (t.kind === "wire") expect(b.doc.wires.has(t.wireId)).toBe(true);
    }
  });
});

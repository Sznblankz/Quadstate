import { elaborate, PartLibrary, SchemaError, type Elaboration } from "@logicsim/schema";
import { exportProject, type CircuitDocument, type EntityId } from "@logicsim/document";
import type { Transition } from "@logicsim/engine";
import type { WorkerIn, WorkerOut } from "./worker.js";

export interface CompileStatus {
  ok: boolean;
  message: string;
}

/**
 * Main-thread side of the engine worker. Compiles the document (export ->
 * validate -> elaborate), ships the flat netlist to the worker, and keeps
 * the entity -> net maps the renderer needs.
 *
 * M3 note: recompiles restart simulation state from io:in props (which
 * are the document source of truth for inputs). DFF carry-over across
 * live edits goes through the worker in M4.
 */
export class SimBridge {
  private worker: Worker;
  netValues: Uint8Array | null = null;
  wireNets = new Map<EntityId, number>();
  /** wire id -> full bus (engine net indices, LSB first) for width-aware UI. */
  wireBus = new Map<EntityId, number[]>();
  ioNets = new Map<EntityId, number>();
  private inputNodes = new Map<EntityId, number[]>();
  /** Last successful elaboration — the inspector probes through it. */
  elab: Elaboration | null = null;
  simTime = 0;
  running = false;
  ticksPerSecond = 2000;
  onSnapshot?: () => void;

  /** Per-net transition history for subscribed nets, keyed by ENGINE NET INDEX.
   *  Cleared on every compile() — net indices are not stable across recompiles. */
  scopeHistory = new Map<number, Transition[]>();
  /** Fired after each TraceMsg is ingested (same cadence as onSnapshot). */
  onTrace?: () => void;
  private subscribedNets = new Set<number>();

  private smokeWaiters: Array<(digest: string) => void> = [];

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === "snapshot") {
        this.netValues = e.data.values;
        this.simTime = e.data.time;
        this.onSnapshot?.();
      } else if (e.data.type === "trace") {
        if (e.data.reset) this.scopeHistory.clear();
        for (const d of e.data.deltas) {
          let arr = this.scopeHistory.get(d.net);
          if (!arr) { arr = []; this.scopeHistory.set(d.net, arr); }
          for (const t of d.transitions) arr.push(t);
        }
        this.onTrace?.();
      } else if (e.data.type === "smokeResult") {
        const digest = e.data.digest;
        for (const resolve of this.smokeWaiters.splice(0)) resolve(digest);
      }
    };
  }

  /** Run the determinism smoke inside the worker (this platform's webview
   *  JS engine) and resolve with the trace digest. */
  runSmoke(): Promise<string> {
    return new Promise((resolve) => {
      this.smokeWaiters.push(resolve);
      this.post({ type: "smoke" });
    });
  }

  private post(msg: WorkerIn, transfer?: Transferable[]): void {
    this.worker.postMessage(msg, transfer ?? []);
  }

  compile(doc: CircuitDocument, lib: PartLibrary): CompileStatus {
    this.wireNets.clear();
    this.wireBus.clear();
    this.ioNets.clear();
    this.inputNodes.clear();
    this.netValues = null;
    this.elab = null;
    // Clear synchronously so a SnapshotMsg arriving before the worker's reset
    // TraceMsg can't index fresh net indices into stale history (no wrong-signal flash).
    this.scopeHistory.clear();

    if (doc.components.size === 0) {
      return { ok: false, message: "place parts to begin" };
    }
    let hasIo = false;
    for (const c of doc.components.values()) {
      if (c.part === "io:in" || c.part === "io:out") { hasIo = true; break; }
    }
    if (!hasIo) {
      return { ok: false, message: "add an IN or OUT pin to simulate" };
    }

    try {
      const { def, wireNet, ioPin } = exportProject(doc, lib, {
        name: "project", version: "0.1.0",
      });
      const id = lib.add(def);
      const elab = elaborate(lib, id);

      for (const [wireId, netName] of wireNet) {
        const nets = elab.resolveNet(netName);
        if (nets) {
          this.wireNets.set(wireId, nets[0]);
          this.wireBus.set(wireId, nets);
        }
      }
      const inputs: Array<[number, number]> = [];
      for (const [compId, pinName] of ioPin) {
        const nets = elab.resolveNet(pinName);
        if (nets) this.ioNets.set(compId, nets[0]);
        const nodes = elab.inputs.get(pinName);
        if (nodes) {
          this.inputNodes.set(compId, nodes);
          const comp = doc.components.get(compId);
          // Restore every bit of the bus (switches drive all bits uniformly);
          // preserve the poked 0/1/X/Z code so it survives recompile/reload.
          const v = typeof comp?.props.value === "number" ? comp.props.value : 0;
          for (const n of nodes) inputs.push([n, v]);
        }
      }
      this.elab = elab;
      this.post({
        type: "load",
        netlist: elab.netlist,
        inputs,
        dffPaths: [...elab.dffs],
        carry: true,
      });
      this.post({ type: "run", running: this.running });
      this.post({ type: "speed", ticksPerSecond: this.ticksPerSecond });
      return { ok: true, message: `${elab.netlist.netCount} nets, ${elab.netlist.nodeCount} nodes` };
    } catch (err) {
      const message = err instanceof SchemaError
        ? err.issues[0]?.message ?? "invalid circuit"
        : err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  }

  /** Live value of a hierarchical net path (inspector probing), or null. */
  probe(path: string): number | null {
    if (!this.elab || !this.netValues) return null;
    const nets = this.elab.resolveNet(path);
    return nets ? this.netValues[nets[0]] : null;
  }

  poke(componentId: EntityId, value: number): void {
    const nodes = this.inputNodes.get(componentId);
    if (nodes) this.post({ type: "poke", nodes, value });
  }

  setRunning(running: boolean): void {
    this.running = running;
    this.post({ type: "run", running });
  }

  /** Advance a paused simulation by exactly `ticks` ticks. */
  step(ticks: number): void {
    if (this.running || ticks <= 0) return;
    this.post({ type: "step", ticks });
  }

  setSpeed(ticksPerSecond: number): void {
    this.ticksPerSecond = ticksPerSecond;
    this.post({ type: "speed", ticksPerSecond });
  }

  /** Subscribe the worker to record history for these ENGINE NET indices. */
  scopeSubscribe(nets: number[]): void {
    const add: number[] = [];
    for (const n of nets) if (!this.subscribedNets.has(n)) { this.subscribedNets.add(n); add.push(n); }
    if (add.length) this.post({ type: "scopeSubscribe", nets: add });
  }

  /** Unsubscribe these net indices and drop their history. */
  scopeUnsubscribe(nets: number[]): void {
    const del: number[] = [];
    for (const n of nets) if (this.subscribedNets.has(n)) { this.subscribedNets.delete(n); del.push(n); }
    for (const n of del) this.scopeHistory.delete(n);
    if (del.length) this.post({ type: "scopeUnsubscribe", nets: del });
  }

  /** Replace the whole subscription with a fresh net-index set after a recompile. */
  scopeResubscribe(nets: number[]): void {
    this.scopeHistory.clear();
    this.subscribedNets = new Set(nets);
    if (nets.length) this.post({ type: "scopeSubscribe", nets });
  }
}

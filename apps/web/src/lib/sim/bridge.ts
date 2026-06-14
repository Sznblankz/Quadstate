import { elaborate, PartLibrary, SchemaError, type Elaboration } from "@logicsim/schema";
import { exportProject, type CircuitDocument, type EntityId } from "@logicsim/document";
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

  private smokeWaiters: Array<(digest: string) => void> = [];

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === "snapshot") {
        this.netValues = e.data.values;
        this.simTime = e.data.time;
        this.onSnapshot?.();
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
}

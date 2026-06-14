/// <reference lib="webworker" />
/**
 * Simulation worker: owns the Simulator (plan: engine never runs on the
 * main thread). Wall-clock pacing here decides only HOW MANY ticks run
 * per interval — inputs are applied at explicit sim ticks, so pacing can
 * never change outcomes (determinism constraint #3).
 */
import { Simulator, Z, runDeterminismSmoke, type CompiledNetlist } from "@logicsim/engine";

interface LoadMsg {
  type: "load";
  netlist: CompiledNetlist;
  /** [engine input node id, logic value] applied at t=0. */
  inputs: Array<[number, number]>;
  /** Stable DFF bit paths -> node ids in THIS netlist. Used to carry
   *  flip-flop state across recompiles (re-elaboration carry-over). */
  dffPaths: Array<[string, number]>;
  /** Carry state from the previous circuit where paths match. */
  carry: boolean;
}
interface PokeMsg { type: "poke"; nodes: number[]; value: number }
interface RunMsg { type: "run"; running: boolean }
interface SpeedMsg { type: "speed"; ticksPerSecond: number }
interface SmokeMsg { type: "smoke" }
/** Advance a paused simulation by exactly `ticks` integer ticks. */
interface StepMsg { type: "step"; ticks: number }
export type WorkerIn = LoadMsg | PokeMsg | RunMsg | SpeedMsg | SmokeMsg | StepMsg;

export interface SnapshotMsg {
  type: "snapshot";
  values: Uint8Array;
  time: number;
  diagnostics: number;
}

export interface SmokeResultMsg {
  type: "smokeResult";
  digest: string;
}

export type WorkerOut = SnapshotMsg | SmokeResultMsg;

let sim: Simulator | null = null;
let prevSim: Simulator | null = null;
let prevDffPaths = new Map<string, number>();
let running = false;
let ticksPerSecond = 2000;
let tickFloat = 0;
let lastWall = 0;

function snapshot(): void {
  if (!sim) return;
  const values = sim.copyNetValues();
  const msg: SnapshotMsg = {
    type: "snapshot",
    values,
    time: sim.time,
    diagnostics: sim.diagnostics.length,
  };
  (postMessage as (m: unknown, t?: Transferable[]) => void)(msg, [values.buffer]);
}

onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  switch (msg.type) {
    case "load": {
      const next = new Simulator(msg.netlist);
      // Carry-over: DFF bits whose stable hierarchical path exists in the
      // previous circuit keep their value (plan: re-elaboration with state
      // carry-over, double-buffered — `sim` keeps serving until the swap).
      if (msg.carry && prevSim) {
        for (const [path, node] of msg.dffPaths) {
          const prevNode = prevDffPaths.get(path);
          if (prevNode === undefined) continue;
          const v = prevSim.driverValue(prevNode);
          if (v !== Z) next.primeDff(node, v);
        }
      }
      for (const [node, value] of msg.inputs) next.setInput(node, value, 0);
      next.run(0);
      sim = next;
      prevSim = next;
      prevDffPaths = new Map(msg.dffPaths);
      tickFloat = sim.time;
      lastWall = performance.now();
      snapshot();
      return;
    }
    case "poke": {
      if (!sim) return;
      for (const node of msg.nodes) sim.setInput(node, msg.value, sim.time);
      if (!running) {
        sim.run(sim.time); // settle immediately while paused
        snapshot();
      }
      return;
    }
    case "run":
      running = msg.running;
      lastWall = performance.now();
      tickFloat = sim?.time ?? 0;
      return;
    case "step": {
      if (!sim || running) return;
      sim.run(sim.time + msg.ticks);
      tickFloat = sim.time;
      snapshot();
      return;
    }
    case "speed":
      ticksPerSecond = msg.ticksPerSecond;
      return;
    case "smoke": {
      // Determinism gate: run the shared scenario on THIS platform's JS
      // engine and report the trace digest for comparison.
      const result: SmokeResultMsg = { type: "smokeResult", digest: runDeterminismSmoke() };
      postMessage(result);
      return;
    }
  }
};

setInterval(() => {
  if (!sim) return;
  if (running) {
    const now = performance.now();
    tickFloat += ((now - lastWall) / 1000) * ticksPerSecond;
    lastWall = now;
    const target = Math.floor(tickFloat);
    if (target > sim.time) sim.run(target);
    snapshot();
  }
}, 33);

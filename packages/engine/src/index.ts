export { LO, HI, X, Z, type Logic } from "./values.js";
export {
  NetlistBuilder,
  type CompiledNetlist,
  type GateKind,
  NK_INPUT, NK_CLOCK, NK_AND, NK_OR, NK_XOR, NK_NAND, NK_NOR, NK_XNOR,
  NK_NOT, NK_BUF, NK_TRI, NK_DFF, NK_LUT, NK_CONST,
} from "./netlist.js";
export { Simulator, type OscillationDiagnostic } from "./simulator.js";
export {
  ScopeRecorder,
  advanceAndSample,
  SCOPE_CAP,
  type Transition,
  type TraceDelta,
  type TracePayload,
  type SampledSim,
} from "./scope.js";
export { TraceHasher } from "./trace.js";
export { SMOKE_DIGEST, runDeterminismSmoke } from "./smoke.js";

export { SCHEMA_VERSION, MAX_BUS_WIDTH, MAX_TT_INPUT_BITS } from "./limits.js";
export type {
  PartDefinition, PartBody, StructuralBody, TruthTableBody,
  PinSpec, NetSpec, InstanceSpec, PinDir, PinSide,
  ValidationIssue, ResolvedInterface,
} from "./types.js";
export { BUILTINS, type BuiltinSpec } from "./builtins.js";
export { validatePart } from "./validate.js";
export { partId, canonicalForm, canonicalJson } from "./canonical.js";
export { sha256Hex, sha256HexUtf8 } from "./sha256.js";
export { PartLibrary, SchemaError } from "./library.js";
export {
  elaborate, instantiate, reElaborate,
  type Elaboration, type LiveCircuit,
} from "./elaborate.js";
export {
  BUNDLE_VERSION, dependencyClosure, exportBundle, importBundle,
  type ImportResult, type PartBundle, type PartBundleEntry,
} from "./bundle.js";
export {
  HttpRegistryClient, MemoryRegistry,
  type PublishResponse, type RegistryClient, type RegistryPartSummary,
} from "./registry.js";

/**
 * Part definition schema, version 1 — the pure-JSON format for community
 * parts. Fixed interfaces only; the `params` key is reserved for V2 and
 * rejected if present.
 */

export type PinDir = "in" | "out";
export type PinSide = "left" | "right" | "top" | "bottom";

export interface PinSpec {
  name: string;
  dir: PinDir;
  /** 1..MAX_BUS_WIDTH */
  width: number;
  side?: PinSide;
  offset?: number;
}

export interface NetSpec {
  name: string;
  width: number;
}

export interface InstanceSpec {
  id: string;
  /** "builtin:*" or the content-hash id of a registered part. */
  part: string;
  /** Builtin instance properties (dff init, clock half period, ...). */
  props?: Record<string, number>;
  /** Sub-part pin name -> net name in the containing definition
   *  (a pin name of the containing part, or an internal net name). */
  connections: Record<string, string>;
}

export interface StructuralBody {
  kind: "structural";
  nets: NetSpec[];
  instances: InstanceSpec[];
}

export interface TruthTableBody {
  kind: "behavioral";
  truthTable: {
    /** Must equal the in-pin names in interface order. */
    inputs: string[];
    /** Must equal the out-pin names in interface order. */
    outputs: string[];
    /**
     * Row key: input pin bits concatenated in pin order, each pin
     * MSB-first. Row value: same encoding over output pins. Missing
     * rows evaluate to X.
     */
    rows: Record<string, string>;
  };
}

export type PartBody = StructuralBody | TruthTableBody;

export interface PartDefinition {
  schemaVersion: number;
  name: string;
  /** semver "major.minor.patch" */
  version: string;
  interface: { pins: PinSpec[] };
  body: PartBody;
  /** Symbol metadata; not part of the content hash. */
  appearance?: unknown;
  /** Ink annotation strokes; not part of the content hash. */
  annotations?: unknown[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Interface seen by validators/elaborators; width 0 means "flexible"
 *  (builtin pins that adopt the instance's unified width). */
export interface ResolvedInterface {
  pins: { name: string; dir: PinDir; width: number }[];
}

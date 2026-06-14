import { MAX_BUS_WIDTH, MAX_TT_INPUT_BITS, SCHEMA_VERSION } from "./limits.js";
import { BUILTINS } from "./builtins.js";
import type {
  PartDefinition, ResolvedInterface, StructuralBody, TruthTableBody, ValidationIssue,
} from "./types.js";

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

type Resolve = (partId: string) => ResolvedInterface | undefined;

/**
 * Validate a part definition against schema V1. Structured errors name the
 * offending entity and the violated limit; nothing is silently clamped.
 * `resolve` supplies interfaces of referenced parts (builtins included).
 */
export function validatePart(def: PartDefinition, resolve: Resolve): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });

  if (def.schemaVersion !== SCHEMA_VERSION) {
    bad("schemaVersion",
      `unsupported schema version ${def.schemaVersion}; this validator handles version ${SCHEMA_VERSION}`);
    return issues; // never mis-parse future versions
  }
  if ("params" in (def as object)) {
    bad("params", "the 'params' key is reserved for a future schema version");
  }
  if (typeof def.name !== "string" || def.name.length === 0) {
    bad("name", "name must be a non-empty string");
  }
  if (typeof def.version !== "string" || !SEMVER_RE.test(def.version)) {
    bad("version", `version must be semver "major.minor.patch", got ${JSON.stringify(def.version)}`);
  }

  // ---- interface pins
  const pinByName = new Map<string, { dir: "in" | "out"; width: number }>();
  const pins = def.interface?.pins;
  if (!Array.isArray(pins) || pins.length === 0) {
    bad("interface.pins", "at least one pin is required");
    return issues;
  }
  pins.forEach((pin, i) => {
    const p = `interface.pins[${i}]`;
    if (typeof pin.name !== "string" || !NAME_RE.test(pin.name)) {
      bad(p, `invalid pin name ${JSON.stringify(pin.name)}`);
      return;
    }
    if (pinByName.has(pin.name)) bad(p, `duplicate pin name "${pin.name}"`);
    if (pin.dir !== "in" && pin.dir !== "out") bad(p, `dir must be "in" or "out"`);
    if (!Number.isInteger(pin.width) || pin.width < 1 || pin.width > MAX_BUS_WIDTH) {
      bad(p, `pin "${pin.name}" width ${pin.width} outside 1..${MAX_BUS_WIDTH}`);
    }
    pinByName.set(pin.name, { dir: pin.dir, width: pin.width });
  });

  // ---- body
  const body = def.body;
  if (body?.kind === "structural") {
    validateStructural(body, pinByName, resolve, bad);
  } else if (body?.kind === "behavioral") {
    validateTruthTable(body, def, bad);
  } else {
    bad("body.kind", `body.kind must be "structural" or "behavioral"`);
  }
  return issues;
}

function validateStructural(
  body: StructuralBody,
  pinByName: Map<string, { dir: "in" | "out"; width: number }>,
  resolve: Resolve,
  bad: (path: string, message: string) => void,
): void {
  // Net namespace = interface pins + declared internal nets.
  const netWidth = new Map<string, number>();
  for (const [name, p] of pinByName) netWidth.set(name, p.width);

  (body.nets ?? []).forEach((net, i) => {
    const p = `body.nets[${i}]`;
    if (typeof net.name !== "string" || !NAME_RE.test(net.name)) {
      bad(p, `invalid net name ${JSON.stringify(net.name)}`);
      return;
    }
    if (netWidth.has(net.name)) bad(p, `net name "${net.name}" collides with a pin or another net`);
    if (!Number.isInteger(net.width) || net.width < 1 || net.width > MAX_BUS_WIDTH) {
      bad(p, `net "${net.name}" width ${net.width} outside 1..${MAX_BUS_WIDTH}`);
    }
    netWidth.set(net.name, net.width);
  });

  const instIds = new Set<string>();
  (body.instances ?? []).forEach((inst, i) => {
    const p = `body.instances[${i}]`;
    if (typeof inst.id !== "string" || !NAME_RE.test(inst.id)) {
      bad(p, `invalid instance id ${JSON.stringify(inst.id)}`);
      return;
    }
    if (instIds.has(inst.id)) bad(p, `duplicate instance id "${inst.id}"`);
    instIds.add(inst.id);

    const iface = resolve(inst.part);
    if (!iface) {
      bad(`${p}.part`, `unknown part "${inst.part}" (dependencies must be registered first)`);
      return;
    }

    // Props only exist on builtins; range-check against the builtin spec.
    const builtin = BUILTINS.get(inst.part);
    for (const [key, val] of Object.entries(inst.props ?? {})) {
      const spec = builtin?.props[key];
      if (!spec) {
        bad(`${p}.props.${key}`, `unknown prop "${key}" for part "${inst.part}"`);
      } else if (!Number.isInteger(val) || val < spec.min || val > spec.max) {
        bad(`${p}.props.${key}`, `prop "${key}" = ${val} outside ${spec.min}..${spec.max}`);
      }
    }

    // Connections: every target pin present exactly once, nets exist,
    // widths unify (0 = flexible builtin width).
    const conns = inst.connections ?? {};
    let flexWidth = 0;
    for (const pin of iface.pins) {
      const target = conns[pin.name];
      if (target === undefined) {
        bad(`${p}.connections`, `pin "${pin.name}" of "${inst.part}" is not connected`);
        continue;
      }
      const w = netWidth.get(target);
      if (w === undefined) {
        bad(`${p}.connections.${pin.name}`, `unknown net "${target}"`);
        continue;
      }
      if (pin.width === 0) {
        if (flexWidth === 0) flexWidth = w;
        else if (flexWidth !== w) {
          bad(`${p}.connections.${pin.name}`,
            `width mismatch: instance unifies to ${flexWidth} but net "${target}" is ${w} wide`);
        }
      } else if (pin.width !== w) {
        bad(`${p}.connections.${pin.name}`,
          `width mismatch: pin "${pin.name}" is ${pin.width} wide, net "${target}" is ${w} wide`);
      }
    }
    for (const key of Object.keys(conns)) {
      if (!iface.pins.some((pin) => pin.name === key)) {
        bad(`${p}.connections.${key}`, `"${inst.part}" has no pin "${key}"`);
      }
    }
  });
}

function validateTruthTable(
  body: TruthTableBody,
  def: PartDefinition,
  bad: (path: string, message: string) => void,
): void {
  const tt = body.truthTable;
  if (!tt) {
    bad("body.truthTable", "behavioral body requires a truthTable");
    return;
  }
  const inPins = def.interface.pins.filter((p) => p.dir === "in");
  const outPins = def.interface.pins.filter((p) => p.dir === "out");

  if (JSON.stringify(tt.inputs) !== JSON.stringify(inPins.map((p) => p.name))) {
    bad("body.truthTable.inputs", "inputs must list the in-pins in interface order");
  }
  if (JSON.stringify(tt.outputs) !== JSON.stringify(outPins.map((p) => p.name))) {
    bad("body.truthTable.outputs", "outputs must list the out-pins in interface order");
  }

  const inBits = inPins.reduce((acc, p) => acc + p.width, 0);
  const outBits = outPins.reduce((acc, p) => acc + p.width, 0);
  if (inBits > MAX_TT_INPUT_BITS) {
    bad("body.truthTable", `total input bits ${inBits} exceed the limit of ${MAX_TT_INPUT_BITS}`);
    return;
  }
  for (const [key, val] of Object.entries(tt.rows ?? {})) {
    if (!/^[01]+$/.test(key) || key.length !== inBits) {
      bad(`body.truthTable.rows["${key}"]`, `row key must be ${inBits} binary digits`);
    }
    if (typeof val !== "string" || !/^[01]+$/.test(val) || val.length !== outBits) {
      bad(`body.truthTable.rows["${key}"]`, `row value must be ${outBits} binary digits`);
    }
  }
}

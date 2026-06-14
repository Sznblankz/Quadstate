import { sha256HexUtf8 } from "./sha256.js";
import type { PartDefinition } from "./types.js";

/**
 * Content-addressed part identity.
 *
 * The hash covers structure and interface only: schemaVersion, pins
 * (name/dir/width — not appearance hints), and the body with internal
 * net and instance ids normalized away. Working documents keep their
 * stable entity ids; publishing normalizes them so two structurally
 * identical parts hash identically (the plan's "ripple effect #2").
 *
 * Excluded: name, version, appearance, annotations, pin side/offset —
 * renaming or restyling a part does not change what it *is*.
 *
 * A consequence worth noting: because parts can only reference
 * already-hashed dependency ids, a definition cycle would require two
 * parts to each contain the other's hash — impossible by construction.
 * Content addressing IS the dependency-DAG guarantee.
 */
export function partId(def: PartDefinition): string {
  return "sha256:" + sha256HexUtf8(canonicalJson(canonicalForm(def)));
}

export function canonicalForm(def: PartDefinition): unknown {
  const pins = def.interface.pins.map((p) => ({
    dir: p.dir,
    name: p.name,
    width: p.width,
  }));

  if (def.body.kind === "behavioral") {
    return {
      body: {
        kind: "behavioral",
        truthTable: {
          inputs: def.body.truthTable.inputs,
          outputs: def.body.truthTable.outputs,
          rows: def.body.truthTable.rows,
        },
      },
      interface: { pins },
      schemaVersion: def.schemaVersion,
    };
  }

  // Normalize internal net and instance ids by declaration order. Pin
  // names are interface and stay; only internal identifiers are renamed.
  const netRename = new Map<string, string>();
  def.body.nets.forEach((n, i) => netRename.set(n.name, `n${i}`));
  const ref = (name: string) => netRename.get(name) ?? name;

  return {
    body: {
      kind: "structural",
      instances: def.body.instances.map((inst, i) => ({
        connections: Object.fromEntries(
          Object.entries(inst.connections).map(([pin, net]) => [pin, ref(net)]),
        ),
        id: `i${i}`,
        part: inst.part,
        props: inst.props ?? {},
      })),
      nets: def.body.nets.map((n, i) => ({ name: `n${i}`, width: n.width })),
    },
    interface: { pins },
    schemaVersion: def.schemaVersion,
  };
}

/**
 * Canonical JSON: recursively sorted object keys, integers only (floats
 * would reintroduce formatting ambiguity), no locale-sensitive operations.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`canonical JSON allows only safe integers, got ${value}`);
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v)).join(",") + "}";
  }
  throw new Error(`canonical JSON cannot encode ${typeof value}`);
}

import { BUILTINS } from "./builtins.js";
import { partId } from "./canonical.js";
import { validatePart } from "./validate.js";
import type { PartDefinition, ResolvedInterface, ValidationIssue } from "./types.js";

export class SchemaError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super("invalid part definition:\n" +
      issues.map((i) => `  ${i.path}: ${i.message}`).join("\n"));
  }
}

/**
 * A set of validated part definitions keyed by content-hash id.
 *
 * Definitions may only reference parts that are already registered
 * (unknown refs are validation errors), and references are content
 * hashes — so the dependency graph is acyclic by construction: a cycle
 * would require each part to embed the other's hash.
 */
export class PartLibrary {
  private defs = new Map<string, PartDefinition>();

  /** Validate, hash, and register. Returns the content-addressed id. */
  add(def: PartDefinition): string {
    const issues = validatePart(def, (id) => this.resolveInterface(id));
    if (issues.length > 0) throw new SchemaError(issues);
    const id = partId(def);
    // Re-registering identical structure is a no-op (content addressing).
    if (!this.defs.has(id)) this.defs.set(id, def);
    return id;
  }

  tryAdd(def: PartDefinition): { id?: string; issues: ValidationIssue[] } {
    const issues = validatePart(def, (id) => this.resolveInterface(id));
    if (issues.length > 0) return { issues };
    return { id: this.add(def), issues: [] };
  }

  get(id: string): PartDefinition | undefined {
    return this.defs.get(id);
  }

  has(id: string): boolean {
    return this.defs.has(id) || BUILTINS.has(id);
  }

  resolveInterface(id: string): ResolvedInterface | undefined {
    const builtin = BUILTINS.get(id);
    if (builtin) return builtin.iface;
    const def = this.defs.get(id);
    if (!def) return undefined;
    return {
      pins: def.interface.pins.map((p) => ({ name: p.name, dir: p.dir, width: p.width })),
    };
  }

  /** Part ids referenced by a definition's body (its pinned dependencies). */
  static dependenciesOf(def: PartDefinition): string[] {
    if (def.body.kind !== "structural") return [];
    return [...new Set(def.body.instances.map((i) => i.part).filter((p) => !BUILTINS.has(p)))];
  }
}

import { PartLibrary } from "./library.js";
import type { PartDefinition } from "./types.js";

/**
 * Shareable part bundle: one "main" part plus its full transitive
 * dependency closure, in dependency order (dependencies first). This is
 * the unit the community registry stores and serves — a bundle is always
 * self-contained, so fetching a part never requires further round trips.
 *
 * Integrity: every entry's id is re-derived from its definition on
 * import. Because references are content hashes, a bundle cannot encode
 * a dependency cycle, and a tampered definition (or one produced by an
 * incompatible canonicalization) fails the hash check.
 */
export const BUNDLE_VERSION = 1;

export interface PartBundleEntry {
  id: string;
  name: string;
  def: PartDefinition;
}

export interface PartBundle {
  bundleVersion: typeof BUNDLE_VERSION;
  /** Content-hash id of the part this bundle delivers. */
  main: string;
  /** main + transitive dependencies, dependencies first. */
  parts: PartBundleEntry[];
}

/** Transitive dependency closure of `id`, post-order (dependencies before
 *  dependents), builtins excluded. Deterministic: DFS in declaration order. */
export function dependencyClosure(lib: PartLibrary, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (partId: string): void => {
    if (seen.has(partId)) return;
    seen.add(partId);
    const def = lib.get(partId);
    if (!def) throw new Error(`part not in library: ${partId}`);
    for (const dep of PartLibrary.dependenciesOf(def)) visit(dep);
    out.push(partId);
  };
  visit(id);
  return out;
}

/**
 * `mainName` overrides the display name of the main entry. Needed because
 * names are metadata outside the content hash: two structurally identical
 * parts share one id, and the library keeps the first-registered name —
 * the bundle should carry the name the USER gave this chip.
 */
export function exportBundle(lib: PartLibrary, mainId: string, mainName?: string): string {
  const parts: PartBundleEntry[] = dependencyClosure(lib, mainId).map((id) => {
    const def = lib.get(id)!;
    return { id, name: id === mainId ? mainName ?? def.name : def.name, def };
  });
  const bundle: PartBundle = { bundleVersion: BUNDLE_VERSION, main: mainId, parts };
  return JSON.stringify(bundle, null, 2);
}

export interface ImportResult {
  main: string;
  /** Display name of the main part as carried by the bundle. */
  mainName: string;
  /** Parts newly registered by this import (excludes already-known ids). */
  added: Array<{ id: string; name: string }>;
  /** Parts that were already in the library (dedupe by content hash). */
  skipped: number;
}

export function importBundle(json: string, lib: PartLibrary): ImportResult {
  const bundle = JSON.parse(json) as PartBundle;
  if (bundle.bundleVersion !== BUNDLE_VERSION) {
    throw new Error(`unsupported part bundle version ${bundle.bundleVersion}`);
  }
  if (!Array.isArray(bundle.parts) || bundle.parts.length === 0) {
    throw new Error("part bundle contains no parts");
  }
  const added: Array<{ id: string; name: string }> = [];
  let skipped = 0;
  for (const entry of bundle.parts) {
    if (lib.has(entry.id) && lib.get(entry.id)) {
      skipped++;
      continue; // content-addressed: identical by construction
    }
    // Validates against builtins + previously imported entries; unknown
    // refs here mean the bundle is incomplete or out of order.
    const id = lib.add(entry.def);
    if (id !== entry.id) {
      throw new Error(
        `part "${entry.name}" re-hashed to a different id — the bundle is corrupted ` +
        `or from an incompatible version`);
    }
    added.push({ id, name: entry.name });
  }
  const mainEntry = bundle.parts.find((p) => p.id === bundle.main);
  if (!mainEntry || !lib.get(bundle.main)) {
    throw new Error(`bundle's main part ${bundle.main} is not among its entries`);
  }
  return { main: bundle.main, mainName: mainEntry.name, added, skipped };
}

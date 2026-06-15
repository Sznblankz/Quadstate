import { PartLibrary, type PartDefinition } from "@logicsim/schema";
import type { CircuitDocument } from "./model.js";
import { fromJSON, toJSON, type DocumentJson } from "./serialize.js";

export const FILE_VERSION = 1;

/** A signal tracked in the Watches panel / timing diagram. Persisted by STABLE
 *  identity (wire EntityId or hierarchical probe path) — never raw net indices,
 *  which are reassigned on every re-elaboration. Re-resolved on each compile. */
export type TrackedSignal =
  | { kind: "wire"; wireId: number }
  | { kind: "path"; path: string };

export interface ProjectPartEntry {
  /** Content-hash id as registered when the part was created. Verified
   *  against a re-hash on load — a mismatch means corruption or an
   *  incompatible canonicalization version. */
  id: string;
  name: string;
  def: PartDefinition;
}

/**
 * Project file = the document + the user part library it depends on, so
 * "My Chips" travel with the file. Parts are stored in creation order,
 * which is dependency order (a chip can only reference chips that
 * already existed when it was made).
 */
export interface ProjectFile {
  fileVersion: typeof FILE_VERSION;
  document: DocumentJson;
  /** The full dependency closure the document/palette needs, dependency
   *  order (a part appears after every part it references). Restored into
   *  the library on load. */
  parts: ProjectPartEntry[];
  /** "My Chips" palette entries — a subset of `parts` by id. Optional for
   *  backward compatibility; older files treat every part as a palette
   *  entry. */
  palette?: Array<{ id: string; name: string }>;
  /** Watched / scoped signals (stable wire ids or probe paths). Optional —
   *  older files load with none. */
  trackedSignals?: TrackedSignal[];
}

/**
 * Storage abstraction (plan: one interface here, thin adapters in the
 * shells). Adapters are runtime-detected in the app bundle: File System
 * Access API on the web, dialog+fs plugins under Tauri, Filesystem
 * plugin under Capacitor.
 */
export interface StorageProvider {
  readonly kind: "web" | "tauri" | "capacitor";
  /** Returns false if the user cancelled. */
  save(suggestedName: string, data: string): Promise<boolean>;
  /** Returns null if the user cancelled. */
  load(): Promise<string | null>;
}

export function projectToJson(
  doc: CircuitDocument,
  userParts: Array<{ id: string; name: string }>,
  lib: PartLibrary,
  tracked: TrackedSignal[] = [],
): string {
  // Serialize the full dependency closure of everything the project uses —
  // palette chips AND parts the document references (which may be orphans not
  // in the palette, e.g. a stale dependency of a chip whose inner part was
  // edited). Post-order DFS yields dependency order for load-time validation.
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string): void => {
    if (seen.has(id) || id === "io:in" || id === "io:out" || id.startsWith("builtin:")) return;
    const def = lib.get(id);
    if (!def) throw new Error(`part "${id}" is not in the library`);
    seen.add(id);
    for (const dep of PartLibrary.dependenciesOf(def)) visit(dep);
    order.push(id); // after its dependencies
  };
  for (const p of userParts) visit(p.id);
  for (const comp of doc.components.values()) visit(comp.part);

  const nameOf = new Map(userParts.map((p) => [p.id, p.name]));
  const parts: ProjectPartEntry[] = order.map((id) => {
    const def = lib.get(id)!;
    return { id, name: nameOf.get(id) ?? def.name, def };
  });
  const palette = userParts.map((p) => ({ id: p.id, name: p.name }));
  const file: ProjectFile = {
    fileVersion: FILE_VERSION, document: toJSON(doc), parts, palette, trackedSignals: tracked,
  };
  return JSON.stringify(file, null, 2);
}

export function projectFromJson(
  json: string,
  lib: PartLibrary,
): { doc: CircuitDocument; userParts: Array<{ id: string; name: string }>; tracked: TrackedSignal[] } {
  const file = JSON.parse(json) as ProjectFile;
  if (file.fileVersion !== FILE_VERSION) {
    throw new Error(`unsupported project file version ${file.fileVersion}`);
  }
  for (const entry of file.parts ?? []) {
    const id = lib.add(entry.def); // validates against already-loaded deps
    if (id !== entry.id) {
      throw new Error(
        `part "${entry.name}" re-hashed to a different id — the file is corrupted ` +
        `or from an incompatible version`);
    }
  }
  // Palette = the explicit subset; older files (no palette) treated every
  // serialized part as a palette entry, so fall back to that.
  const paletteSrc = file.palette ?? (file.parts ?? []).map((e) => ({ id: e.id, name: e.name }));
  const userParts = paletteSrc.map((e) => ({ id: e.id, name: e.name }));
  const doc = fromJSON(file.document);
  for (const comp of doc.components.values()) {
    const known = comp.part === "io:in" || comp.part === "io:out" || lib.has(comp.part);
    if (!known) {
      throw new Error(`component ${comp.id} references unknown part "${comp.part}"`);
    }
  }
  return { doc, userParts, tracked: file.trackedSignals ?? [] };
}

/** Replace the contents of `target` with `source` in place, preserving
 *  object identity (selection, tools, and the render loop hold references
 *  to the document instance). */
export function replaceDocumentContents(target: CircuitDocument, source: CircuitDocument): void {
  target.components.clear();
  target.wires.clear();
  target.strokes.clear();
  target.groups.clear();
  for (const [k, v] of source.components) target.components.set(k, v);
  for (const [k, v] of source.wires) target.wires.set(k, v);
  for (const [k, v] of source.strokes) target.strokes.set(k, v);
  for (const [k, v] of source.groups) target.groups.set(k, v);
  target.nextId = source.nextId;
  target.revision++;
}

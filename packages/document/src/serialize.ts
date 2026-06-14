import { CircuitDocument } from "./model.js";
import type { Component, Group, InkStroke, Wire } from "./model.js";

export const DOC_VERSION = 1;

export interface DocumentJson {
  docVersion: number;
  /** Persisted id counter — ids are NEVER regenerated on load. */
  nextId: number;
  components: Component[];
  wires: Wire[];
  strokes: InkStroke[];
  groups: Group[];
}

export function toJSON(doc: CircuitDocument): DocumentJson {
  const byId = <T extends { id: number }>(m: Map<number, T>): T[] =>
    [...m.values()].sort((a, b) => a.id - b.id);
  return {
    docVersion: DOC_VERSION,
    nextId: doc.nextId,
    components: byId(doc.components),
    wires: byId(doc.wires),
    strokes: byId(doc.strokes),
    groups: byId(doc.groups),
  };
}

export function fromJSON(json: DocumentJson): CircuitDocument {
  if (json.docVersion !== DOC_VERSION) {
    throw new Error(`unsupported document version ${json.docVersion}`);
  }
  const doc = new CircuitDocument();
  let maxId = 0;
  const insert = <T extends { id: number }>(map: Map<number, T>, items: T[], what: string) => {
    for (const item of items) {
      if (!Number.isSafeInteger(item.id) || item.id < 1) {
        throw new Error(`invalid ${what} id ${item.id}`);
      }
      if (doc.exists(item.id)) throw new Error(`duplicate entity id ${item.id}`);
      map.set(item.id, item);
      if (item.id > maxId) maxId = item.id;
    }
  };
  insert(doc.components, json.components ?? [], "component");
  insert(doc.wires, json.wires ?? [], "wire");
  insert(doc.strokes, json.strokes ?? [], "stroke");
  insert(doc.groups, json.groups ?? [], "group");

  if (!Number.isSafeInteger(json.nextId) || json.nextId <= maxId) {
    throw new Error(`nextId ${json.nextId} must exceed the largest entity id ${maxId}`);
  }
  doc.nextId = json.nextId;
  return doc;
}

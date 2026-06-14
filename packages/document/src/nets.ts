import type { CircuitDocument, EntityId, PortRef, Wire } from "./model.js";

/**
 * Electrical nets are connected components of wires linked through shared
 * ports. The wire tool draws 2-port wires, so fanning out from one port
 * naturally produces several wires per net — the merge happens here, not
 * in the editor. Deterministic: wires processed in id order, groups
 * numbered by first appearance.
 */
export function computeNetGroups(doc: CircuitDocument): {
  groups: Wire[][];
  groupOfWire: Map<EntityId, number>;
} {
  const wires = [...doc.wires.values()].sort((a, b) => a.id - b.id);
  const parent = new Map<EntityId, EntityId>();
  for (const w of wires) parent.set(w.id, w.id);

  const find = (x: EntityId): EntityId => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const firstWireAtPort = new Map<string, EntityId>();
  for (const w of wires) {
    for (const p of w.ports) {
      const key = p.component + ":" + p.pin;
      const first = firstWireAtPort.get(key);
      if (first === undefined) firstWireAtPort.set(key, w.id);
      else parent.set(find(w.id), find(first));
    }
  }

  const indexOfRoot = new Map<EntityId, number>();
  const groups: Wire[][] = [];
  const groupOfWire = new Map<EntityId, number>();
  for (const w of wires) {
    const root = find(w.id);
    let gi = indexOfRoot.get(root);
    if (gi === undefined) {
      gi = groups.length;
      groups.push([]);
      indexOfRoot.set(root, gi);
    }
    groups[gi].push(w);
    groupOfWire.set(w.id, gi);
  }
  return { groups, groupOfWire };
}

/** Distinct ports of a net group, in deterministic wire/port order. */
export function groupPorts(group: Wire[]): PortRef[] {
  const seen = new Set<string>();
  const out: PortRef[] = [];
  for (const w of group) {
    for (const p of w.ports) {
      const key = p.component + ":" + p.pin;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p);
      }
    }
  }
  return out;
}

import type {
  CircuitDocument, Component, EntityId, Group, InkStroke, PortRef, Wire,
} from "./model.js";

/**
 * Invertible command. IDs for created entities are minted at command
 * construction, so undo -> redo reinserts the SAME ids (stable-ID rule).
 * Interaction commands that touch simulation carry `simTick`, never wall
 * time (determinism constraint #4).
 */
export interface Command {
  readonly label: string;
  /** Entity ids this command touches — undo restores them as the selection. */
  readonly affected: EntityId[];
  readonly simTick?: number;
  apply(doc: CircuitDocument): void;
  revert(doc: CircuitDocument): void;
}

export function addComponent(
  doc: CircuitDocument,
  init: Omit<Component, "id">,
): Command & { id: EntityId } {
  const id = doc.mintId();
  const component: Component = { ...init, id, props: { ...init.props } };
  return {
    id,
    label: `add ${init.part}`,
    affected: [id],
    apply: (d) => void d.components.set(id, component),
    revert: (d) => void d.components.delete(id),
  };
}

export function addWire(doc: CircuitDocument, ports: PortRef[]): Command & { id: EntityId } {
  const id = doc.mintId();
  const wire: Wire = { id, ports: ports.map((p) => ({ ...p })) };
  return {
    id,
    label: "add wire",
    affected: [id],
    apply: (d) => void d.wires.set(id, wire),
    revert: (d) => void d.wires.delete(id),
  };
}

export function addStroke(
  doc: CircuitDocument,
  init: Omit<InkStroke, "id">,
): Command & { id: EntityId } {
  const id = doc.mintId();
  const stroke: InkStroke = { ...init, id, points: init.points.map((p) => ({ ...p })) };
  return {
    id,
    label: "ink stroke",
    affected: [id],
    apply: (d) => void d.strokes.set(id, stroke),
    revert: (d) => void d.strokes.delete(id),
  };
}

/**
 * Remove entities by id, cascading: removing a component also removes
 * wires touching it; group membership shrinks; groups in the set (or
 * emptied) are removed. Captures everything on first apply so revert
 * restores the exact prior state. O(selection + touching wires).
 */
export function removeEntities(ids: EntityId[]): Command {
  const idSet = new Set(ids);
  let captured = false;
  const removedComponents: Component[] = [];
  const removedWires: Wire[] = [];
  const removedStrokes: InkStroke[] = [];
  const removedGroups: Group[] = [];
  const shrunkGroups: Array<{ id: EntityId; before: EntityId[] }> = [];

  return {
    label: `delete ${ids.length} entities`,
    affected: [...ids],
    apply(doc) {
      if (!captured) {
        captured = true;
        for (const id of idSet) {
          const c = doc.components.get(id);
          if (c) {
            removedComponents.push(c);
            for (const w of doc.wiresTouching(id)) {
              if (!idSet.has(w.id) && !removedWires.includes(w)) removedWires.push(w);
            }
            continue;
          }
          const w = doc.wires.get(id);
          if (w) { removedWires.push(w); continue; }
          const s = doc.strokes.get(id);
          if (s) { removedStrokes.push(s); continue; }
          const g = doc.groups.get(id);
          if (g) removedGroups.push(g);
        }
        const goneIds = new Set<EntityId>([
          ...removedComponents.map((c) => c.id),
          ...removedWires.map((w) => w.id),
          ...removedStrokes.map((s) => s.id),
        ]);
        for (const g of doc.groups.values()) {
          if (removedGroups.includes(g)) continue;
          if (g.members.some((m) => goneIds.has(m))) {
            shrunkGroups.push({ id: g.id, before: [...g.members] });
          }
        }
      }
      for (const c of removedComponents) doc.components.delete(c.id);
      for (const w of removedWires) doc.wires.delete(w.id);
      for (const s of removedStrokes) doc.strokes.delete(s.id);
      for (const g of removedGroups) doc.groups.delete(g.id);
      for (const { id, before } of shrunkGroups) {
        const g = doc.groups.get(id)!;
        const gone = new Set([
          ...removedComponents.map((c) => c.id),
          ...removedWires.map((w) => w.id),
          ...removedStrokes.map((s) => s.id),
        ]);
        g.members = before.filter((m) => !gone.has(m));
        if (g.members.length === 0) {
          removedGroups.push(g);
          doc.groups.delete(id);
        }
      }
    },
    revert(doc) {
      for (const c of removedComponents) doc.components.set(c.id, c);
      for (const w of removedWires) doc.wires.set(w.id, w);
      for (const s of removedStrokes) doc.strokes.set(s.id, s);
      for (const g of removedGroups) doc.groups.set(g.id, g);
      for (const { id, before } of shrunkGroups) {
        const g = doc.groups.get(id);
        if (g) g.members = [...before];
      }
    },
  };
}

export function moveComponents(ids: EntityId[], dx: number, dy: number): Command {
  return {
    label: `move ${ids.length} components`,
    affected: [...ids],
    apply(doc) {
      for (const id of ids) {
        const c = doc.components.get(id);
        if (c) { c.x += dx; c.y += dy; }
      }
    },
    revert(doc) {
      for (const id of ids) {
        const c = doc.components.get(id);
        if (c) { c.x -= dx; c.y -= dy; }
      }
    },
  };
}

export function setProp(
  id: EntityId,
  key: string,
  value: number | string,
  simTick?: number,
): Command {
  let old: number | string | undefined;
  let captured = false;
  return {
    label: `set ${key}`,
    affected: [id],
    simTick,
    apply(doc) {
      const c = doc.components.get(id);
      if (!c) throw new Error(`no component ${id}`);
      if (!captured) { captured = true; old = c.props[key]; }
      c.props[key] = value;
    },
    revert(doc) {
      const c = doc.components.get(id);
      if (!c) return;
      if (old === undefined) delete c.props[key];
      else c.props[key] = old;
    },
  };
}

/**
 * Interactive poke of an input component. MUST carry the simulation tick
 * at which it applies — this is what makes command sequences replayable
 * identically across platforms.
 */
export function pokeInput(id: EntityId, value: number, simTick: number): Command {
  if (!Number.isSafeInteger(simTick) || simTick < 0) {
    throw new Error(`pokeInput requires an integer simulation tick, got ${simTick}`);
  }
  return setProp(id, "value", value, simTick);
}

export function createGroup(doc: CircuitDocument, members: EntityId[]): Command & { id: EntityId } {
  const id = doc.mintId();
  return {
    id,
    label: "group",
    affected: [id, ...members],
    apply(d) {
      for (const m of members) {
        if (d.groupOf(m)) throw new Error(`entity ${m} is already grouped (no nesting in V1)`);
      }
      d.groups.set(id, { id, members: [...members] });
    },
    revert: (d) => void d.groups.delete(id),
  };
}

export function dissolveGroup(id: EntityId): Command {
  let captured: Group | undefined;
  return {
    label: "ungroup",
    affected: [id],
    apply(doc) {
      captured = doc.groups.get(id);
      doc.groups.delete(id);
    },
    revert(doc) {
      if (captured) doc.groups.set(id, captured);
    },
  };
}

import {
  SchemaError,
  type InstanceSpec, type NetSpec, type PartDefinition, type PartLibrary, type PinSpec,
} from "@logicsim/schema";
import type { CircuitDocument, Component, EntityId, PortRef, Wire } from "./model.js";
import type { Command } from "./commands.js";
import { computeNetGroups, groupPorts } from "./nets.js";

export interface CreateChipResult {
  command: Command;
  /** Content-hash id of the newly registered part. */
  partId: string;
  /** Entity id of the replacement component (minted now, stable forever). */
  componentId: EntityId;
}

/**
 * "Create chip from selection" (plan M4): turns the selected components
 * (plus nets fully inside the selection) into a registered part
 * definition, and replaces them in the document with ONE instance of it.
 *
 * Boundary rule operates on merged electrical nets (see nets.ts), not
 * individual wires: a net with ports both inside and outside becomes an
 * interface pin — "out" if any inside port drives it, else "in".
 * Fully-inside nets become internal nets of the definition. The whole
 * replacement is one undoable command.
 */
export function createChipFromSelection(
  doc: CircuitDocument,
  lib: PartLibrary,
  ids: EntityId[],
  meta: { name: string; version: string },
): CreateChipResult {
  const inside = new Set<EntityId>();
  for (const id of ids) {
    const comp = doc.components.get(id);
    if (!comp) continue; // wires/strokes resolve via the net pass
    if (comp.part === "io:in" || comp.part === "io:out") {
      throw new Error("IO pins cannot be inside a chip — leave them out of the selection");
    }
    if (doc.groupOf(id)) {
      throw new Error("grouped entities cannot be chipped — ungroup first");
    }
    inside.add(id);
  }
  if (inside.size === 0) {
    throw new Error("select at least one component to create a chip");
  }

  const pinOf = (ref: PortRef) => {
    const comp = doc.components.get(ref.component);
    return comp ? lib.resolveInterface(comp.part)?.pins.find((p) => p.name === ref.pin) : undefined;
  };
  const portWidth = (ref: PortRef): number => {
    const pin = pinOf(ref);
    return pin && pin.width > 0 ? pin.width : 1;
  };

  // ---- classify merged nets against the selection boundary
  const { groups } = computeNetGroups(doc);
  const netNameOfWire = new Map<EntityId, string>();
  const nets: NetSpec[] = [];
  const pins: PinSpec[] = [];
  const removedWires: Wire[] = [];
  const rewires: Array<{ id: EntityId; before: PortRef[]; after: PortRef[] }> = [];
  const componentId = doc.mintId();
  let inCount = 0, outCount = 0;

  for (const group of groups) {
    const ports = groupPorts(group);
    const insidePorts = ports.filter((p) => inside.has(p.component));
    if (insidePorts.length === 0) continue;
    const isCrossing = insidePorts.length < ports.length;

    let netName: string;
    if (isCrossing) {
      const drives = insidePorts.some((p) => pinOf(p)?.dir === "out");
      netName = drives ? `out${++outCount}` : `in${++inCount}`;
      pins.push({
        name: netName,
        dir: drives ? "out" : "in",
        width: Math.max(...insidePorts.map(portWidth)),
        side: drives ? "right" : "left",
      });
    } else {
      netName = `w${group[0].id}`;
      nets.push({ name: netName, width: Math.max(...ports.map(portWidth)) });
    }
    for (const wire of group) {
      netNameOfWire.set(wire.id, netName);
      const wireInside = wire.ports.filter((p) => inside.has(p.component));
      if (wireInside.length === 0) continue; // outside wiring of a crossing net
      const wireOutside = wire.ports.filter((p) => !inside.has(p.component));
      if (!isCrossing || wireOutside.length === 0) {
        removedWires.push(wire); // absorbed into the definition
      } else {
        rewires.push({
          id: wire.id,
          before: [...wire.ports],
          after: [...wireOutside, { component: componentId, pin: netName }],
        });
      }
    }
  }

  // ---- definition body
  const insideComps = [...inside].sort((a, b) => a - b).map((id) => doc.components.get(id)!);
  const instances: InstanceSpec[] = [];
  for (const comp of insideComps) {
    const iface = lib.resolveInterface(comp.part);
    if (!iface) throw new Error(`component ${comp.id}: unknown part "${comp.part}"`);
    const connections: Record<string, string> = {};
    const touching = doc.wiresTouching(comp.id);
    for (const pin of iface.pins) {
      const wire = touching.find((w) =>
        w.ports.some((p) => p.component === comp.id && p.pin === pin.name));
      if (wire) {
        connections[pin.name] = netNameOfWire.get(wire.id)!;
      } else {
        const name = `nc_c${comp.id}_${pin.name}`;
        nets.push({ name, width: pin.width === 0 ? 1 : pin.width });
        connections[pin.name] = name;
      }
    }
    const numeric = Object.entries(comp.props)
      .filter((e): e is [string, number] => typeof e[1] === "number");
    instances.push({
      id: `c${comp.id}`,
      part: comp.part,
      ...(numeric.length > 0 && { props: Object.fromEntries(numeric) }),
      connections,
    });
  }

  const def: PartDefinition = {
    schemaVersion: 1,
    name: meta.name,
    version: meta.version,
    interface: { pins },
    body: {
      kind: "structural",
      nets: nets.sort((a, b) => (a.name < b.name ? -1 : 1)),
      instances,
    },
  };

  let partId: string;
  try {
    partId = lib.add(def);
  } catch (err) {
    if (err instanceof SchemaError && pins.length === 0) {
      throw new Error("the selection has no external connections — a chip needs at least one pin");
    }
    throw err;
  }

  // ---- replacement command (all state captured now)
  const cx = Math.round(insideComps.reduce((s, c) => s + c.x, 0) / insideComps.length / 10) * 10;
  const cy = Math.round(insideComps.reduce((s, c) => s + c.y, 0) / insideComps.length / 10) * 10;
  const newComp: Component = {
    id: componentId, part: partId, x: cx, y: cy, rot: 0, props: {},
  };

  const command: Command = {
    label: `create chip ${meta.name}`,
    affected: [componentId],
    apply(d) {
      for (const comp of insideComps) d.components.delete(comp.id);
      for (const w of removedWires) d.wires.delete(w.id);
      for (const r of rewires) d.wires.get(r.id)!.ports = r.after.map((p) => ({ ...p }));
      d.components.set(componentId, newComp);
    },
    revert(d) {
      d.components.delete(componentId);
      for (const comp of insideComps) d.components.set(comp.id, comp);
      for (const w of removedWires) d.wires.set(w.id, w);
      for (const r of rewires) d.wires.get(r.id)!.ports = r.before.map((p) => ({ ...p }));
    },
  };

  return { command, partId, componentId };
}

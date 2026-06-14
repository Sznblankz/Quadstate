/**
 * Hierarchy dive (prototype Card F): build a synthetic, read-only
 * CircuitDocument for a chip definition's interior so the existing
 * renderer can draw it with LIVE values.
 *
 * Part definitions store structure (instances + nets), not layout — the
 * gray-box answer is a deterministic auto-layout: interface in-pins down
 * the left edge, out-pins down the right, instances in a grid between.
 * Net values resolve through the elaboration at `path` + net name (the
 * same hierarchical-path convention the Inspector probes with).
 */
import { SpatialGrid, componentBounds, wireBounds } from "@logicsim/canvas";
import { CircuitDocument, Selection, type EntityId } from "@logicsim/document";
import type { Elaboration, PartLibrary } from "@logicsim/schema";

export interface DiveLevel {
  doc: CircuitDocument;
  grid: SpatialGrid;
  selection: Selection;
  wireNets: Map<EntityId, number>;
  ioNets: Map<EntityId, number>;
  /** Synthetic component id -> instance spec, for diving deeper. */
  instOf: Map<EntityId, { instId: string; part: string }>;
  name: string;
  partId: string;
  /** Hierarchical net-path prefix, e.g. "c12/" or "c12/c3/". */
  path: string;
  /** Viewport to restore when surfacing out of this level. */
  returnView: { x: number; y: number; zoom: number };
}

export function buildInterior(
  lib: PartLibrary,
  partId: string,
  path: string,
  name: string,
  elab: Elaboration | null,
  returnView: { x: number; y: number; zoom: number },
): DiveLevel | null {
  const def = lib.get(partId);
  if (!def || def.body.kind !== "structural") return null;

  const doc = new CircuitDocument();
  const wireNets = new Map<EntityId, number>();
  const ioNets = new Map<EntityId, number>();
  const instOf = new Map<EntityId, { instId: string; part: string }>();
  /** net name -> ports of synthetic components on that net */
  const netPorts = new Map<string, Array<{ component: EntityId; pin: string }>>();
  const onNet = (net: string, component: EntityId, pin: string) => {
    const list = netPorts.get(net);
    if (list) list.push({ component, pin });
    else netPorts.set(net, [{ component, pin }]);
  };

  // Interface pins become boundary io markers; a pin's name IS its net.
  const ins = def.interface.pins.filter((p) => p.dir === "in");
  const outs = def.interface.pins.filter((p) => p.dir === "out");
  const instances = def.body.instances;
  const cols = Math.max(1, Math.ceil(Math.sqrt(instances.length)));
  const rows = Math.ceil(instances.length / cols);
  const bodyW = cols * 160;
  const bodyH = Math.max(rows * 120, Math.max(ins.length, outs.length) * 80);

  ins.forEach((pin, i) => {
    const id = doc.mintId();
    doc.components.set(id, {
      id, part: "io:in", x: 0, y: 40 + i * 80, rot: 0,
      props: { name: pin.name, width: pin.width },
    });
    onNet(pin.name, id, "pin");
    const nets = elab?.resolveNet(path + pin.name);
    if (nets) ioNets.set(id, nets[0]);
  });
  outs.forEach((pin, i) => {
    const id = doc.mintId();
    doc.components.set(id, {
      id, part: "io:out", x: 160 + bodyW, y: 40 + i * 80, rot: 0,
      props: { name: pin.name, width: pin.width },
    });
    onNet(pin.name, id, "pin");
    const nets = elab?.resolveNet(path + pin.name);
    if (nets) ioNets.set(id, nets[0]);
  });

  instances.forEach((inst, i) => {
    const id = doc.mintId();
    doc.components.set(id, {
      id, part: inst.part,
      x: 120 + (i % cols) * 160,
      y: 40 + Math.floor(i / cols) * 120,
      rot: 0,
      props: { ...inst.props },
    });
    instOf.set(id, { instId: inst.id, part: inst.part });
    for (const [pin, net] of Object.entries(inst.connections)) {
      onNet(net, id, pin);
    }
  });

  for (const [net, ports] of netPorts) {
    if (ports.length < 2) continue;
    const id = doc.mintId();
    doc.wires.set(id, { id, ports });
    const nets = elab?.resolveNet(path + net);
    if (nets) wireNets.set(id, nets[0]);
  }

  const grid = new SpatialGrid(200);
  for (const comp of doc.components.values()) {
    const b = componentBounds(comp, lib);
    grid.insert(comp.id, b.x0, b.y0, b.x1, b.y1);
  }
  for (const wire of doc.wires.values()) {
    const b = wireBounds(doc, lib, wire.id);
    if (b) grid.insert(wire.id, b.x0, b.y0, b.x1, b.y1);
  }

  return {
    doc, grid, selection: new Selection(doc),
    wireNets, ioNets, instOf, name, partId, path, returnView,
  };
}

/** World-bounds of a synthetic interior, for fit-to-view. */
export function interiorBounds(level: DiveLevel, lib: PartLibrary) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const comp of level.doc.components.values()) {
    const b = componentBounds(comp, lib);
    x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
    x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
  }
  if (x0 === Infinity) return { x0: 0, y0: 0, x1: 100, y1: 100 };
  return { x0, y0, x1, y1 };
}

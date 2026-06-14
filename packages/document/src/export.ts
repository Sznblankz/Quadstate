import type {
  InstanceSpec, NetSpec, PartDefinition, PartLibrary, PinSpec,
} from "@logicsim/schema";
import type { CircuitDocument, Component, EntityId, PortRef } from "./model.js";
import { computeNetGroups, groupPorts } from "./nets.js";

export interface ProjectExport {
  def: PartDefinition;
  /** wire entity id -> net name inside the exported part (top-level path).
   *  Wires merged into one electrical net all map to the same name. */
  wireNet: Map<EntityId, string>;
  /** io component id -> its interface pin name. */
  ioPin: Map<EntityId, string>;
}

export function exportAsPart(
  doc: CircuitDocument,
  lib: PartLibrary,
  meta: { name: string; version: string },
): PartDefinition {
  return exportProject(doc, lib, meta).def;
}

/**
 * Compile a document into a structural part definition. Wires connected
 * through shared ports merge into one net (see nets.ts); io:in / io:out
 * components become interface pins whose net is the merged net of their
 * wires. An io:out sharing a net with an io:in (switch wired straight to
 * an LED) gets a synthesized buffer instance, since the schema cannot
 * alias two pins to one net. A project file is "a top-level part +
 * annotations" per the plan — this is that lowering.
 */
export function exportProject(
  doc: CircuitDocument,
  lib: PartLibrary,
  meta: { name: string; version: string },
): ProjectExport {
  const pins: PinSpec[] = [];
  const nets: NetSpec[] = [];
  const instances: InstanceSpec[] = [];
  const wireNet = new Map<EntityId, string>();
  const ioPin = new Map<EntityId, string>();

  const { groups, groupOfWire } = computeNetGroups(doc);

  type IoComponent = Component & { part: "io:in" | "io:out" };
  const isIo = (c: Component | undefined): c is IoComponent =>
    c !== undefined && (c.part === "io:in" || c.part === "io:out");

  const ioName = (io: Component): string => {
    const name = io.props.name;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`io component ${io.id} needs a string "name" prop`);
    }
    return name;
  };

  const portPinWidth = (ref: PortRef): number => {
    const comp = doc.components.get(ref.component);
    if (!comp) return 1;
    if (isIo(comp)) return Number(comp.props.width ?? 1);
    const pin = lib.resolveInterface(comp.part)?.pins.find((p) => p.name === ref.pin);
    return pin && pin.width > 0 ? pin.width : 1;
  };

  // ---- interface pins from io components (deterministic id order)
  const ioComponents = [...doc.components.values()].filter(isIo).sort((a, b) => a.id - b.id);
  for (const io of ioComponents) {
    const name = ioName(io);
    ioPin.set(io.id, name);
    pins.push({
      name,
      dir: io.part === "io:in" ? "in" : "out",
      width: Number(io.props.width ?? 1),
      side: io.part === "io:in" ? "left" : "right",
    });
  }

  // ---- name each net group; alias extra io:out pins through buffers
  const groupName: string[] = new Array(groups.length);
  for (let gi = 0; gi < groups.length; gi++) {
    const ports = groupPorts(groups[gi]);
    const ios = ports
      .map((p) => doc.components.get(p.component))
      .filter(isIo)
      .sort((a, b) => a.id - b.id);
    const ins = ios.filter((c) => c.part === "io:in");
    const outs = ios.filter((c) => c.part === "io:out");
    if (ins.length > 1) {
      throw new Error(
        `input pins "${ioName(ins[0])}" and "${ioName(ins[1])}" are on the same net — ` +
        `two inputs cannot share a wire`);
    }
    const primary = ins[0] ?? outs[0];
    if (primary) {
      groupName[gi] = ioName(primary);
      // Any FURTHER out pin on this net mirrors it through a buffer.
      for (const out of outs) {
        if (out === primary) continue;
        instances.push({
          id: `alias_c${out.id}`,
          part: "builtin:buf",
          connections: { a: groupName[gi], y: ioName(out) },
        });
      }
    } else {
      const name = `w${groups[gi][0].id}`;
      groupName[gi] = name;
      nets.push({ name, width: Math.max(...ports.map(portPinWidth)) });
    }
    for (const w of groups[gi]) wireNet.set(w.id, groupName[gi]);
  }

  // ---- instances from non-io components
  // (plain boolean test: a negated type predicate would collapse to never)
  const realComponents = [...doc.components.values()]
    .filter((c) => c.part !== "io:in" && c.part !== "io:out")
    .sort((a, b) => a.id - b.id);

  for (const comp of realComponents) {
    const iface = lib.resolveInterface(comp.part);
    if (!iface) throw new Error(`component ${comp.id}: unknown part "${comp.part}"`);

    const connections: Record<string, string> = {};
    const touching = doc.wiresTouching(comp.id);
    for (const pin of iface.pins) {
      const wire = touching.find((w) =>
        w.ports.some((p) => p.component === comp.id && p.pin === pin.name));
      if (wire) {
        connections[pin.name] = groupName[groupOfWire.get(wire.id)!];
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
    annotations: [...doc.strokes.values()].sort((a, b) => a.id - b.id),
  };
  return { def, wireNet, ioPin };
}

/**
 * Edit Definition (P7) round-trip: serialize an *editable interior document*
 * (boundary io:in/io:out markers + instance components + wires) back into a
 * structural PartDefinition.
 *
 * This is the inverse of proto/dive.ts `buildInterior`: there, a definition is
 * laid out as a synthetic doc; here, an edited doc is folded back into a
 * definition. Boundary io markers become interface pins (a pin name doubles as
 * its net name — the elaboration convention, see elaborate.ts), everything else
 * becomes an instance, and wire nets become either pin nets or internal nets.
 *
 * Deferred (per brief): bus-aware widths beyond what the markers carry, and
 * io:in→io:out pass-through pins (rare; would need a synthesized buffer).
 */
import { computeNetGroups, groupPorts, type CircuitDocument, type PortRef } from "@logicsim/document";
import type {
  InstanceSpec, NetSpec, PartDefinition, PartLibrary, PinSpec,
} from "@logicsim/schema";

const isIoPart = (p: string): boolean => p === "io:in" || p === "io:out";

export function definitionFromInterior(
  doc: CircuitDocument,
  lib: PartLibrary,
  name: string,
  version: string,
): PartDefinition {
  const widthOf = (ref: PortRef): number => {
    const comp = doc.components.get(ref.component);
    if (!comp) return 1;
    if (isIoPart(comp.part)) {
      return typeof comp.props.width === "number" && comp.props.width > 0 ? comp.props.width : 1;
    }
    const p = lib.resolveInterface(comp.part)?.pins.find((pin) => pin.name === ref.pin);
    return p && p.width > 0 ? p.width : 1;
  };

  const { groups } = computeNetGroups(doc);
  const netNameOfWire = new Map<number, string>();
  const nets: NetSpec[] = [];
  const pins: PinSpec[] = [];
  const pinByName = new Map<string, PinSpec>();
  const pinY = new Map<string, number>(); // pin name -> marker y, for ordering
  let internalCount = 0;

  // Classify each electrical net: touches an io marker -> interface pin,
  // otherwise an internal net.
  for (const group of groups) {
    const ports = groupPorts(group);
    const ioPorts = ports.filter((p) => {
      const c = doc.components.get(p.component);
      return c !== undefined && isIoPart(c.part);
    });
    let netName: string;
    if (ioPorts.length > 0) {
      // An io:out makes it an output pin; otherwise io:in -> input pin.
      const outPort = ioPorts.find((p) => doc.components.get(p.component)!.part === "io:out");
      const marker = doc.components.get((outPort ?? ioPorts[0]).component)!;
      const dir = marker.part === "io:out" ? "out" : "in";
      netName = String(marker.props.name ?? `pin${marker.id}`);
      if (!pinByName.has(netName)) {
        const pin: PinSpec = {
          name: netName, dir,
          width: Math.max(...ports.map(widthOf)),
          side: dir === "out" ? "right" : "left",
        };
        pins.push(pin);
        pinByName.set(netName, pin);
        pinY.set(netName, marker.y);
      }
    } else {
      netName = `n${internalCount++}`;
      nets.push({ name: netName, width: Math.max(...ports.map(widthOf)) });
    }
    for (const w of group) netNameOfWire.set(w.id, netName);
  }

  // Unwired io markers still declare interface pins.
  for (const comp of doc.components.values()) {
    if (!isIoPart(comp.part)) continue;
    const nm = String(comp.props.name ?? `pin${comp.id}`);
    if (pinByName.has(nm)) continue;
    const dir = comp.part === "io:out" ? "out" : "in";
    const pin: PinSpec = {
      name: nm, dir,
      width: typeof comp.props.width === "number" && comp.props.width > 0 ? comp.props.width : 1,
      side: dir === "out" ? "right" : "left",
    };
    pins.push(pin);
    pinByName.set(nm, pin);
    pinY.set(nm, comp.y);
  }

  // Non-io components become instances; each pin connects to its net (or a
  // fresh no-connect net so the definition is complete).
  const instances: InstanceSpec[] = [];
  const insideComps = [...doc.components.values()]
    .filter((c) => !isIoPart(c.part))
    .sort((a, b) => a.id - b.id);
  for (const comp of insideComps) {
    const iface = lib.resolveInterface(comp.part);
    if (!iface) throw new Error(`unknown part "${comp.part}"`);
    const connections: Record<string, string> = {};
    const touching = doc.wiresTouching(comp.id);
    for (const pin of iface.pins) {
      const wire = touching.find((w) =>
        w.ports.some((p) => p.component === comp.id && p.pin === pin.name));
      if (wire) {
        connections[pin.name] = netNameOfWire.get(wire.id)!;
      } else {
        const nm = `nc_c${comp.id}_${pin.name}`;
        nets.push({ name: nm, width: pin.width === 0 ? 1 : pin.width });
        connections[pin.name] = nm;
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

  // Inputs before outputs, each ordered top-to-bottom (matches the dive layout).
  pins.sort((a, b) => {
    if (a.dir !== b.dir) return a.dir === "in" ? -1 : 1;
    return (pinY.get(a.name) ?? 0) - (pinY.get(b.name) ?? 0) || (a.name < b.name ? -1 : 1);
  });

  return {
    schemaVersion: 1,
    name,
    version,
    interface: { pins },
    body: {
      kind: "structural",
      nets: nets.sort((a, b) => (a.name < b.name ? -1 : 1)),
      instances,
    },
  };
}

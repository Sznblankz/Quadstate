/**
 * Circuit document model.
 *
 * Stable entity IDs (plan requirement): every entity carries a unique id
 * minted from a monotonic counter that is persisted in the document and
 * NEVER regenerated on load. Copy/duplicate mints fresh ids. IDs are the
 * backbone of selection, the hierarchy map, and re-elaboration carry-over.
 */

export type EntityId = number;
export type EntityType = "component" | "wire" | "stroke" | "group";

export interface Component {
  id: EntityId;
  /** "builtin:*", "io:in", "io:out", or a content-hash part id. */
  part: string;
  x: number;
  y: number;
  /** Quarter-turn rotation, 0..3. */
  rot: 0 | 1 | 2 | 3;
  props: Record<string, number | string>;
}

export interface PortRef {
  component: EntityId;
  pin: string;
}

/** One wire = one electrical net connecting >= 2 ports.
 *  Routing geometry is added by the canvas layer in M3. */
export interface Wire {
  id: EntityId;
  ports: PortRef[];
}

export interface StrokePoint {
  x: number;
  y: number;
  /** Pen pressure 0..1 (1 for mouse). */
  p: number;
}

export interface InkStroke {
  id: EntityId;
  points: StrokePoint[];
  baseWidth: number;
  color: string;
}

export interface Group {
  id: EntityId;
  members: EntityId[];
}

export class CircuitDocument {
  /** Monotonic id source; persisted, never reset (plan: stable IDs). */
  nextId: EntityId = 1;
  /** Bumped on every executed/undone/redone command (renderer dirty flag). */
  revision = 0;

  readonly components = new Map<EntityId, Component>();
  readonly wires = new Map<EntityId, Wire>();
  readonly strokes = new Map<EntityId, InkStroke>();
  readonly groups = new Map<EntityId, Group>();

  mintId(): EntityId {
    return this.nextId++;
  }

  typeOf(id: EntityId): EntityType | undefined {
    if (this.components.has(id)) return "component";
    if (this.wires.has(id)) return "wire";
    if (this.strokes.has(id)) return "stroke";
    if (this.groups.has(id)) return "group";
    return undefined;
  }

  exists(id: EntityId): boolean {
    return this.typeOf(id) !== undefined;
  }

  wiresTouching(componentId: EntityId): Wire[] {
    const out: Wire[] = [];
    for (const w of this.wires.values()) {
      if (w.ports.some((p) => p.component === componentId)) out.push(w);
    }
    return out;
  }

  /** The group an entity belongs to, if any (groups don't nest in V1). */
  groupOf(id: EntityId): Group | undefined {
    for (const g of this.groups.values()) {
      if (g.members.includes(id)) return g;
    }
    return undefined;
  }
}

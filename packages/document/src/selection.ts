import type { CircuitDocument, EntityId, EntityType } from "./model.js";

/**
 * Selection subsystem (plan refinement #2): first-class indexed state,
 * never derived by scanning the document. The flat `all` set plus
 * per-type indexes are maintained incrementally; bulk commands take the
 * id set directly, so they're O(selection), not O(document).
 *
 * Selection is SESSION state: not serialized, not in the undo stack.
 * History restores it from each command's affected-id set on undo/redo.
 *
 * Groups select as a unit: adding any member adds the group entity and
 * all of its members.
 */
export class Selection {
  readonly all = new Set<EntityId>();
  private readonly byType: Record<EntityType, Set<EntityId>> = {
    component: new Set(),
    wire: new Set(),
    stroke: new Set(),
    group: new Set(),
  };

  constructor(private readonly doc: CircuitDocument) {}

  ofType(t: EntityType): ReadonlySet<EntityId> {
    return this.byType[t];
  }

  get size(): number {
    return this.all.size;
  }

  has(id: EntityId): boolean {
    return this.all.has(id);
  }

  ids(): EntityId[] {
    return [...this.all];
  }

  add(ids: Iterable<EntityId>): void {
    for (const id of this.expandGroups(ids)) {
      const t = this.doc.typeOf(id);
      if (t === undefined || this.all.has(id)) continue;
      this.all.add(id);
      this.byType[t].add(id);
    }
  }

  remove(ids: Iterable<EntityId>): void {
    for (const id of this.expandGroups(ids)) {
      if (!this.all.delete(id)) continue;
      for (const set of Object.values(this.byType)) set.delete(id);
    }
  }

  toggle(id: EntityId): void {
    if (this.all.has(id)) this.remove([id]);
    else this.add([id]);
  }

  clear(): void {
    this.all.clear();
    for (const set of Object.values(this.byType)) set.clear();
  }

  setTo(ids: Iterable<EntityId>): void {
    this.clear();
    this.add(ids);
  }

  /** Drop ids whose entities no longer exist (after destructive commands). */
  prune(): void {
    for (const id of [...this.all]) {
      if (!this.doc.exists(id)) {
        this.all.delete(id);
        for (const set of Object.values(this.byType)) set.delete(id);
      }
    }
  }

  /** Group-as-unit expansion: member -> its group id + all members. */
  private *expandGroups(ids: Iterable<EntityId>): Iterable<EntityId> {
    for (const id of ids) {
      const group = this.doc.groups.get(id) ?? this.doc.groupOf(id);
      if (group) {
        yield group.id;
        yield* group.members;
      } else {
        yield id;
      }
    }
  }
}

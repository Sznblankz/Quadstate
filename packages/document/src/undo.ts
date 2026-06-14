import type { Command } from "./commands.js";
import type { CircuitDocument } from "./model.js";
import type { Selection } from "./selection.js";

/**
 * Undo/redo over invertible commands. Selection is session state outside
 * the stack, but each command records its affected ids, so undo/redo
 * restores the relevant entities AS the selection (plan ripple-effect #5).
 */
export class History {
  private done: Command[] = [];
  private undone: Command[] = [];

  execute(doc: CircuitDocument, cmd: Command, selection?: Selection): void {
    cmd.apply(doc);
    doc.revision++;
    this.done.push(cmd);
    this.undone.length = 0;
    selection?.prune();
  }

  /** Drop all undo/redo state (e.g. after loading a project file). */
  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  undo(doc: CircuitDocument, selection?: Selection): void {
    const cmd = this.done.pop();
    if (!cmd) return;
    cmd.revert(doc);
    doc.revision++;
    this.undone.push(cmd);
    if (selection) {
      selection.setTo(cmd.affected); // setTo skips ids that no longer exist
    }
  }

  redo(doc: CircuitDocument, selection?: Selection): void {
    const cmd = this.undone.pop();
    if (!cmd) return;
    cmd.apply(doc);
    doc.revision++;
    this.done.push(cmd);
    if (selection) {
      selection.setTo(cmd.affected);
    }
  }
}

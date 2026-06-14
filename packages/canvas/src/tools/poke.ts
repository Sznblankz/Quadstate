import { pokeInput } from "@logicsim/document";
import type { Intent } from "../input/types.js";
import type { Tool, ToolContext } from "./types.js";

/**
 * Poke tool: tap a switch (io:in) to advance its value. Cycles through all
 * four logic states 0 → 1 → X → Z → 0 (engine codes LO/HI/X/Z = 0/1/2/3) so
 * every state is reachable by clicking — the acceptance path for the 4-state
 * signal language. The command records the SIMULATION tick (determinism
 * rule); the bridge forwards the new value to the engine.
 */
export class PokeTool implements Tool {
  readonly id = "poke";

  intent(i: Intent, ctx: ToolContext): void {
    if (i.type !== "tap" || i.target?.type !== "component") return;
    const comp = ctx.doc.components.get(i.target.id);
    if (!comp || comp.part !== "io:in") return;
    const cur = typeof comp.props.value === "number" ? comp.props.value : 0;
    const next = (cur + 1) % 4; // 0→1→X→Z→0
    ctx.history.execute(ctx.doc, pokeInput(comp.id, next, ctx.simTick()), ctx.selection);
    ctx.poke(comp.id, next);
    ctx.requestRender();
  }
}

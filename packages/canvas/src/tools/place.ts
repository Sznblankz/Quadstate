import { addComponent } from "@logicsim/document";
import { isIo, stampOrigin } from "../symbols.js";
import type { Intent } from "../input/types.js";
import type { Tool, ToolContext } from "./types.js";

/**
 * Place tool: armed with a part id from the palette; each tap drops one
 * instance (stays armed for rapid placement). IO pins are auto-named.
 */
export class PlaceTool implements Tool {
  readonly id = "place";

  constructor(public part: string, private extraProps: Record<string, number | string> = {}) {}

  intent(i: Intent, ctx: ToolContext): void {
    if (i.type !== "tap") return;
    const props: Record<string, number | string> = {};
    if (isIo(this.part)) {
      props.name = nextIoName(ctx, this.part);
      props.width = 1;
      if (this.part === "io:in") props.value = 0;
    }
    Object.assign(props, this.extraProps);
    if (this.part === "builtin:clock") props.halfPeriod = 50;
    if (this.part === "builtin:dff") props.init = 0;

    const origin = stampOrigin(this.part, ctx.lib, i.wx, i.wy, ctx.snap !== false);
    const cmd = addComponent(ctx.doc, {
      part: this.part,
      x: origin.x,
      y: origin.y,
      rot: 0,
      props,
    });
    ctx.history.execute(ctx.doc, cmd, ctx.selection);
    ctx.selection.setTo([cmd.id]);
    ctx.structureChanged();
    ctx.requestRender();
  }
}

function nextIoName(ctx: ToolContext, part: string): string {
  const prefix = part === "io:in" ? "in" : "out";
  const used = new Set<string>();
  for (const c of ctx.doc.components.values()) {
    if (c.part === part && typeof c.props.name === "string") used.add(c.props.name);
  }
  for (let n = 1; ; n++) {
    const name = `${prefix}${n}`;
    if (!used.has(name)) return name;
  }
}

export { Viewport } from "./transform.js";
export { SpatialGrid } from "./grid.js";
export { TOKENS, type Tokens } from "./tokens.js";
export { MIXED, aggregateBus, busHex, busBin } from "./bus.js";
export {
  SNAP, componentBounds, componentGeom, hitTest, isIo, layoutInterface,
  portPosition, stampOrigin, wireBounds, wireSegments,
  type ComponentGeom, type HitResult, type PortGeom,
} from "./symbols.js";
export type { Intent, PointerInput, PointerKind, WheelInput } from "./input/types.js";
export { GestureRecognizer, type RecognizerDeps } from "./input/recognizer.js";
export type { OverlayState, Tool, ToolContext } from "./tools/types.js";
export { SelectTool } from "./tools/select.js";
export { WireTool } from "./tools/wire.js";
export { PokeTool } from "./tools/poke.js";
export { ModelessTool } from "./tools/modeless.js";
export { InkTool } from "./tools/ink.js";
export { PlaceTool } from "./tools/place.js";
export {
  CanvasStack, renderInk, renderOverlay, renderSchematic, renderSignals,
  signalColor, type RenderState,
} from "./render/renderer.js";

import {
  CanvasStack, GestureRecognizer, ModelessTool, PlaceTool,
  SpatialGrid, Viewport, aggregateBus, busBin, busHex, componentBounds, hitTest, isIo, portPosition, stampOrigin, wireBounds, wireJunctions, wireSegments,
  renderInk, renderOverlay, renderSchematic, renderSignals,
  type HitResult, type Intent, type OverlayState, type PointerKind, type RenderState,
  type Tool, type ToolContext,
} from "@logicsim/canvas";
import { ContractTool } from "./proto/contract-tool.js";
import { ProtoLogger } from "./proto/logger.js";
import { buildInterior, interiorBounds, type DiveLevel } from "./proto/dive.js";
import {
  CircuitDocument, History, Selection, addComponent, addWire, computeNetGroups,
  createChipFromSelection, groupPorts, projectFromJson, projectToJson, registerStandardLibrary,
  removeEntities, replaceDocumentContents, setProp,
  type Component, type LibraryPart, type StorageProvider, type Wire,
} from "@logicsim/document";
import { PartLibrary, exportBundle, importBundle } from "@logicsim/schema";
import { definitionFromInterior } from "./editdef.js";
import { buildTemplate, TEMPLATES, type TemplateId } from "./templates.js";
import { SimBridge } from "./sim/bridge.js";
import { detectStorage } from "./storage.js";
import { saveProjectDraft, loadProjectDraft, newProjectId } from "./draft.js";

export interface UiState {
  placePart: string | null;
  running: boolean;
  status: string;
  statusOk: boolean;
  canUndo: boolean;
  canRedo: boolean;
  simTime: number;
  /** User-created chips available in the palette. */
  userParts: Array<{ id: string; name: string }>;
  /** Standard library parts available in the palette (fixed catalog). */
  libraryParts: Array<{ id: string; name: string }>;
  /** Single selected composite component, if any (drill-in target). */
  inspected: { componentId: number; partId: string; name: string } | null;
  /** Whether the selection can become a chip. */
  canCreateChip: boolean;
  /** Watched wires with their live value (P2). For buses (width>1) `value` is
   *  the aggregate state code and `hex`/`bin` carry the formatted bus value. */
  watches: Array<{ id: number; label: string; value: number | null; width: number; hex: string | null; bin: string | null }>;
  /** A single, not-yet-watched wire is selected (enables "+ Watch"). */
  canWatch: boolean;
  /** Editable numeric prop of the selected part (io bus width / constant value). */
  partConfig: { id: number; type: "io" | "const"; value: number; label: string; max: number } | null;
  /** Selected single wire's state when X/Z, enabling the Why? button (P3). */
  whyState: "X" | "Z" | null;
  /** Active Why? explanation, or null (P3). */
  why: { state: "X" | "Z"; title: string; message: string; drivers: string[] } | null;
  /** Gray-box interaction prototype mode (?proto=1). */
  proto: boolean;
  /** Hierarchy dive breadcrumb: names of the levels below the canvas. */
  dive: string[];
  /** Viewing a chip's interior (read-only live instance). */
  diving: boolean;
  /** An edit was attempted inside the live instance — show the refusal hint. */
  diveRefusal: boolean;
  /** Editing a chip's blueprint (P7), with the affected placed-instance count. */
  editing: { name: string; instances: number } | null;
  /** Pending numeric width prefix for the next io stamp. */
  pendingWidth: number | null;
  /** Inline chip-rename field (screen coords over the canvas). */
  rename: { componentId: number; partId: string; name: string; sx: number; sy: number } | null;
}

/** Framework-free application controller; App.svelte is a thin shell. */
export class AppController {
  /** Interaction-prototype harness (design doc 4), gated by ?proto=1. */
  readonly proto = typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("proto") === "1";
  readonly logger = new ProtoLogger();
  /** Hot-tunable discriminator config (window.__logicsim.protoConfig). */
  readonly protoConfig = { spaceTapMs: 180 };

  readonly doc = new CircuitDocument();
  // Not readonly: Edit Definition swaps in a fresh history for the blueprint
  // session and restores the project history on exit (ctx.history follows).
  history = new History();
  readonly lib = new PartLibrary();
  /** Standard component library (P11) — a fixed catalog shown in the palette. */
  readonly libraryParts: LibraryPart[] = registerStandardLibrary(this.lib);
  readonly selection = new Selection(this.doc);
  readonly viewport = new Viewport();
  readonly grid = new SpatialGrid(200);
  readonly overlay: OverlayState = {};
  readonly bridge = new SimBridge();

  onUi?: (ui: UiState) => void;
  /** Default-editor Ctrl+G: the shell handles naming (prompt) then calls
   *  createChip. Proto mode uses createChipProto (inline rename) instead. */
  onRequestCreateChip?: () => void;

  private stack: CanvasStack | null = null;
  private container: HTMLElement | null = null;
  /** Tear down the previous attach (listeners, observer, rAF) before re-attaching. */
  private teardown: (() => void) | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private dirtyStatic = true;
  private dirtySignals = true;
  private status = "place parts to begin";
  private statusOk = false;
  private placePart: string | null = null;
  private userParts: Array<{ id: string; name: string }> = [];
  private storage: StorageProvider | null = null;

  private readonly contract = new ContractTool(this.logger);
  // The default editor rests in one modeless tool ("the target decides") — no
  // Select/Wire/Poke switching. The ?proto=1 harness keeps the richer
  // ContractTool (click-click wiring, dive, stamp hotkeys).
  private readonly tools: Record<string, Tool> = {
    modeless: new ModelessTool(),
    contract: this.contract,
  };
  private active: Tool = this.proto ? this.contract : this.tools.modeless;
  private place = new PlaceTool("builtin:and");

  // ---- prototype harness state (all inert unless this.proto)
  private spaceHeld = false;
  private spaceDownT = 0;
  private spacePanned = false;
  private spaceLast: { sx: number; sy: number } | null = null;
  private swallowedPointers = new Set<number>();
  private pendingWidth: number | null = null;
  private lastTap: { id: number; t: number } | null = null;
  private diveLevels: DiveLevel[] = [];
  /** An edit was attempted inside a read-only live instance (shows refusal). */
  private diveEditRefused = false;
  // ---- Edit Definition (P7): editing a chip's blueprint in place. While
  // active, this.doc holds the editable interior; the project is snapshotted.
  private editPartId: string | null = null;
  private editName = "";
  private editInstanceCount = 0;
  private savedMain: { components: Component[]; wires: Wire[]; nextId: number; selection: number[]; view: { x: number; y: number; zoom: number } } | null = null;
  private savedHistory: History | null = null;
  private renameState: { componentId: number; partId: string; name: string } | null = null;
  private chipCounter = 0;
  private lastMutationAt = 0;
  private viewAnim: number | null = null;

  private readonly ctx: ToolContext = {
    doc: this.doc,
    lib: this.lib,
    history: this.history,
    selection: this.selection,
    viewport: this.viewport,
    overlay: this.overlay,
    hitTest: (wx, wy) => hitTest(this.doc, this.lib, this.grid, wx, wy),
    queryRect: (x0, y0, x1, y1) =>
      this.grid.query(x0, y0, x1, y1).filter((id) => {
        const c = this.doc.components.get(id);
        return c !== undefined &&
          c.x >= x0 - 60 && c.x <= x1 && c.y >= y0 - 60 && c.y <= y1;
      }),
    simTick: () => this.bridge.simTime,
    poke: (componentId, value) => this.bridge.poke(componentId, value),
    structureChanged: () => this.recompile(),
    requestRender: () => { this.dirtyStatic = true; },
  };

  attach(container: HTMLElement): void {
    // The canvas remounts whenever the editor is re-entered (e.g. switching
    // projects from Home), so drop the previous attach's listeners/loop first.
    this.teardown?.();
    if (import.meta.env?.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__logicsim = this;
      // Dev-only geometry helpers (routing/junction debugging).
      w.__geom = {
        segments: (wireId: number) => wireSegments(this.doc, this.lib, wireId),
        junctions: () => wireJunctions(this.doc, this.lib),
        portPos: (componentId: number, pin: string) => portPosition(this.doc, this.lib, componentId, pin),
      };
    }
    this.container = container;
    this.stack = new CanvasStack(container);
    container.style.touchAction = "none";

    const ac = new AbortController();
    const signal = ac.signal;

    const toPointer = (e: PointerEvent, phase: "down" | "move" | "up" | "cancel") => {
      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return {
        id: e.pointerId,
        kind: (e.pointerType === "pen" ? "pen" : e.pointerType === "touch" ? "touch" : "mouse") as PointerKind,
        phase,
        sx, sy,
        wx: this.viewport.worldX(sx),
        wy: this.viewport.worldY(sy),
        pressure: e.pressure,
        button: phase === "down" ? e.button : 0,
        shift: e.shiftKey,
      };
    };

    const recognizer = new GestureRecognizer({
      hitTest: (wx, wy) => this.activeHitTest(wx, wy),
      emit: (intent) => this.dispatch(intent),
    });

    container.addEventListener("pointerdown", (e) => {
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events and post-cancel pointers have no capturable id.
      }
      // Space-hold grip: the pointer belongs to panning, not the tools.
      // Grabbing the canvas counts as pan intent even before any movement
      // (otherwise a zero-move space-click would read as a transport tap).
      if (this.proto && this.spaceHeld && e.button === 0) {
        const rect = container.getBoundingClientRect();
        this.spaceLast = { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
        this.spacePanned = true;
        this.swallowedPointers.add(e.pointerId);
        e.preventDefault();
        return;
      }
      recognizer.pointer(toPointer(e, "down"));
      e.preventDefault();
    }, { signal });
    container.addEventListener("pointermove", (e) => {
      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // Space-hold + drag = pan, even mid-gesture (the recognizer's drag
      // freezes while moves are intercepted and resumes on release).
      if (this.proto && this.spaceHeld && e.buttons > 0) {
        if (this.spaceLast) {
          this.viewport.panByScreen(-(sx - this.spaceLast.sx), -(sy - this.spaceLast.sy));
          this.dirtyStatic = true;
          this.dirtySignals = true;
        }
        this.spaceLast = { sx, sy };
        this.spacePanned = true;
        return;
      }
      this.spaceLast = null;
      if (this.proto && !this.diving) {
        const wx = this.viewport.worldX(sx);
        const wy = this.viewport.worldY(sy);
        if (this.placePart) {
          this.overlay.stampGhost = {
            part: this.placePart,
            ...stampOrigin(this.placePart, this.lib, wx, wy),
          };
          this.dirtyStatic = true;
        }
        if (this.active === this.contract) this.contract.hover(wx, wy, this.ctx);
      }
      // Coalesced samples keep 240 Hz pen input smooth for ink. Note:
      // synthetic events (and some browsers) return an EMPTY list, not
      // undefined — fall back to the event itself in both cases.
      const coalesced = e.getCoalescedEvents?.();
      const events = coalesced && coalesced.length > 0 ? coalesced : [e];
      for (const ce of events) recognizer.pointer(toPointer(ce as PointerEvent, "move"));
    }, { signal });
    container.addEventListener("pointerup", (e) => {
      if (this.swallowedPointers.delete(e.pointerId)) return;
      recognizer.pointer(toPointer(e, "up"));
    }, { signal });
    container.addEventListener("pointercancel", (e) => {
      if (this.swallowedPointers.delete(e.pointerId)) return;
      recognizer.pointer(toPointer(e, "cancel"));
    }, { signal });
    container.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      recognizer.wheel({ sx: e.clientX - rect.left, sy: e.clientY - rect.top, deltaY: e.deltaY });
    }, { passive: false, signal });

    window.addEventListener("keydown", (e) => this.key(e), { signal });
    window.addEventListener("keyup", (e) => this.keyUp(e), { signal });
    window.addEventListener("beforeunload", () => this.flushDraft(), { signal });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = window.devicePixelRatio || 1;
      this.stack?.resize(this.width, this.height, this.dpr);
      this.dirtyStatic = true;
      this.dirtySignals = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    this.bridge.onSnapshot = () => {
      this.dirtySignals = true;
      this.pushUi();
    };

    let raf = 0;
    const frame = () => {
      this.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    this.teardown = () => {
      ac.abort();
      ro.disconnect();
      cancelAnimationFrame(raf);
      this.teardown = null;
    };
    this.pushUi();
  }

  private dispatch(intent: Intent): void {
    if (intent.type === "pan") {
      this.viewport.panByScreen(-intent.dsx, -intent.dsy);
      this.dirtyStatic = true;
      this.dirtySignals = true;
      return;
    }
    if (intent.type === "zoom") {
      this.viewport.zoomAt(intent.sx, intent.sy, intent.factor);
      this.dirtyStatic = true;
      this.dirtySignals = true;
      return;
    }
    if (this.diving) {
      // Live-instance interior is READ-ONLY: only double-tap (dive deeper)
      // navigates. A drag on a part/port is an edit attempt -> neutral refusal.
      if (intent.type === "tap" && intent.target?.type === "component") {
        this.maybeDoubleTap(intent.target.id);
      } else if (intent.type === "tap") {
        this.lastTap = null;
      } else if (intent.type === "dragStart" &&
        (intent.target?.type === "component" || intent.target?.type === "port")) {
        this.refuseDiveEdit();
      }
      return;
    }
    if (!this.editing && intent.type === "tap" && intent.target?.type === "component") {
      // Double-click a composite chip to view its interior (Card F).
      // Suppressed while editing a blueprint (nested dive is out of scope).
      if (this.maybeDoubleTap(intent.target.id)) return;
    }
    this.active.intent(intent, this.ctx);
    this.pushUi();
  }

  /** Double-tap on a composite component dives into it (Card F). */
  private maybeDoubleTap(id: number): boolean {
    const now = performance.now();
    const isSecond = this.lastTap !== null && this.lastTap.id === id && now - this.lastTap.t < 350;
    this.lastTap = isSecond ? null : { id, t: now };
    if (isSecond && this.tryDive(id)) return true;
    return false;
  }

  private key(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement ||
      (t !== null && t.isContentEditable)) return;
    if (this.proto && this.protoKey(e)) return;
    if (this.diving) {
      // Read-only live instance: Esc surfaces, edits are refused, the global
      // edit shortcuts are unavailable (matching the disabled toolbar).
      if (e.key === "Escape") {
        this.surfaceOne();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        this.refuseDiveEdit();
      } else if ((e.ctrlKey || e.metaKey) && ["z", "y", "g"].includes(e.key.toLowerCase())) {
        // swallowed — not available while viewing a live instance
      }
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      this.undo();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" ||
      (e.key.toLowerCase() === "z" && e.shiftKey))) {
      this.redo();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      // Create chip from the selection (matches the toolbar button). The
      // shell owns naming; we only fire when the selection is chippable.
      e.preventDefault();
      if (this.canChipSelection) this.onRequestCreateChip?.();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      this.deleteSelection();
      e.preventDefault();
    } else if (e.key === "Escape") {
      // Modeless exit: drop an armed stamp, else clear the selection.
      if (this.placePart) {
        this.disarmStamp();
        this.pushUi();
      } else if (this.selection.size > 0) {
        this.selection.clear();
        this.dirtyStatic = true;
        this.pushUi();
      }
      e.preventDefault();
    }
  }

  /** Stamp hotkeys (interaction model §5.1): bare letters, no modifiers. */
  private static readonly STAMP_KEYS: Record<string, string> = {
    a: "builtin:and", o: "builtin:or", n: "builtin:not", x: "builtin:xor",
    i: "io:in", u: "io:out", d: "builtin:dff",
  };

  /** Prototype keymap. Returns true when the key was handled. */
  private protoKey(e: KeyboardEvent): boolean {
    if (e.key === " ") {
      e.preventDefault();
      if (!e.repeat && !this.spaceHeld) {
        this.spaceHeld = true;
        this.spaceDownT = performance.now();
        this.spacePanned = false;
        this.spaceLast = null;
      }
      return true;
    }
    if (e.key === "Escape") {
      this.escapeLadder();
      return true;
    }
    if (e.key === "Home") {
      this.surfaceTo(0);
      return true;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      this.createChipProto();
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key.toLowerCase() === "s") {
      this.stepCycle();
      return true;
    }
    if (/^[0-9]$/.test(e.key)) {
      const next = (this.pendingWidth ?? 0) * 10 + Number(e.key);
      this.pendingWidth = Math.max(1, Math.min(64, next));
      this.pushUi();
      return true;
    }
    const part = AppController.STAMP_KEYS[e.key.toLowerCase()];
    if (part && !this.diving) {
      this.armStamp(part, "keyboard");
      return true;
    }
    return false;
  }

  private keyUp(e: KeyboardEvent): void {
    if (!this.proto || e.key !== " " || !this.spaceHeld) return;
    this.spaceHeld = false;
    this.spaceLast = null;
    const durationMs = Math.round(performance.now() - this.spaceDownT);
    let toggled = false;
    if (!this.spacePanned && durationMs < this.protoConfig.spaceTapMs) {
      this.toggleRunning();
      toggled = true;
    }
    this.logger.space({ t: Math.round(performance.now()), durationMs, panned: this.spacePanned, toggled });
  }

  /**
   * The Escape ladder (interaction model §1.3): cancel in-flight gesture →
   * exit active mode → clear selection → surface one hierarchy level.
   * First rung that does something wins.
   */
  private escapeLadder(): void {
    let rung: number;
    if (this.active === this.contract && this.contract.cancelPending(this.ctx)) {
      rung = 1;
    } else if (this.placePart) {
      this.disarmStamp();
      rung = 2;
    } else if (this.selection.size > 0) {
      this.selection.clear();
      delete this.overlay.netGhost;
      this.dirtyStatic = true;
      rung = 3;
    } else if (this.diveLevels.length > 0) {
      this.surfaceOne();
      rung = 4;
    } else {
      rung = 0;
    }
    this.logger.log("escape", { rung });
    this.pushUi();
  }

  setPlacePart(part: string): void {
    if (this.proto) {
      this.armStamp(part, "palette");
      return;
    }
    this.active.deactivate?.(this.ctx);
    this.place = new PlaceTool(part);
    this.placePart = part;
    this.active = this.place;
    this.pushUi();
  }

  // ------------------------------------------------- prototype: stamp mode

  /**
   * Palette drag (interaction model §5.1 PRIMARY route): drag a part from
   * the palette onto the canvas to place ONE instance where dropped. A
   * plain click (no drag past slop) falls through to stamp-arming, so the
   * two routes coexist: drag = place once, click = arm the repeat stamp.
   * Active in the default editor and the ?proto=1 harness alike.
   */
  beginPaletteDrag(part: string, e: PointerEvent): void {
    (e.currentTarget as HTMLElement | null)?.blur();
    if (this.diving) { this.refuseDiveEdit(); return; } // read-only live instance
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    const overCanvas = (ev: PointerEvent) => {
      const r = this.container?.getBoundingClientRect();
      if (!r) return null;
      if (ev.clientX < r.left || ev.clientX > r.right ||
        ev.clientY < r.top || ev.clientY > r.bottom) return null;
      return {
        wx: this.viewport.worldX(ev.clientX - r.left),
        wy: this.viewport.worldY(ev.clientY - r.top),
      };
    };
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      if (!dragging) {
        dragging = true;
        this.logger.log("paletteDragStart", { part });
      }
      const w = overCanvas(ev);
      if (w) {
        this.overlay.stampGhost = { part, ...stampOrigin(part, this.lib, w.wx, w.wy) };
      } else {
        delete this.overlay.stampGhost;
      }
      this.dirtyStatic = true;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      delete this.overlay.stampGhost;
      this.dirtyStatic = true;
      if (!dragging) {
        this.setPlacePart(part); // plain click: arm stamp mode (proto or default)
        return;
      }
      const w = overCanvas(ev);
      if (w) {
        // One-shot placement via the place tool's tap path (io naming etc.).
        new PlaceTool(part).intent(
          { type: "tap", wx: w.wx, wy: w.wy, target: null, shift: false }, this.ctx);
        this.logger.log("paletteDrop", { part });
      } else {
        this.logger.log("paletteDragCancel", { part });
      }
      this.pushUi();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Arm a stamp: ghost on cursor, each click places one, Esc puts it down. */
  armStamp(part: string, via: "keyboard" | "palette"): void {
    this.active.deactivate?.(this.ctx);
    const extra: Record<string, number | string> = {};
    if (isIo(part) && this.pendingWidth !== null && this.pendingWidth > 1) {
      extra.width = this.pendingWidth;
    }
    this.pendingWidth = null;
    this.place = new PlaceTool(part, extra);
    this.placePart = part;
    this.active = this.place;
    this.logger.log("stampArm", { part, via, ...extra });
    this.pushUi();
  }

  /** Esc rung 2: put the stamp down, back to the modeless contract tool. */
  private disarmStamp(): void {
    this.active.deactivate?.(this.ctx);
    this.placePart = null;
    this.pendingWidth = null;
    delete this.overlay.stampGhost;
    this.active = this.proto ? this.contract : this.tools.modeless;
    this.dirtyStatic = true;
    this.logger.log("stampDisarm", {});
  }

  // -------------------------------------------------- prototype: transport

  /** Step a paused sim by one clock cycle (S key / transport button). */
  stepCycle(): void {
    if (this.bridge.running) {
      this.logger.log("stepIgnored", { reason: "running" });
      return;
    }
    const ticks = this.cycleTicks();
    this.bridge.step(ticks);
    this.logger.pauseUsed();
    this.logger.log("step", { ticks });
    this.pushUi();
  }

  /** One clock cycle = 2x the first clock's half period; 100 ticks bare. */
  private cycleTicks(): number {
    for (const c of this.doc.components.values()) {
      if (c.part === "builtin:clock") {
        const hp = typeof c.props.halfPeriod === "number" ? c.props.halfPeriod : 50;
        return hp * 2;
      }
    }
    return 100;
  }

  // ------------------------------------------- prototype: create chip (⌘G)

  /** ⌘G: collapse the selection into a chip and open the inline rename. */
  createChipProto(): void {
    const name = `Chip${++this.chipCounter}`;
    const err = this.createChip(name);
    if (err !== null) {
      this.logger.log("createChipRefused", { reason: err });
      return;
    }
    const componentId = this.selection.ids()[0];
    const comp = this.doc.components.get(componentId);
    if (!comp) return;
    const def = this.lib.get(comp.part);
    this.renameState = { componentId, partId: comp.part, name };
    this.logger.log("createChip", { pins: def?.interface.pins.length ?? 0 });
    this.pushUi();
  }

  /** Commit the inline rename (display name is metadata outside the hash). */
  commitRename(newName: string): void {
    const state = this.renameState;
    this.renameState = null;
    const name = newName.trim();
    if (state && name.length > 0) {
      const entry = this.userParts.find((p) => p.id === state.partId);
      if (entry) entry.name = name;
      const def = this.lib.get(state.partId);
      if (def) (def as { name: string }).name = name;
      this.dirtyStatic = true;
      this.logger.log("chipRenamed", {});
    }
    this.pushUi();
  }

  cancelRename(): void {
    this.renameState = null;
    this.pushUi();
  }

  // ------------------------------------------------- prototype: hierarchy

  get diving(): boolean {
    return this.diveLevels.length > 0;
  }

  private get topDive(): DiveLevel | null {
    return this.diveLevels[this.diveLevels.length - 1] ?? null;
  }

  /** Hit-testing routes to the dive interior while below the surface. */
  private activeHitTest(wx: number, wy: number): HitResult {
    const lvl = this.topDive;
    if (lvl) return hitTest(lvl.doc, this.lib, lvl.grid, wx, wy);
    return this.ctx.hitTest(wx, wy);
  }

  /** Dive into a composite component's live interior (double-click). */
  tryDive(componentId: number): boolean {
    this.diveEditRefused = false;
    let partId: string;
    let path: string;
    let name: string;
    const lvl = this.topDive;
    if (lvl === null) {
      const comp = this.doc.components.get(componentId);
      if (!comp) return false;
      partId = comp.part;
      path = `c${componentId}/`;
      name = this.userParts.find((p) => p.id === partId)?.name
        ?? this.lib.get(partId)?.name ?? partId;
    } else {
      const inst = lvl.instOf.get(componentId);
      if (!inst) return false;
      partId = inst.part;
      path = lvl.path + inst.instId + "/";
      name = this.lib.get(partId)?.name ?? partId;
    }
    const level = buildInterior(this.lib, partId, path, name, this.bridge.elab, {
      x: this.viewport.x, y: this.viewport.y, zoom: this.viewport.zoom,
    });
    if (level === null) return false; // builtins have no interior
    // Diving is a navigation act: the tap pair that triggered it should not
    // leave a stranded main-canvas selection for Esc rung 3 to eat.
    this.selection.clear();
    delete this.overlay.netGhost;
    this.diveLevels.push(level);
    const b = interiorBounds(level, this.lib);
    this.animateToFit(b);
    this.logger.log("dive", { depth: this.diveLevels.length, part: name });
    this.pushUi();
    return true;
  }

  /** Esc / breadcrumb: surface one level. */
  surfaceOne(): void {
    const lvl = this.diveLevels.pop();
    if (!lvl) return;
    this.diveEditRefused = false;
    this.animateViewport(lvl.returnView);
    this.logger.log("surface", { depth: this.diveLevels.length });
    this.pushUi();
  }

  /** Home / breadcrumb jump: surface to the given depth (0 = top canvas). */
  surfaceTo(depth: number): void {
    if (depth >= this.diveLevels.length) return;
    const target = this.diveLevels[depth].returnView;
    this.diveLevels.length = depth;
    this.diveEditRefused = false;
    this.animateViewport(target);
    this.logger.log("surface", { depth, jump: true });
    this.pushUi();
  }

  /** Drop any open dive without animating — used when the canvas content is
   *  about to be replaced (new/opened/template project), so a stale chip
   *  interior can't leak over the freshly loaded document. */
  private resetDive(): void {
    this.diveLevels.length = 0;
    this.diveEditRefused = false;
  }

  /** An edit was attempted inside a live instance — surface the neutral hint. */
  private refuseDiveEdit(): void {
    if (!this.diving) return;
    this.diveEditRefused = true;
    this.logger.log("diveEditRefused", {});
    this.pushUi();
  }

  /** Dismiss the live-instance refusal hint (× / acted on it). */
  dismissDiveRefusal(): void {
    this.diveEditRefused = false;
    this.pushUi();
  }

  /**
   * "Edit definition" affordance on the refusal hint. The full edit-definition
   * system is deferred (P7); for now this acknowledges neutrally so the path
   * is discoverable without pretending to work.
   */
  /** "Edit definition" from the read-only live instance: leave the dive and
   *  open the chip's blueprint for editing. */
  requestEditDefinition(): void {
    const lvl = this.topDive;
    this.diveEditRefused = false;
    if (lvl) this.editDefinition(lvl.partId, lvl.name);
    else this.pushUi();
  }

  // ------------------------------------------------- P7: edit definition

  get editing(): boolean {
    return this.editPartId !== null;
  }

  /**
   * Open a chip's blueprint for editing. The project is snapshotted and
   * this.doc is replaced by the editable interior; Save folds the edits back
   * into the definition and repoints placed instances.
   */
  editDefinition(partId: string, name?: string): void {
    if (this.editing) return;
    const label = name
      ?? this.userParts.find((p) => p.id === partId)?.name
      ?? this.lib.get(partId)?.name ?? partId;
    const lvl = buildInterior(this.lib, partId, "", label, null,
      { x: this.viewport.x, y: this.viewport.y, zoom: this.viewport.zoom });
    if (lvl === null) { // builtins / non-structural have no blueprint
      this.status = "this part has no editable blueprint";
      this.statusOk = false;
      this.pushUi();
      return;
    }
    // Persist the live project to its slot BEFORE entering edit mode. While
    // editing, autosave and beforeunload-flush are both suppressed (the doc
    // holds the blueprint, not the project), so without this a reload mid-edit
    // would resume to a stale draft and lose just-made changes (e.g. the chip
    // that was created right before diving in to edit it).
    this.flushDraft();
    // Leaving any read-only dive; snapshot the live project before we replace it.
    this.diveLevels.length = 0;
    this.diveEditRefused = false;
    this.savedMain = {
      components: [...this.doc.components.values()].map((c) => structuredClone(c)),
      wires: [...this.doc.wires.values()].map((w) => structuredClone(w)),
      nextId: this.doc.nextId,
      selection: this.selection.ids(),
      view: { x: this.viewport.x, y: this.viewport.y, zoom: this.viewport.zoom },
    };
    this.savedHistory = this.history;
    this.editInstanceCount = this.savedMain.components.filter((c) => c.part === partId).length;

    // Replace the document with the editable interior (fresh ids).
    this.clearDoc();
    const idMap = new Map<number, number>();
    for (const c of lvl.doc.components.values()) {
      const nid = this.doc.mintId();
      idMap.set(c.id, nid);
      this.doc.components.set(nid, { ...c, id: nid, props: { ...c.props } });
    }
    for (const w of lvl.doc.wires.values()) {
      const nid = this.doc.mintId();
      this.doc.wires.set(nid, {
        id: nid,
        ports: w.ports.map((p) => ({ component: idMap.get(p.component)!, pin: p.pin })),
      });
    }

    this.history = new History();
    this.ctx.history = this.history;
    this.editPartId = partId;
    this.editName = label;
    this.selection.clear();
    this.recompile();
    this.animateToFit(interiorBounds(lvl, this.lib));
    this.logger.log("editDefinition", { part: label, instances: this.editInstanceCount });
    this.pushUi();
  }

  /** Save & exit: fold the edited blueprint back into the definition and
   *  repoint every placed instance to the updated part. */
  saveDefinition(): void {
    if (!this.editing) return;
    const oldPartId = this.editPartId!;
    let newPartId: string;
    try {
      const def = definitionFromInterior(this.doc, this.lib, this.editName, "1.0.0");
      newPartId = this.lib.add(def);
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
      this.pushUi();
      return; // stay in edit mode so the user can fix it
    }
    this.exitToMain();
    if (newPartId !== oldPartId) {
      for (const comp of this.doc.components.values()) {
        if (comp.part === oldPartId) comp.part = newPartId;
      }
      const entry = this.userParts.find((p) => p.id === oldPartId);
      if (entry) entry.id = newPartId;
    }
    this.recompile();
    this.status = `saved "${this.editNameAtExit}"`;
    this.statusOk = true;
    this.pushUi();
  }

  /** Discard blueprint edits and return to the project unchanged. */
  cancelEditDefinition(): void {
    if (!this.editing) return;
    this.exitToMain();
    this.recompile();
    this.status = "edits discarded";
    this.statusOk = false;
    this.pushUi();
  }

  private editNameAtExit = "";

  /** Restore the snapshotted project document, history, selection, view. */
  private exitToMain(): void {
    const snap = this.savedMain!;
    this.editNameAtExit = this.editName;
    this.clearDoc();
    for (const c of snap.components) this.doc.components.set(c.id, c);
    for (const w of snap.wires) this.doc.wires.set(w.id, w);
    this.doc.nextId = snap.nextId;
    this.doc.revision++;
    this.history = this.savedHistory!;
    this.ctx.history = this.history;
    this.viewport.x = snap.view.x;
    this.viewport.y = snap.view.y;
    this.viewport.zoom = snap.view.zoom;
    this.editPartId = null;
    this.editName = "";
    this.editInstanceCount = 0;
    this.savedMain = null;
    this.savedHistory = null;
    this.selection.setTo(snap.selection);
  }

  private clearDoc(): void {
    this.doc.components.clear();
    this.doc.wires.clear();
    this.doc.strokes.clear();
    this.doc.groups.clear();
  }

  /** Zoom-through transition: short ease-out lerp of the viewport. */
  private animateViewport(target: { x: number; y: number; zoom: number }): void {
    if (this.viewAnim !== null) cancelAnimationFrame(this.viewAnim);
    const from = { x: this.viewport.x, y: this.viewport.y, zoom: this.viewport.zoom };
    const t0 = performance.now();
    const DUR = 220;
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / DUR);
      const k = 1 - Math.pow(1 - t, 3);
      this.viewport.x = from.x + (target.x - from.x) * k;
      this.viewport.y = from.y + (target.y - from.y) * k;
      this.viewport.zoom = from.zoom + (target.zoom - from.zoom) * k;
      this.dirtyStatic = true;
      this.dirtySignals = true;
      this.viewAnim = t < 1 ? requestAnimationFrame(tick) : null;
    };
    tick();
    // rAF can be throttled to zero in background windows; never leave the
    // viewport stranded mid-transition.
    setTimeout(() => {
      if (this.viewAnim !== null) {
        cancelAnimationFrame(this.viewAnim);
        this.viewAnim = null;
        this.viewport.x = target.x;
        this.viewport.y = target.y;
        this.viewport.zoom = target.zoom;
        this.dirtyStatic = true;
        this.dirtySignals = true;
      }
    }, DUR + 100);
  }

  private animateToFit(b: { x0: number; y0: number; x1: number; y1: number }): void {
    const margin = 80;
    const w = b.x1 - b.x0 + margin;
    const h = b.y1 - b.y0 + margin;
    const zoom = Math.min(8, Math.max(0.1, Math.min(this.width / w, this.height / h)));
    this.animateViewport({
      x: b.x0 - (this.width / zoom - (b.x1 - b.x0)) / 2,
      y: b.y0 - (this.height / zoom - (b.y1 - b.y0)) / 2,
      zoom,
    });
  }

  undo(): void {
    if (!this.history.canUndo) return;
    // Misfire heuristic (doc 4 §2.1): an undo right after an action is a
    // probable "the system did something other than intent" signal.
    if (this.proto && this.lastMutationAt > 0 &&
      performance.now() - this.lastMutationAt < 2000) {
      this.logger.misfire("undoSoonAfterAction", {
        sinceMs: Math.round(performance.now() - this.lastMutationAt),
      });
    }
    this.history.undo(this.doc, this.selection);
    this.recompile();
  }

  redo(): void {
    if (!this.history.canRedo) return;
    this.history.redo(this.doc, this.selection);
    this.recompile();
  }

  deleteSelection(): void {
    if (this.selection.size === 0) return;
    this.history.execute(this.doc, removeEntities(this.selection.ids()), this.selection);
    this.selection.prune();
    this.recompile();
  }

  /** Bus-cap matching the engine schema (MAX_BUS_WIDTH). */
  static readonly MAX_WIDTH = 64;

  /** Set the editable numeric prop of a selected part: io bus width, or a
   *  constant's value. One undoable command, then recompile. */
  setPartConfig(id: number, type: "io" | "const", value: number): void {
    const comp = this.doc.components.get(id);
    if (!comp) return;
    if (type === "io") {
      const w = Math.max(1, Math.min(AppController.MAX_WIDTH, Math.round(value) || 1));
      this.history.execute(this.doc, setProp(id, "width", w), this.selection);
    } else {
      const v = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(value) || 0));
      this.history.execute(this.doc, setProp(id, "value", v), this.selection);
    }
    this.recompile();
  }

  /** The selected single part's editable numeric prop, if any. */
  private partConfig(): UiState["partConfig"] {
    if (this.selection.size !== 1) return null;
    const id = this.selection.ids()[0];
    const comp = this.doc.components.get(id);
    if (!comp) return null;
    if (comp.part === "io:in" || comp.part === "io:out") {
      return { id, type: "io", value: Number(comp.props.width ?? 1), label: "Bus width", max: AppController.MAX_WIDTH };
    }
    if (comp.part === "builtin:const") {
      return { id, type: "const", value: Number(comp.props.value ?? 0), label: "Value", max: Number.MAX_SAFE_INTEGER };
    }
    return null;
  }

  /** Selection holds at least one non-IO component (eligible for Create Chip). */
  get canChipSelection(): boolean {
    return [...this.selection.ofType("component")].some((id) => {
      const part = this.doc.components.get(id)?.part;
      return part !== undefined && part !== "io:in" && part !== "io:out";
    });
  }

  /**
   * Create a chip from the current selection, replace the selection with
   * one instance, and add the part to the palette. Returns an error
   * message, or null on success.
   */
  createChip(name: string): string | null {
    try {
      const { command, partId, componentId } = createChipFromSelection(
        this.doc, this.lib, this.selection.ids(), { name, version: "1.0.0" });
      this.history.execute(this.doc, command, this.selection);
      this.selection.setTo([componentId]);
      if (!this.userParts.some((p) => p.id === partId)) {
        this.userParts.push({ id: partId, name });
      }
      this.recompile();
      return null;
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
      this.pushUi();
      return this.status;
    }
  }

  /** Live value of a hierarchical net path (inspector probing). */
  probe(path: string): number | null {
    return this.bridge.probe(path);
  }

  // ------------------------------------------------------------ P1/P11a: projects
  projectName = "Untitled circuit";
  /** Which local project slot autosave writes to (one per recent). */
  private projectId = "";
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debounced autosave of the working project to its slot. */
  private autosaveDraft(): void {
    if (this.editing || !this.projectId) return; // blueprint / no active project
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.flushDraft(), 400);
  }

  /** Persist the current project immediately (before switching / on unload). */
  flushDraft(): void {
    if (this.editing || !this.projectId) return;
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = null; }
    try { saveProjectDraft(this.projectId, this.projectName, this.serializeProject()); } catch { /* ignore */ }
  }

  /** Clear the in-memory document to a blank project (no slot change). */
  newProject(name = "Untitled circuit"): void {
    this.projectName = name;
    this.resetDive();
    this.history.clear();
    for (const w of [...this.doc.wires.values()]) this.doc.wires.delete(w.id);
    for (const comp of [...this.doc.components.values()]) this.doc.components.delete(comp.id);
    this.userParts = [];
    this.watches = [];
    this.whyWireId = null;
    this.selection.clear();
    this.recompile();
  }

  /** New blank project in its OWN slot (older projects are kept). */
  startNewProject(): void {
    this.flushDraft();
    this.projectId = newProjectId();
    this.newProject("Untitled circuit");
    this.flushDraft(); // register in recents right away
  }

  /** Open an existing recent project by id. Returns true on success. */
  openProjectDraft(id: string): boolean {
    this.flushDraft();
    const d = loadProjectDraft(id);
    if (!d) return false;
    this.projectId = id;
    this.projectName = d.name;
    this.watches = [];
    this.whyWireId = null;
    return this.loadProjectString(d.json) === null;
  }

  // ----------------------------------------------------------- P2: watches
  private watches: number[] = [];

  /** Add the selected wire(s) to the watch list. */
  addWatchSelected(): void {
    for (const id of this.selection.ids()) {
      if (this.doc.wires.has(id) && !this.watches.includes(id)) this.watches.push(id);
    }
    this.pushUi();
  }

  removeWatch(id: number): void {
    this.watches = this.watches.filter((w) => w !== id);
    this.pushUi();
  }

  private watchLabel(id: number): string {
    const w = this.doc.wires.get(id);
    if (w) {
      for (const p of w.ports) {
        const c = this.doc.components.get(p.component);
        if (c && (c.part === "io:in" || c.part === "io:out") && typeof c.props.name === "string") {
          return c.props.name;
        }
      }
    }
    return `net ${id}`;
  }

  private watchRows(): UiState["watches"] {
    return this.watches
      .filter((id) => this.doc.wires.has(id))
      .map((id) => {
        const bus = this.bridge.wireBus.get(id);
        const vals = bus && this.bridge.netValues
          ? bus.map((n) => this.bridge.netValues![n])
          : null;
        if (!vals || vals.length === 0) {
          return { id, label: this.watchLabel(id), value: null, width: 1, hex: null, bin: null };
        }
        const width = vals.length;
        const value = width === 1 ? vals[0] : aggregateBus(vals);
        return {
          id, label: this.watchLabel(id), value, width,
          hex: width > 1 ? busHex(vals) : null,
          bin: width > 1 ? busBin(vals) : null,
        };
      });
  }

  // -------------------------------------------------------------- P3: why?
  private whyWireId: number | null = null;

  /** Explain the selected single wire (if it's X or Z). */
  explainSelected(): void {
    if (this.selection.size === 1) {
      const id = this.selection.ids()[0];
      if (this.doc.wires.has(id)) this.whyWireId = id;
    }
    this.pushUi();
  }

  clearWhy(): void {
    this.whyWireId = null;
    this.pushUi();
  }

  /** Selected single wire's X/Z state for the Why? button, else null. */
  private selectedWhyState(): "X" | "Z" | null {
    if (this.selection.size !== 1) return null;
    const id = this.selection.ids()[0];
    if (!this.doc.wires.has(id)) return null;
    const v = this.wireValue(id);
    return v === 2 ? "X" : v === 3 ? "Z" : null;
  }

  /** Live state (0/1/X/Z code) of a wire's net, or null. */
  private wireValue(wireId: number): number | null {
    const net = this.bridge.wireNets.get(wireId);
    return net !== undefined && this.bridge.netValues ? this.bridge.netValues[net] : null;
  }

  private isDriverPort(p: { component: number; pin: string }): boolean {
    const comp = this.doc.components.get(p.component);
    if (!comp) return false;
    if (comp.part === "io:in") return true;
    if (comp.part === "io:out") return false;
    return this.lib.resolveInterface(comp.part)?.pins.find((pin) => pin.name === p.pin)?.dir === "out";
  }

  private portLabel(p: { component: number; pin: string }): string {
    const comp = this.doc.components.get(p.component);
    if (!comp) return "?";
    if (comp.part === "io:in" || comp.part === "io:out") {
      return typeof comp.props.name === "string" ? comp.props.name : comp.part;
    }
    const short = comp.part.startsWith("builtin:")
      ? comp.part.slice(8).toUpperCase()
      : this.lib.get(comp.part)?.name ?? comp.part;
    return `${short}.${p.pin}`;
  }

  /** Current-state provenance for an X/Z wire (no history, no hierarchy). */
  private computeWhy(wireId: number): UiState["why"] {
    if (!this.doc.wires.has(wireId)) return null;
    const v = this.wireValue(wireId);
    if (v !== 2 && v !== 3) return null; // only X / Z

    const { groups } = computeNetGroups(this.doc);
    const group = groups.find((g) => g.some((w) => w.id === wireId));
    const ports = group ? groupPorts(group) : (this.doc.wires.get(wireId)?.ports ?? []);
    const drivers = ports.filter((p) => this.isDriverPort(p));
    const driverLabels = drivers.map((p) => this.portLabel(p));

    if (v === 3) {
      return drivers.length === 0
        ? { state: "Z", title: "Disconnected", message: "Nothing is driving this wire right now.", drivers: [] }
        : { state: "Z", title: "No active driver", message: "Every driver on this net is high-impedance (Z) right now.", drivers: driverLabels };
    }
    if (drivers.length >= 2) {
      return { state: "X", title: "Conflicting drivers", message: `${drivers.length} outputs drive this net with different values, so it resolves to unknown.`, drivers: driverLabels };
    }
    return { state: "X", title: "Unknown input", message: "An input feeding this net is unknown (X), so its output is unknown.", drivers: driverLabels };
  }

  /**
   * P0 acceptance seed: build the XOR demo deterministically in one call
   * (2 inputs → XOR → output, wired, running, in1=1/in2=0). Lets the
   * acceptance demo be reproduced instantly and survive a page refresh by
   * re-running. Dev affordance, not product logic.
   */
  loadXorDemo(): void {
    this.history.clear();
    for (const w of [...this.doc.wires.values()]) this.doc.wires.delete(w.id);
    for (const comp of [...this.doc.components.values()]) this.doc.components.delete(comp.id);
    this.selection.clear();

    const add = (part: string, x: number, y: number, props: Record<string, number | string> = {}): number => {
      const cmd = addComponent(this.doc, { part, x, y, rot: 0, props });
      this.history.execute(this.doc, cmd, this.selection);
      return cmd.id;
    };
    const wire = (a: { component: number; pin: string }, b: { component: number; pin: string }): void => {
      this.history.execute(this.doc, addWire(this.doc, [a, b]), this.selection);
    };

    const in1 = add("io:in", 40, 70, { name: "in1", width: 1, value: 1 });
    const in2 = add("io:in", 40, 170, { name: "in2", width: 1, value: 0 });
    const xor = add("builtin:xor", 200, 100);
    const out = add("io:out", 380, 120, { name: "out1", width: 1 });
    wire({ component: in1, pin: "pin" }, { component: xor, pin: "a" });
    wire({ component: in2, pin: "pin" }, { component: xor, pin: "b" });
    wire({ component: xor, pin: "y" }, { component: out, pin: "pin" });

    this.selection.clear();
    this.recompile();
    this.bridge.setRunning(true);
    this.bridge.poke(in1, 1); // 1 (green + halo)
    this.bridge.poke(in2, 0); // 0 (blue) → out = 1
    this.dirtyStatic = true;
    this.dirtySignals = true;
    this.pushUi();
  }

  /**
   * Open an example circuit as a fresh project COPY in its own slot — the
   * current project is flushed to recents first, so nothing is overwritten.
   */
  openTemplate(id: TemplateId): void {
    if (this.editing) return; // not while editing a blueprint
    this.flushDraft();
    this.projectId = newProjectId();
    this.newProject(TEMPLATES.find((t) => t.id === id)?.label ?? "Example");
    const libId = (name: string): string => this.libraryParts.find((p) => p.name === name)?.id ?? "";
    buildTemplate(id, this.doc, this.history, this.selection, libId);
    this.selection.clear();
    this.recompile();
    this.bridge.setRunning(true);
    this.flushDraft();
    this.dirtyStatic = true;
    this.dirtySignals = true;
    this.pushUi();
  }

  // ------------------------------------------------------------ persistence

  /** Project JSON: document + the chip library it depends on. */
  serializeProject(): string {
    return projectToJson(this.doc, this.userParts, this.lib);
  }

  /** Load project JSON in place. Returns an error message or null. */
  loadProjectString(json: string): string | null {
    try {
      const { doc, userParts } = projectFromJson(json, this.lib);
      this.resetDive();
      replaceDocumentContents(this.doc, doc);
      this.userParts = userParts;
      this.history.clear();
      this.selection.clear();
      this.recompile();
      return null;
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
      this.pushUi();
      return this.status;
    }
  }

  private get provider(): StorageProvider {
    this.storage ??= detectStorage();
    return this.storage;
  }

  async saveProject(): Promise<void> {
    try {
      const saved = await this.provider.save("circuit.quadstate.json", this.serializeProject());
      this.status = saved ? `saved (${this.provider.kind})` : "save cancelled";
      this.statusOk = saved;
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
    }
    this.pushUi();
  }

  async openProject(): Promise<void> {
    try {
      const json = await this.provider.load();
      if (json === null) {
        this.status = "open cancelled";
        this.statusOk = false;
        this.pushUi();
        return;
      }
      this.loadProjectString(json);
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
      this.pushUi();
    }
  }

  /** Determinism smoke for this platform's webview (worker-side). */
  runSmoke(): Promise<string> {
    return this.bridge.runSmoke();
  }

  // ------------------------------------------------------- community parts

  /** Self-contained bundle (chip + transitive deps) as JSON. The palette
   *  display name rides along (names are metadata outside the hash). */
  exportChipString(partId: string): string {
    const display = this.userParts.find((p) => p.id === partId)?.name;
    return exportBundle(this.lib, partId, display);
  }

  /** Import a part bundle; registers parts and adds the main chip to the
   *  palette. Returns an error message or null. */
  importChipString(json: string): string | null {
    try {
      const { main, mainName, added } = importBundle(json, this.lib);
      if (!this.userParts.some((p) => p.id === main)) {
        this.userParts.push({ id: main, name: mainName });
      }
      this.status = added.length > 0
        ? `imported "${mainName}" (+${added.length} part${added.length === 1 ? "" : "s"})`
        : `"${mainName}" already in library`;
      this.statusOk = true;
      this.pushUi();
      return null;
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
      this.pushUi();
      return this.status;
    }
  }

  async exportChip(partId: string): Promise<void> {
    const name = this.userParts.find((p) => p.id === partId)?.name
      ?? this.lib.get(partId)?.name ?? "chip";
    try {
      const saved = await this.provider.save(
        `${name}.quadstate-part.json`, this.exportChipString(partId));
      this.status = saved ? `exported "${name}"` : "export cancelled";
      this.statusOk = saved;
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
    }
    this.pushUi();
  }

  async importChip(): Promise<void> {
    try {
      const json = await this.provider.load();
      if (json === null) {
        this.status = "import cancelled";
        this.statusOk = false;
        this.pushUi();
        return;
      }
      this.importChipString(json);
    } catch (err) {
      this.status = err instanceof Error ? err.message : String(err);
      this.statusOk = false;
      this.pushUi();
    }
  }

  toggleRunning(): void {
    this.bridge.setRunning(!this.bridge.running);
    if (this.proto) this.logger.transport(this.bridge.running);
    this.pushUi();
  }

  setSpeed(ticksPerSecond: number): void {
    this.bridge.setSpeed(ticksPerSecond);
  }

  /** Rebuild the spatial grid and recompile the circuit for simulation. */
  recompile(): void {
    this.grid.clear();
    for (const comp of this.doc.components.values()) {
      const b = componentBounds(comp, this.lib);
      this.grid.insert(comp.id, b.x0, b.y0, b.x1, b.y1);
    }
    for (const wire of this.doc.wires.values()) {
      const b = wireBounds(this.doc, this.lib, wire.id);
      if (b) this.grid.insert(wire.id, b.x0, b.y0, b.x1, b.y1);
    }
    const result = this.bridge.compile(this.doc, this.lib);
    this.status = result.message;
    this.statusOk = result.ok;
    this.lastMutationAt = performance.now();
    this.dirtyStatic = true;
    this.dirtySignals = true;
    this.autosaveDraft();
    this.pushUi();
  }

  private renderState(): RenderState {
    const lvl = this.topDive;
    if (lvl) {
      // Diving: render the synthetic interior with live values resolved
      // through the elaboration at this level's hierarchical path.
      return {
        doc: lvl.doc,
        lib: this.lib,
        selection: lvl.selection,
        viewport: this.viewport,
        grid: lvl.grid,
        overlay: {},
        netValues: this.bridge.netValues,
        wireNets: lvl.wireNets,
        ioNets: lvl.ioNets,
        width: this.width,
        height: this.height,
        dpr: this.dpr,
      };
    }
    return {
      doc: this.doc,
      lib: this.lib,
      selection: this.selection,
      viewport: this.viewport,
      grid: this.grid,
      overlay: this.overlay,
      netValues: this.bridge.netValues,
      wireNets: this.bridge.wireNets,
      wireBus: this.bridge.wireBus,
      ioNets: this.bridge.ioNets,
      width: this.width,
      height: this.height,
      dpr: this.dpr,
    };
  }

  private render(): void {
    if (!this.stack || this.width === 0) return;
    const s = this.renderState();
    if (this.dirtyStatic) {
      renderSchematic(this.stack.schematic.getContext("2d")!, s);
      renderInk(this.stack.ink.getContext("2d")!, s);
      renderOverlay(this.stack.overlay.getContext("2d")!, s);
    }
    if (this.dirtyStatic || this.dirtySignals) {
      renderSignals(this.stack.signals.getContext("2d")!, s);
    }
    this.dirtyStatic = false;
    this.dirtySignals = false;
  }

  private pushUi(): void {
    let inspected: UiState["inspected"] = null;
    if (this.selection.size === 1) {
      const id = this.selection.ids()[0];
      const comp = this.doc.components.get(id);
      const def = comp ? this.lib.get(comp.part) : undefined;
      if (comp && def) inspected = { componentId: id, partId: comp.part, name: def.name };
    }
    const canCreateChip = this.canChipSelection;
    const sel = this.selection.ids();
    const canWatch = sel.length === 1 && this.doc.wires.has(sel[0]) && !this.watches.includes(sel[0]);
    let rename: UiState["rename"] = null;
    if (this.renameState) {
      const comp = this.doc.components.get(this.renameState.componentId);
      if (comp) {
        rename = {
          ...this.renameState,
          sx: this.viewport.screenX(comp.x),
          sy: this.viewport.screenY(comp.y) - 34,
        };
      }
    }
    this.onUi?.({
      placePart: this.placePart,
      running: this.bridge.running,
      status: this.status,
      statusOk: this.statusOk,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      simTime: this.bridge.simTime,
      userParts: [...this.userParts],
      libraryParts: this.libraryParts,
      inspected,
      canCreateChip,
      watches: this.watchRows(),
      canWatch,
      partConfig: this.partConfig(),
      whyState: this.selectedWhyState(),
      why: this.whyWireId !== null ? this.computeWhy(this.whyWireId) : null,
      proto: this.proto,
      dive: this.diveLevels.map((l) => l.name),
      diving: this.diving,
      diveRefusal: this.diveEditRefused,
      editing: this.editing ? { name: this.editName, instances: this.editInstanceCount } : null,
      pendingWidth: this.pendingWidth,
      rename,
    });
  }
}

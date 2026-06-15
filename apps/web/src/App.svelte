<script lang="ts">
  import { MIXED, TOKENS, signalColor } from "@logicsim/canvas";
  import CanvasHost from "./lib/CanvasHost.svelte";
  import Inspector from "./lib/Inspector.svelte";
  import TimingDiagram from "./lib/TimingDiagram.svelte";
  import HomeView from "./lib/HomeView.svelte";
  import BrandMark from "./lib/BrandMark.svelte";
  import Splash from "./lib/Splash.svelte";
  import AccountMenu from "./lib/AccountMenu.svelte";
  import Settings from "./lib/Settings.svelte";
  import { AppController, type UiState } from "./lib/controller.js";
  import { listProjects, deleteProjectDraft, renameProjectDraft, type ProjectMeta } from "./lib/draft.js";
  import { type TemplateId } from "./lib/templates.js";
  import { settings, applyReducedMotion, reduceMotionActive } from "./lib/settings.svelte.js";

  const ctrl = new AppController();

  // Settings overlay (shared across Home + editor).
  applyReducedMotion(); // mirror the saved choice onto <html> before first paint
  let settingsOpen = $state(false);
  let settingsSection = $state<"account" | undefined>(undefined);
  function openSettings(section?: "account") { settingsSection = section; settingsOpen = true; }
  function closeSettings() { settingsOpen = false; }

  // Push user prefs into the controller; re-runs whenever any of them change.
  $effect(() => {
    ctrl.setShowGrid(settings.showGrid);
    ctrl.setSnap(settings.snap);
    ctrl.setWheelMode(settings.wheelMode);
    ctrl.setSpaceMode(settings.spaceMode);
    ctrl.setDefaultBusWidth(settings.defaultBusWidth);
    ctrl.setStartLive(settings.startLive);
  });

  // Effective reduced motion = in-app toggle OR the OS preference. Gates the
  // JS-driven Home→Editor portal (CSS animations are handled by the global rule).
  const reduceMotion = $derived(reduceMotionActive());

  // Startup splash plays once per load; Home/editor mount underneath after.
  // `booted` reveals Home (and fades the splash out); `splashGone` then
  // unmounts the overlay. An explicit CSS-class fade is used (not a Svelte
  // out-transition) so removal is deterministic regardless of the splash's
  // in-flight Web Animations.
  let booted = $state(false);
  let splashGone = $state(false);
  function finishSplash() {
    booted = true;
    setTimeout(() => (splashGone = true), 420);
  }

  let view = $state<"home" | "editor">("home");
  let recents = $state<ProjectMeta[]>(listProjects());
  function goHome() { if (ui.editing) return; ctrl.flushDraft(); recents = listProjects(); view = "home"; }
  function goNew() { ctrl.startNewProject(); view = "editor"; }
  function openTemplate(id: TemplateId) { ctrl.openTemplate(id); view = "editor"; }

  // --- Home → Editor: mount the editor normally (the controller fits the
  //     circuit to the canvas robustly, once the canvas has real dimensions).
  //     The transition is a SAFE overlay only — a thumbnail that lifts and
  //     dissolves over the clicked card. It never touches the canvas, viewport,
  //     or layout, so it can't break editor positioning.
  let portal = $state<{ x: number; y: number; w: number; h: number; thumb: string | null } | null>(null);
  function openRecent(id: string, origin?: DOMRect, thumb?: string | null) {
    if (!ctrl.openProjectDraft(id)) return; // preload + (robustly) fit the project
    view = "editor";
    if (reduceMotion || !origin) return;
    portal = { x: origin.left, y: origin.top, w: origin.width, h: origin.height, thumb: thumb ?? null };
    setTimeout(() => { portal = null; }, 380);
  }

  /** Action: a quiet card→editor dissolve. The thumbnail overlay sits over the
   *  clicked card, lifts slightly toward centre while scaling a touch, and
   *  fades out early — revealing the already-fit live editor. It's a separate
   *  fixed element, so it has zero effect on canvas size / viewport / layout. */
  function portalFade(node: HTMLElement, p: { x: number; y: number; w: number; h: number }) {
    node.style.left = `${p.x}px`; node.style.top = `${p.y}px`;
    node.style.width = `${p.w}px`; node.style.height = `${p.h}px`;
    const dx = (window.innerWidth / 2 - (p.x + p.w / 2)) * 0.16;
    const dy = (window.innerHeight / 2 - (p.y + p.h / 2)) * 0.16;
    const anim = node.animate(
      [
        { transform: "translate(0px,0px) scale(1)", opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(1.08)`, opacity: 0, offset: 0.7 },
        { transform: `translate(${dx}px,${dy}px) scale(1.14)`, opacity: 0, offset: 1 },
      ],
      { duration: 360, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
    );
    return { destroy() { anim.cancel(); } };
  }

  function renameProject(id: string, name: string) { renameProjectDraft(id, name); recents = listProjects(); }
  function deleteProject(id: string) { deleteProjectDraft(id); recents = listProjects(); }

  // The single token source (packages/canvas) mirrored onto CSS variables so
  // chrome and canvas never drift. var(--surface1), var(--accent), etc.
  const tokenStyle = Object.entries(TOKENS).map(([k, v]) => `--${k}: ${v}`).join(";");

  let ui = $state<UiState>({
    placePart: null, running: false,
    status: "place parts to begin", statusOk: false,
    canUndo: false, canRedo: false, simTime: 0,
    userParts: [], libraryParts: [], inspected: null, canCreateChip: false,
    watches: [], canWatch: false, timeline: { now: 0, lanes: [] }, partConfig: null,
    whyState: null, why: null,
    proto: false, dive: [], diving: false, diveRefusal: false, editing: null,
    pendingWidth: null, rename: null,
  });

  let scopeCollapsed = $state(false);
  let scopeHeight = $state(200);

  const VAL = ["0", "1", "X", "Z"];
  const valLabel = (v: number | null) => (v == null ? "—" : VAL[v]);
  const valColor = (v: number | null) =>
    v == null ? "var(--text3)" : v === MIXED ? signalColor(1) : signalColor(v);
  ctrl.onUi = (next) => { ui = next; };

  function createChip() {
    if (ui.proto) { ctrl.createChipProto(); return; }
    if (!ui.canCreateChip) return;
    const name = window.prompt("Chip name?", "MyChip");
    const trimmed = name?.trim();
    if (trimmed) ctrl.createChip(trimmed);
  }
  // Ctrl/Cmd+G in the default editor routes here so naming stays in the shell.
  ctrl.onRequestCreateChip = createChip;

  let renameValue = $state("");
  let renameKey = $state(-1);
  $effect(() => {
    if (ui.rename && ui.rename.componentId !== renameKey) {
      renameKey = ui.rename.componentId;
      renameValue = ui.rename.name;
    } else if (!ui.rename) {
      renameKey = -1;
    }
  });
  function autofocus(node: HTMLInputElement) { node.focus(); node.select(); }
  function renameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") ctrl.commitRename(renameValue);
    else if (e.key === "Escape") ctrl.cancelRename();
    e.stopPropagation();
  }
  function stampLabel(part: string): string {
    if (part === "io:in") return "IN";
    if (part === "io:out") return "OUT";
    if (part.startsWith("builtin:")) return part.slice(8).toUpperCase();
    return ui.userParts.find((p) => p.id === part)?.name ?? "chip";
  }

  const palette = [
    { part: "io:in", label: "IN" },
    { part: "io:out", label: "OUT" },
    { part: "builtin:and", label: "AND" },
    { part: "builtin:or", label: "OR" },
    { part: "builtin:xor", label: "XOR" },
    { part: "builtin:nand", label: "NAND" },
    { part: "builtin:nor", label: "NOR" },
    { part: "builtin:not", label: "NOT" },
    { part: "builtin:tri", label: "TRI" },
    { part: "builtin:dff", label: "DFF" },
    { part: "builtin:clock", label: "CLK" },
    { part: "builtin:const", label: "CONST" },
  ];

  // Accepts decimal, 0x hex, or 0b binary (Number handles all three). Returns
  // null for blanks/garbage so the field reverts instead of zeroing.
  function parseValue(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }
  const toHex = (v: number) => "0x" + v.toString(16).toUpperCase();

  // Live transport speed; seeded from the saved default and re-seeded whenever
  // the default changes in Settings (dragging the slider only changes `speed`).
  let speed = $state(settings.defaultSpeed);
  $effect(() => {
    speed = settings.defaultSpeed;
    ctrl.setSpeed(settings.defaultSpeed);
  });
  function onSpeed(e: Event) {
    speed = Number((e.target as HTMLInputElement).value);
    ctrl.setSpeed(speed);
  }

  // One-time first-run hint in the editor.
  let hintDismissed = $state(
    typeof localStorage !== "undefined" && localStorage.getItem("quadstate:hintSeen") === "1",
  );
  function dismissHint() {
    hintDismissed = true;
    try { localStorage.setItem("quadstate:hintSeen", "1"); } catch { /* ignore */ }
  }
</script>

{#if booted}
{#if view === "home"}
  <HomeView {recents} onNew={goNew} onOpen={openRecent} onTemplate={openTemplate}
    onRename={renameProject} onDelete={deleteProject} onOpenSettings={openSettings} />
{:else}
<div class="app" style={tokenStyle}>
  <header>
    <button class="brand" onclick={goHome} title="Home">
      <BrandMark size={15} />
      QuadState
    </button>

    {#if ui.editing}
      <div class="editbar">
        <span class="edit-label">Editing definition</span>
        <span class="edit-name">{ui.editing.name}</span>
        <span class="edit-affects">affects {ui.editing.instances} instance{ui.editing.instances === 1 ? "" : "s"}</span>
        <button class="edit-save" onclick={() => ctrl.saveDefinition()}>Save &amp; exit</button>
        <button class="edit-cancel" onclick={() => ctrl.cancelEditDefinition()}>Cancel</button>
      </div>
    {:else if ui.diving}
      <nav class="breadcrumb" aria-label="Hierarchy path">
        <button class="crumb" onclick={() => ctrl.surfaceTo(0)}>Top</button>
        {#each ui.dive as name, i}
          <span class="sep">›</span>
          {#if i < ui.dive.length - 1}
            <button class="crumb" onclick={() => ctrl.surfaceTo(i + 1)}>{name}</button>
          {:else}
            <span class="crumb current">{name}</span>
          {/if}
        {/each}
        <span class="live-badge" title="Viewing a live instance — read-only">● LIVE · read-only</span>
      </nav>
    {/if}

    <div class="spacer"></div>

    <div class="seg transport">
      <button class:run={ui.running} onclick={() => ctrl.toggleRunning()}>
        {ui.running ? "❚❚ Pause" : "▶ Run"}
      </button>
      <label class="speed">
        <input type="range" min="100" max="20000" step="100" value={speed} oninput={onSpeed} />
        <span>{speed} t/s</span>
      </label>
    </div>

    <div class="spacer"></div>

    <div class="seg">
      <button disabled={!ui.canUndo || ui.diving} onclick={() => ctrl.undo()}>Undo</button>
      <button disabled={!ui.canRedo || ui.diving} onclick={() => ctrl.redo()}>Redo</button>
      <button disabled={ui.diving} onclick={() => ctrl.deleteSelection()}>Delete</button>
      <button class="chip" disabled={!ui.canCreateChip || ui.diving} onclick={createChip}
        title="Create a chip from the selected parts (Ctrl+G)">Create Chip</button>
    </div>
    <div class="seg">
      <button disabled={ui.editing != null} onclick={() => ctrl.saveProject()}>Save</button>
      <button disabled={ui.editing != null} onclick={() => ctrl.openProject()}>Open</button>
    </div>

    <div class="seg account-seg">
      <AccountMenu onOpenSettings={openSettings} />
    </div>
  </header>

  <div class="body">
    <aside class="palette">
      <div class="rail-label">BUILT-IN</div>
      {#each palette as p}
        <button
          class="part"
          class:active={ui.placePart === p.part}
          title="Drag onto the canvas, or click to place repeatedly"
          onpointerdown={(e) => ctrl.beginPaletteDrag(p.part, e)}
        >{p.label}</button>
      {/each}
      {#if ui.libraryParts.length > 0}
        <div class="rail-label">LIBRARY</div>
        {#each ui.libraryParts as p (p.id)}
          <button
            class="part lib"
            class:active={ui.placePart === p.id}
            title="Drag onto the canvas, or click to place repeatedly"
            onpointerdown={(e) => ctrl.beginPaletteDrag(p.id, e)}
          >{p.name}</button>
        {/each}
      {/if}
      {#if ui.userParts.length > 0}
        <div class="rail-label">MY CHIPS</div>
        {#each ui.userParts as p (p.id)}
          <button
            class="part user"
            class:active={ui.placePart === p.id}
            title="Drag onto the canvas, or click to place repeatedly"
            onpointerdown={(e) => ctrl.beginPaletteDrag(p.id, e)}
          >{p.name}</button>
        {/each}
      {/if}
    </aside>

    <main>
      <div class="canvas-region">
        <CanvasHost {ctrl} />
        {#if ui.placePart}
          <div class="stamp-banner">Stamping <b>{stampLabel(ui.placePart)}</b> — click to place, Esc to stop</div>
        {/if}
        {#if ui.diveRefusal}
          <div class="dive-refusal" role="status">
            <span>This is a live instance — its contents are read-only.</span>
            <button class="edit-def" onclick={() => ctrl.requestEditDefinition()}>Edit definition</button>
            <button class="icon-x" title="Dismiss" onclick={() => ctrl.dismissDiveRefusal()}>×</button>
          </div>
        {/if}
        {#if ui.proto && ui.rename}
          <input class="rename" style="left: {ui.rename.sx}px; top: {ui.rename.sy}px"
            use:autofocus bind:value={renameValue} onkeydown={renameKeydown}
            onblur={() => ctrl.commitRename(renameValue)} />
        {/if}
        {#if !hintDismissed && !ui.editing && !ui.diving}
          <div class="hint" role="note">
            <span><b>Tip:</b> drag a part from the palette · click an input to toggle it · drag from one pin to another to wire.</span>
            <button class="icon-x" title="Got it" onclick={dismissHint}>×</button>
          </div>
        {/if}
      </div>
      <TimingDiagram timeline={ui.timeline} canAdd={ui.canWatch}
        onAddSelected={() => ctrl.addWatchSelected()}
        bind:collapsed={scopeCollapsed} bind:height={scopeHeight} />
    </main>

    <aside class="rail">
      {#if ui.partConfig}
        {@const pc = ui.partConfig}
        <div class="rail-section">
          <div class="rail-label">{pc.label.toUpperCase()}</div>
          {#if pc.type === "const"}
            <input class="cfg-input" type="text" inputmode="text" spellcheck="false"
              value={toHex(pc.value)} placeholder="0x2A, 0b1010, or 42"
              title="Decimal, 0x hex, or 0b binary"
              onchange={(e) => {
                const n = parseValue((e.currentTarget as HTMLInputElement).value);
                if (n !== null) ctrl.setPartConfig(pc.id, "const", n);
                else (e.currentTarget as HTMLInputElement).value = toHex(pc.value);
              }} />
          {:else}
            <input class="cfg-input" type="number" min="1" max={pc.max}
              value={pc.value}
              onchange={(e) => ctrl.setPartConfig(pc.id, "io", Number((e.currentTarget as HTMLInputElement).value))} />
          {/if}
        </div>
      {/if}
      {#if ui.inspected}
        <Inspector {ctrl} componentId={ui.inspected.componentId} partId={ui.inspected.partId}
          name={ui.inspected.name} tick={ui.simTime} />
      {:else}
        <div class="rail-section">
          <div class="rail-label">INSPECTOR</div>
          <div class="rail-hint">Select a part to inspect its pins and live values.</div>
        </div>
      {/if}
      {#if ui.why}
        <div class="rail-section why">
          <div class="why-head">
            <span class="why-token" style="color: {ui.why.state === 'X' ? 'var(--sigX)' : 'var(--sigZ)'}">{ui.why.state}</span>
            <span class="why-title">{ui.why.title}</span>
            <button class="icon-x" title="Close" onclick={() => ctrl.clearWhy()}>×</button>
          </div>
          <div class="why-msg">{ui.why.message}</div>
          {#if ui.why.drivers.length}
            <div class="why-drivers">
              {#each ui.why.drivers as d}<span class="why-driver">{d}</span>{/each}
            </div>
          {/if}
        </div>
      {:else if ui.whyState}
        <div class="rail-section">
          <button class="why-btn" onclick={() => ctrl.explainSelected()}>Why is this {ui.whyState}?</button>
        </div>
      {/if}

      <div class="rail-section watches">
        <div class="rail-label">WATCHES</div>
        {#if ui.watches.length > 0}
          {#each ui.watches as w (w.key)}
            <div class="watch-row" class:gone={w.gone}>
              <span class="watch-name">{w.label}{#if w.width > 1}<span class="wtag">[{w.width}]</span>{/if}</span>
              <span class="watch-val" style="color: {w.gone ? 'var(--text3)' : valColor(w.value)}" title={w.gone ? 'unresolved' : (w.bin ?? '')}>{w.gone ? '—' : (w.width > 1 ? w.hex : valLabel(w.value))}</span>
              <button class="icon-x" title="Remove" onclick={() => ctrl.removeTracked(w.key)}>×</button>
            </div>
          {/each}
        {:else if !ui.canWatch}
          <div class="rail-hint">Select a wire to watch its signal.</div>
        {/if}
        <button class="watch-add" disabled={!ui.canWatch} onclick={() => ctrl.addWatchSelected()}>+ Watch selected wire</button>
      </div>

      <div class="rail-section status-section">
        <div class="rail-label">STATUS / WARNINGS</div>
        <div class="status-line" class:warn={!ui.statusOk}>{ui.status}</div>
        <div class="status-tick">t = {ui.simTime}</div>
      </div>
    </aside>
  </div>
</div>
{/if}
{/if}

{#if settingsOpen}
  <div style={tokenStyle}>
    <Settings initialSection={settingsSection ?? "appearance"} onClose={closeSettings} />
  </div>
{/if}

{#if portal}
  <div class="portal" use:portalFade={portal} style={tokenStyle}>
    {#if portal.thumb}<img src={portal.thumb} alt="" />{/if}
  </div>
{/if}

{#if !splashGone}
  <div class="splash-wrap" class:fade={booted} style={tokenStyle}>
    <Splash onDone={finishSplash} />
  </div>
{/if}

<style>
  .app {
    display: flex; flex-direction: column; height: 100%;
    background: var(--bg); color: var(--text1);
    font-family: Inter, system-ui, sans-serif;
  }

  header {
    display: flex; align-items: center; gap: 12px;
    height: 52px; padding: 0 14px; flex: 0 0 auto;
    background: var(--bg); border-bottom: 1px solid var(--hairline);
  }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 15px; letter-spacing: -0.01em; background: none; border: none; color: var(--text1); cursor: pointer; padding: 0; transition: opacity .14s ease; }
  .brand:hover { opacity: 0.82; }

  .seg { display: flex; gap: 4px; align-items: center; }
  .spacer { flex: 1 1 auto; }

  button {
    background: var(--surface1); color: var(--text2);
    border: 1px solid var(--hairline); border-radius: 8px;
    padding: 6px 12px; cursor: pointer; font: inherit; font-size: 13px;
  }
  button:hover:not(:disabled) { background: var(--surface2); color: var(--text1); }
  button:disabled { opacity: 0.4; cursor: default; }
  button.active { background: var(--accentQuiet); border-color: var(--accent); color: var(--text1); }
  .transport button.run { color: var(--text1); border-color: var(--hairlineStrong); }
  button.chip:not(:disabled) { color: var(--text1); }

  .speed { display: flex; align-items: center; gap: 7px; color: var(--text3); font-size: 12px; font-family: ui-monospace, monospace; }
  .speed input { width: 96px; }

  /* Status / Warnings — moved out of the header into the right rail. Monochrome
     by the visual-system rule (signal colors stay reserved for the canvas). */
  .status-line { font-size: 12px; color: var(--text2); line-height: 1.5; font-family: ui-monospace, monospace; word-break: break-word; }
  .status-line.warn { color: var(--text1); }
  .status-line.warn::before { content: "⚠ "; color: var(--text1); }
  .status-tick { margin-top: 6px; font-size: 11px; color: var(--text3); font-family: ui-monospace, monospace; }

  .body { display: flex; flex: 1 1 auto; min-height: 0; }

  .palette {
    display: flex; flex-direction: column; gap: 3px;
    width: 132px; flex: 0 0 auto; padding: 12px 10px; overflow-y: auto;
    background: var(--bg); border-right: 1px solid var(--hairline);
  }
  .rail-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.10em;
    color: var(--text3); margin: 6px 2px 6px;
  }
  .palette button.part {
    text-align: left; padding: 7px 10px; border-color: transparent; background: transparent;
  }
  .palette button.part:hover { background: var(--surface2); }
  .palette button.part.active { background: var(--accentQuiet); border-left: 2px solid var(--accent); border-radius: 0 8px 8px 0; }
  .palette button.user { color: var(--text1); }
  .palette button.lib { color: var(--text1); }

  main { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .canvas-region { flex: 1 1 auto; min-width: 0; min-height: 0; position: relative; }

  .rail {
    width: 220px; flex: 0 0 auto; display: flex; flex-direction: column;
    background: var(--bg); border-left: 1px solid var(--hairline); overflow-y: auto;
  }
  .rail-section { padding: 12px 14px; border-bottom: 1px solid var(--hairline); }
  .rail-hint { font-size: 12px; color: var(--text3); margin-top: 6px; line-height: 1.5; }
  .watch-row { display: flex; align-items: center; gap: 8px; height: 30px; font-size: 13px; }
  .watch-row.gone { opacity: 0.5; }
  .watch-name { flex: 1; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .watch-val { font-family: ui-monospace, monospace; font-weight: 600; }
  .wtag { font-family: ui-monospace, monospace; font-size: 11px; color: var(--text3); margin-left: 5px; }
  .cfg-input {
    width: 100%; background: var(--surface1); color: var(--text1);
    border: 1px solid var(--hairline); border-radius: 8px; padding: 6px 10px;
    font: inherit; font-size: 13px; font-family: ui-monospace, monospace;
  }
  .cfg-input:focus { outline: none; border-color: var(--accent); }
  .icon-x { background: none; border: none; color: var(--text3); cursor: pointer; padding: 0 4px; font-size: 14px; }
  .icon-x:hover:not(:disabled) { color: var(--text1); background: none; }
  .watch-add { margin-top: 8px; width: 100%; font-size: 12px; color: var(--text2); }
  .why-btn { width: 100%; border-color: var(--accent); color: var(--accent); }
  .why-head { display: flex; align-items: center; gap: 8px; }
  .why-token { font-family: ui-monospace, monospace; font-weight: 700; font-size: 13px; }
  .why-title { flex: 1; font-size: 14px; font-weight: 600; }
  .why-msg { font-size: 13px; color: var(--text1); line-height: 1.5; margin-top: 8px; }
  .why-drivers { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .why-driver { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text2); background: var(--surface2); border-radius: 6px; padding: 2px 8px; }

  .stamp-banner {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 5;
    background: var(--accentQuiet); border: 1px solid var(--accent);
    border-radius: 8px; padding: 5px 14px; font-size: 12px; color: var(--text1); pointer-events: none;
  }

  /* First-run hint — calm, bottom-centred, dismissable. */
  .hint {
    position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); z-index: 5;
    display: flex; align-items: center; gap: 10px; max-width: min(720px, 80%);
    background: var(--surface2); border: 1px solid var(--hairlineStrong);
    border-radius: 10px; padding: 7px 8px 7px 14px; font-size: 12px; color: var(--text2);
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }
  .hint b { color: var(--text1); font-weight: 600; }

  /* Hierarchy breadcrumb (header-left, only while diving). */
  .breadcrumb { display: flex; align-items: center; gap: 4px; margin-left: 2px; }
  .crumb { background: none; border: none; color: var(--text2); padding: 3px 7px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; }
  .crumb:hover:not(.current) { background: var(--surface2); color: var(--text1); }
  .crumb.current { color: var(--text1); font-weight: 600; cursor: default; }
  .sep { color: var(--text3); font-size: 12px; }
  .live-badge {
    margin-left: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
    color: var(--text2); background: var(--surface2); border: 1px solid var(--hairline);
    border-radius: 999px; padding: 2px 9px; white-space: nowrap;
  }

  /* Edit Definition mode bar (header-left while editing a blueprint). */
  .editbar { display: flex; align-items: center; gap: 8px; margin-left: 2px; }
  .edit-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--text2); background: var(--surface2); border: 1px solid var(--hairline); border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
  .edit-name { font-size: 13px; font-weight: 600; color: var(--text1); }
  .edit-affects { font-size: 12px; color: var(--text3); }
  .edit-save { color: #fff; background: var(--accent); border-color: var(--accent); font-weight: 600; }
  .edit-save:hover:not(:disabled) { background: var(--accentHover); color: #fff; }
  .edit-cancel { color: var(--text2); }

  /* Neutral read-only refusal (never red — red is reserved for signal X). */
  .dive-refusal {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 6;
    display: flex; align-items: center; gap: 12px;
    background: var(--surface2); border: 1px solid var(--hairlineStrong);
    border-radius: 10px; padding: 7px 8px 7px 14px; font-size: 13px; color: var(--text1);
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }
  .edit-def {
    background: var(--surface1); color: var(--text1); border: 1px solid var(--hairlineStrong);
    border-radius: 8px; padding: 4px 12px; cursor: pointer; font: inherit; font-size: 12px;
  }
  .edit-def:hover { background: var(--surface3); }
  .rename {
    position: absolute; z-index: 6; width: 130px;
    background: var(--surface1); color: var(--text1); border: 1px solid var(--accent);
    border-radius: 6px; padding: 4px 8px; font: inherit; font-size: 12px;
  }

  .splash-wrap { position: fixed; inset: 0; z-index: 200; transition: opacity .4s ease; }
  .splash-wrap.fade { opacity: 0; pointer-events: none; }
  /* Home → Editor: a safe overlay only. A card-sized thumbnail that lifts and
     dissolves (portalFade); it's a separate fixed element, so it never affects
     the canvas size, viewport, or layout. Starts hidden until positioned. */
  .portal {
    position: fixed; z-index: 150; opacity: 0;
    transform-origin: center;
    background: var(--bg); overflow: hidden; border-radius: 12px;
    box-shadow: 0 18px 50px rgba(0,0,0,0.45);
    will-change: transform, opacity; pointer-events: none;
  }
  .portal img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>

<script lang="ts">
  let { onClose }: { onClose: () => void } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { onClose(); e.stopPropagation(); }
  }

  const mod = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl";

  // Canvas gestures (modeless editor — "the target decides").
  const gestures: Array<[string, string]> = [
    ["Drag a part from the palette", "place it on the canvas"],
    ["Click an input (IN)", "toggle it 0 ↔ 1"],
    ["Drag from one pin to another", "wire them together"],
    ["Alt + tap a wire", "add it to the timing diagram"],
    ["Drag a part", "move the selection"],
    ["Drag on empty canvas", "marquee-select"],
    ["Scroll", "zoom · hold Space to pan"],
  ];

  const keys: Array<[string, string]> = [
    [`${mod} + Z`, "Undo"],
    [`${mod} + Y  ·  ${mod} + Shift + Z`, "Redo"],
    [`${mod} + G`, "Create chip from selection"],
    ["Delete / Backspace", "Delete selection"],
    ["Esc", "Drop the armed part · clear selection"],
    ["Space", "Run / Pause (or hold to pan)"],
  ];
</script>

<svelte:window onkeydown={onKeydown} />

<div class="scrim" onclick={onClose} role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="Shortcuts and gestures" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2>Shortcuts &amp; gestures</h2>
      <button class="x" title="Close (Esc)" aria-label="Close" onclick={onClose}>×</button>
    </header>

    <div class="callout">
      <strong>The bottom drawer is a logic analyzer.</strong>
      Track a wire on it three ways — <em>Alt + tap</em> the wire, the drawer's <em>“+ wire”</em>
      button, or the Inspector's <em>“+scope”</em>. Open an example (Counter, Traffic Light) to see it animate.
    </div>

    <div class="cols">
      <section>
        <div class="eyebrow">Canvas</div>
        {#each gestures as [g, d]}
          <div class="row"><span class="g">{g}</span><span class="d">{d}</span></div>
        {/each}
      </section>
      <section>
        <div class="eyebrow">Keyboard</div>
        {#each keys as [k, d]}
          <div class="row"><kbd>{k}</kbd><span class="d">{d}</span></div>
        {/each}
      </section>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
    background: var(--scrim); backdrop-filter: blur(3px); padding: 24px;
    animation: fade .12s ease both;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .panel {
    width: min(620px, 100%); max-height: 86vh; overflow-y: auto;
    background: var(--surface1); border: 1px solid var(--hairline);
    border-radius: 14px; box-shadow: 0 24px 60px var(--shadow);
    color: var(--text1); padding: 18px 20px 22px;
  }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  .x {
    width: 28px; height: 28px; display: grid; place-items: center; padding: 0;
    background: transparent; border: none; color: var(--text2); font-size: 20px;
    line-height: 1; cursor: pointer; border-radius: 7px;
  }
  .x:hover { background: var(--surface3); color: var(--text1); }

  .callout {
    background: var(--surface2); border: 1px solid var(--hairline); border-radius: 10px;
    padding: 11px 13px; font-size: 12.5px; line-height: 1.5; color: var(--text2); margin-bottom: 16px;
  }
  .callout strong { color: var(--text1); font-weight: 600; }
  .callout em { color: var(--text1); font-style: normal; font-weight: 500; }

  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 26px; }
  @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } }
  .eyebrow {
    font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text3); margin-bottom: 8px;
  }
  .row { display: flex; align-items: baseline; gap: 10px; padding: 4px 0; font-size: 12.5px; }
  .g { flex: 0 0 auto; color: var(--text1); }
  .d { flex: 1; color: var(--text3); text-align: right; }
  kbd {
    flex: 0 0 auto; font-family: ui-monospace, monospace; font-size: 11px; color: var(--text1);
    background: var(--surface2); border: 1px solid var(--hairline); border-bottom-width: 2px;
    border-radius: 6px; padding: 2px 6px; white-space: nowrap;
  }
</style>

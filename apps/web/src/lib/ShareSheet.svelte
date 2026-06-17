<script lang="ts">
  import { AppController } from "./controller.js";
  import { renderCircuitPng } from "./thumbnail.js";

  let { ctrl, onClose }: { ctrl: AppController; onClose: () => void } = $props();

  // The sheet remounts on each open; `ctrl` is a plain (non-reactive) class, so
  // these compute once. $derived keeps Svelte from warning about a local capture.
  const dataUrl = $derived(renderCircuitPng(ctrl.serializeProject()));

  // File-system-safe stem from the project name (fallback: "circuit").
  const safeName = $derived(
    (ctrl.projectName?.trim() || "circuit")
      .replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "circuit",
  );

  const canCopy =
    typeof navigator !== "undefined" && !!navigator.clipboard?.write &&
    typeof ClipboardItem !== "undefined";

  let note = $state("");

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { onClose(); e.stopPropagation(); }
  }

  function downloadPng() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeName}.png`;
    a.click();
    note = "PNG saved to your downloads";
  }

  async function copyPng() {
    if (!dataUrl || !canCopy) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      note = "Image copied to clipboard";
    } catch {
      note = "Couldn’t copy — use Download instead";
    }
  }

  async function saveProject() {
    await ctrl.saveProject();
    onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="scrim" onclick={onClose} role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="Share and export" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2>Share / Export</h2>
      <button class="x" title="Close (Esc)" aria-label="Close" onclick={onClose}>×</button>
    </header>

    <div class="preview" class:empty={!dataUrl}>
      {#if dataUrl}
        <img src={dataUrl} alt="Preview of the current circuit" />
      {:else}
        <span>Place some parts to export an image.</span>
      {/if}
    </div>

    <div class="actions">
      <button class="primary" disabled={!dataUrl} onclick={downloadPng}>Download PNG</button>
      {#if canCopy}
        <button disabled={!dataUrl} onclick={copyPng}>Copy image</button>
      {/if}
      <button onclick={saveProject}>Save project file…</button>
    </div>

    <p class="hint">
      The PNG is a picture for sharing. Save the <strong>project file</strong> to keep editing later
      (re-open it with <em>Open</em>), or import a shared chip bundle with <em>Import</em> in the toolbar.
    </p>

    {#if note}<div class="note" role="status">{note}</div>{/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
    background: rgba(7, 9, 12, 0.6); backdrop-filter: blur(3px); padding: 24px;
    animation: fade .12s ease both;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .panel {
    width: min(560px, 100%); max-height: 86vh; overflow-y: auto;
    background: var(--surface1); border: 1px solid var(--hairline);
    border-radius: 14px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    color: var(--text1); padding: 18px 20px 20px;
  }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  .x {
    width: 28px; height: 28px; display: grid; place-items: center; padding: 0;
    background: transparent; border: none; color: var(--text2); font-size: 20px;
    line-height: 1; cursor: pointer; border-radius: 7px;
  }
  .x:hover { background: var(--surface3); color: var(--text1); }

  .preview {
    display: grid; place-items: center; background: var(--bg);
    border: 1px solid var(--hairline); border-radius: 10px;
    min-height: 200px; max-height: 46vh; overflow: hidden; padding: 10px;
  }
  .preview img { max-width: 100%; max-height: calc(46vh - 20px); object-fit: contain; border-radius: 4px; }
  .preview.empty { color: var(--text3); font-size: 13px; }

  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .actions button {
    flex: 1 1 auto; min-width: 120px; padding: 9px 12px; font-size: 13px; font-weight: 500;
    background: var(--surface2); color: var(--text1);
    border: 1px solid var(--hairline); border-radius: 8px; cursor: pointer;
    transition: background .12s ease, border-color .12s ease;
  }
  .actions button:hover:not(:disabled) { background: var(--surface3); }
  .actions button:disabled { opacity: 0.5; cursor: default; }
  .actions .primary {
    background: var(--accent); border-color: var(--accent); color: #fff;
  }
  .actions .primary:hover:not(:disabled) { background: var(--accentHover); }

  .hint { margin: 14px 2px 0; font-size: 12px; line-height: 1.55; color: var(--text3); }
  .hint strong, .hint em { color: var(--text2); font-style: normal; font-weight: 500; }

  .note {
    margin-top: 12px; padding: 8px 11px; font-size: 12.5px;
    background: var(--surface2); border: 1px solid var(--hairline);
    border-radius: 8px; color: var(--text2);
  }
</style>

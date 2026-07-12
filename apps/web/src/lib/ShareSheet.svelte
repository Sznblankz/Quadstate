<script lang="ts">
  import { AppController } from "./controller.js";
  import { renderCircuitPng } from "./thumbnail.js";
  import { account } from "./account.svelte.js";
  import { SUPABASE_ENABLED } from "./supabase.js";
  import { enableShare, disableShare, getShareState } from "./share.js";

  let { ctrl, onClose }: { ctrl: AppController; onClose: () => void } = $props();

  // --- Public share link (signed-in owner, cloud project only). ---
  const canShareLink = $derived(
    SUPABASE_ENABLED && account.status === "signedIn" && !ctrl.readOnly && !!ctrl.currentProjectId,
  );
  let shareBusy = $state(false);
  let isPublic = $state(false);
  let shareLink = $state<string | null>(null);
  let copied = $state(false);

  $effect(() => {
    if (!canShareLink) return;
    let cancelled = false;
    getShareState(ctrl.currentProjectId).then((s) => {
      if (cancelled) return;
      isPublic = s.isPublic;
      shareLink = s.url;
    });
    return () => { cancelled = true; };
  });

  async function toggleShare() {
    if (shareBusy) return;
    shareBusy = true;
    if (isPublic) {
      if (await disableShare(ctrl.currentProjectId)) isPublic = false;
    } else {
      await ctrl.flushNow(); // ensure the project row exists before sharing it
      const url = await enableShare(ctrl.currentProjectId);
      if (url) { isPublic = true; shareLink = url; }
    }
    shareBusy = false;
  }

  async function copyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      note = "Couldn’t copy — select the link and copy it manually";
    }
  }

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

<div class="scrim" role="dialog" aria-modal="true" aria-label="Share and export">
  <button class="backdrop" aria-label="Close share sheet" onclick={onClose}></button>
  <div class="panel">
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

    {#if SUPABASE_ENABLED}
      <div class="sharelink">
        <div class="sl-head">
          <span class="sl-title">Share link</span>
          {#if canShareLink}
            <button class="switch" class:on={isPublic} role="switch" aria-checked={isPublic}
              aria-label="Anyone with the link can view" disabled={shareBusy} onclick={toggleShare}>
              <span class="knob"></span>
            </button>
          {/if}
        </div>
        {#if !canShareLink}
          <p class="sl-hint">Sign in to publish a read-only link anyone can open — no account needed to view it.</p>
        {:else if isPublic && shareLink}
          <p class="sl-hint">Anyone with this link can view this circuit (read-only).</p>
          <div class="sl-row">
            <input class="sl-input" readonly value={shareLink} onfocus={(e) => e.currentTarget.select()} />
            <button class="sl-copy" onclick={copyLink}>{copied ? "Copied" : "Copy"}</button>
          </div>
        {:else}
          <p class="sl-hint">Turn this on to create a public, read-only link to this circuit.</p>
        {/if}
      </div>
    {/if}

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
    background: var(--scrim); backdrop-filter: blur(3px); padding: 24px;
    animation: fade .12s ease both;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .backdrop { position: absolute; inset: 0; background: none; border: none; cursor: default; }
  .panel {
    position: relative;
    width: min(560px, 100%); max-height: 86vh; overflow-y: auto;
    background: var(--surface1); border: 1px solid var(--hairline);
    border-radius: 14px; box-shadow: 0 24px 60px var(--shadow);
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

  /* Share link section. */
  .sharelink { margin-top: 16px; padding: 14px; background: var(--surface2); border: 1px solid var(--hairline); border-radius: 10px; }
  .sl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sl-title { font-size: 13px; font-weight: 600; color: var(--text1); }
  .sl-hint { margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: var(--text3); }
  .sl-row { display: flex; gap: 8px; margin-top: 10px; }
  .sl-input {
    flex: 1 1 auto; min-width: 0; background: var(--surface1); color: var(--text1);
    border: 1px solid var(--hairline); border-radius: 8px; padding: 7px 10px;
    font: inherit; font-size: 12px; font-family: ui-monospace, monospace;
  }
  .sl-input:focus { outline: none; border-color: var(--accent); }
  .sl-copy {
    flex: 0 0 auto; background: var(--surface1); color: var(--text1);
    border: 1px solid var(--hairline); border-radius: 8px; padding: 7px 14px;
    font: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .sl-copy:hover { background: var(--surface3); }
  /* Pill switch — neutral off, accent on (matches Settings). */
  .switch { flex: 0 0 auto; width: 40px; height: 23px; border-radius: 999px; background: var(--surface3); border: 1px solid var(--hairline); padding: 0; cursor: pointer; position: relative; transition: background .14s ease, border-color .14s ease; }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: var(--text2); transition: transform .14s ease, background .14s ease; }
  .switch.on { background: var(--accent); border-color: var(--accent); }
  .switch.on .knob { transform: translateX(17px); background: #fff; }
  .switch:disabled { opacity: 0.5; cursor: default; }
  .switch:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accentQuiet); }

  .hint { margin: 14px 2px 0; font-size: 12px; line-height: 1.55; color: var(--text3); }
  .hint strong, .hint em { color: var(--text2); font-style: normal; font-weight: 500; }

  .note {
    margin-top: 12px; padding: 8px 11px; font-size: 12.5px;
    background: var(--surface2); border: 1px solid var(--hairline);
    border-radius: 8px; color: var(--text2);
  }
</style>

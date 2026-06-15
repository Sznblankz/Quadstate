<script lang="ts">
  import { untrack } from "svelte";
  import { settings, setSetting, APP_NAME, APP_VERSION, type WheelMode, type SpaceMode } from "./settings.svelte.js";
  import { account, signIn, signOut, BACKEND_NEEDED } from "./account.svelte.js";

  let { initialSection = "appearance", onClose }: {
    initialSection?: SectionId;
    onClose: () => void;
  } = $props();

  type SectionId = "appearance" | "input" | "canvas" | "simulation" | "account" | "about";
  const SECTIONS: Array<{ id: SectionId; label: string }> = [
    { id: "appearance", label: "Appearance & Accessibility" },
    { id: "input", label: "Input & Devices" },
    { id: "canvas", label: "Canvas" },
    { id: "simulation", label: "Simulation" },
    { id: "account", label: "Account" },
    { id: "about", label: "About" },
  ];
  // Seed the open section from the prop once; the overlay remounts on each
  // open, so capturing the initial value (not tracking it) is intentional.
  let active = $state<SectionId>(untrack(() => initialSection));

  // Inline local-profile form for the Account section.
  let nameField = $state(account.name);
  let emailField = $state(account.email);
  function doSignIn() {
    if (!nameField.trim() && !emailField.trim()) return;
    signIn(nameField, emailField);
  }

  function clampInt(v: string, lo: number, hi: number, fallback: number): number {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { onClose(); e.stopPropagation(); }
  }

  const WHEEL_OPTS: Array<{ value: WheelMode; label: string }> = [
    { value: "zoom", label: "Zoom" },
    { value: "pan", label: "Pan" },
  ];
  const SPACE_OPTS: Array<{ value: SpaceMode; label: string }> = [
    { value: "playPan", label: "Tap play/pause · hold pan" },
    { value: "transport", label: "Transport only" },
  ];
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet row(label: string, desc: string)}
  <div class="row-text">
    <div class="row-label">{label}</div>
    {#if desc}<div class="row-desc">{desc}</div>{/if}
  </div>
{/snippet}

{#snippet toggle(checked: boolean, onToggle: () => void, label: string)}
  <button class="switch" class:on={checked} role="switch" aria-checked={checked} aria-label={label} onclick={onToggle}>
    <span class="knob"></span>
  </button>
{/snippet}

<div class="overlay" role="dialog" aria-modal="true" aria-label="Settings">
  <button class="backdrop" aria-label="Close settings" onclick={onClose}></button>

  <div class="modal">
    <header class="modal-head">
      <h2>Settings</h2>
      <button class="close" aria-label="Close" onclick={onClose}>×</button>
    </header>

    <div class="modal-body">
      <nav class="nav" aria-label="Settings sections">
        {#each SECTIONS as s}
          <button class="nav-item" class:active={active === s.id} onclick={() => (active = s.id)}>{s.label}</button>
        {/each}
      </nav>

      <section class="content">
        {#if active === "appearance"}
          <h3>Appearance & Accessibility</h3>
          <div class="row">
            {@render row("Theme", "QuadState is dark-only for now. Light mode may come later.")}
            <div class="seg" aria-label="Theme">
              <button class="seg-btn sel" aria-pressed="true">Dark</button>
              <button class="seg-btn" disabled title="Coming later">Light</button>
            </div>
          </div>
          <div class="row">
            {@render row("Reduce motion", "Minimise transitions and animations across the app.")}
            {@render toggle(settings.reducedMotion, () => setSetting("reducedMotion", !settings.reducedMotion), "Reduce motion")}
          </div>

        {:else if active === "input"}
          <h3>Input & Devices</h3>
          <div class="row">
            {@render row("Mouse wheel", "Scroll to zoom at the cursor, or scroll to pan the canvas.")}
            <div class="seg" aria-label="Mouse wheel behaviour">
              {#each WHEEL_OPTS as o}
                <button class="seg-btn" class:sel={settings.wheelMode === o.value}
                  aria-pressed={settings.wheelMode === o.value}
                  onclick={() => setSetting("wheelMode", o.value)}>{o.label}</button>
              {/each}
            </div>
          </div>
          <div class="row">
            {@render row("Spacebar", "Tap toggles run/pause. Optionally hold Space to pan.")}
            <div class="seg wide" aria-label="Spacebar behaviour">
              {#each SPACE_OPTS as o}
                <button class="seg-btn" class:sel={settings.spaceMode === o.value}
                  aria-pressed={settings.spaceMode === o.value}
                  onclick={() => setSetting("spaceMode", o.value)}>{o.label}</button>
              {/each}
            </div>
          </div>
          <p class="hint">Middle-mouse drag pans the canvas; pinch / Ctrl+wheel zooms. These follow the natural direction.</p>

        {:else if active === "canvas"}
          <h3>Canvas</h3>
          <div class="row">
            {@render row("Show grid dots", "Draw the faint background grid on the canvas.")}
            {@render toggle(settings.showGrid, () => setSetting("showGrid", !settings.showGrid), "Show grid dots")}
          </div>
          <div class="row">
            {@render row("Snap to grid", "Snap parts to the grid when placing and moving them.")}
            {@render toggle(settings.snap, () => setSetting("snap", !settings.snap), "Snap to grid")}
          </div>
          <div class="row">
            {@render row("Default I/O bus width", "Bit-width applied to newly placed IN / OUT pins (1–64).")}
            <input class="num" type="number" min="1" max="64" value={settings.defaultBusWidth}
              onchange={(e) => setSetting("defaultBusWidth", clampInt(e.currentTarget.value, 1, 64, settings.defaultBusWidth))} />
          </div>

        {:else if active === "simulation"}
          <h3>Simulation</h3>
          <div class="row">
            {@render row("Default speed", "Simulation rate a freshly opened circuit starts at.")}
            <div class="speed">
              <input type="range" min="100" max="20000" step="100" value={settings.defaultSpeed}
                oninput={(e) => setSetting("defaultSpeed", Number(e.currentTarget.value))} />
              <span class="speed-val">{settings.defaultSpeed} t/s</span>
            </div>
          </div>
          <div class="row">
            {@render row("Start live on open", "Begin simulating automatically when a circuit opens.")}
            {@render toggle(settings.startLive, () => setSetting("startLive", !settings.startLive), "Start live on open")}
          </div>

        {:else if active === "account"}
          <h3>Account</h3>
          {#if account.status === "signedIn"}
            <div class="acct-card">
              <div class="acct-status"><span class="dot on"></span> Signed in (local profile)</div>
              <div class="acct-row"><span>Name</span><b>{account.name || "—"}</b></div>
              <div class="acct-row"><span>Email</span><b>{account.email || "—"}</b></div>
              <button class="ghost" onclick={signOut}>Sign out</button>
            </div>
          {:else}
            <div class="acct-card">
              <div class="acct-status"><span class="dot"></span> Guest — not signed in</div>
              <p class="hint">Create a local profile so the app can show an identity. Stored on this device only.</p>
              <label class="field"><span>Name</span>
                <input bind:value={nameField} placeholder="Your name" spellcheck="false"
                  onkeydown={(e) => { if (e.key === "Enter") doSignIn(); }} /></label>
              <label class="field"><span>Email</span>
                <input bind:value={emailField} placeholder="you@example.com" type="email" spellcheck="false"
                  onkeydown={(e) => { if (e.key === "Enter") doSignIn(); }} /></label>
              <button class="primary" onclick={doSignIn}>Sign in</button>
            </div>
          {/if}
          <div class="callout">
            <b>Real authentication not implemented.</b>
            <span>{BACKEND_NEEDED}</span>
          </div>

        {:else if active === "about"}
          <h3>About</h3>
          <div class="about">
            <div class="about-name">{APP_NAME}</div>
            <div class="about-tag">A 4-state (0 / 1 / X / Z) digital logic simulator.</div>
            <div class="about-grid">
              <span>Version</span><b>{APP_VERSION}</b>
              <span>Storage</span><b>Local (this device)</b>
              <span>Status</span><b>Prototype</b>
            </div>
            <p class="hint">Settings and projects are stored locally per device. There is no cloud sync yet.</p>
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 24px; }
  .backdrop { position: absolute; inset: 0; background: rgba(5,6,9,0.62); backdrop-filter: blur(2px); border: none; cursor: default; }

  .modal {
    position: relative; width: min(760px, 100%); height: min(560px, 92vh);
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface1); border: 1px solid var(--hairlineStrong);
    border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,0.55);
    animation: pop .16s cubic-bezier(.2,.7,.2,1) both;
  }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.99); } to { opacity: 1; transform: none; } }

  .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--hairline); flex: 0 0 auto; }
  .modal-head h2 { margin: 0; font-size: 16px; font-weight: 600; color: var(--text1); letter-spacing: -0.01em; }
  .close { width: 30px; height: 30px; border-radius: 8px; background: none; border: none; color: var(--text3); font-size: 22px; line-height: 1; cursor: pointer; }
  .close:hover { background: var(--surface2); color: var(--text1); }

  .modal-body { display: flex; flex: 1 1 auto; min-height: 0; }

  .nav { width: 216px; flex: 0 0 auto; padding: 12px 10px; border-right: 1px solid var(--hairline); display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
  .nav-item { text-align: left; background: none; border: none; border-radius: 8px; padding: 9px 11px; font: inherit; font-size: 13px; color: var(--text2); cursor: pointer; }
  .nav-item:hover { background: var(--surface2); color: var(--text1); }
  .nav-item.active { background: var(--accentQuiet); color: var(--text1); box-shadow: inset 2px 0 0 var(--accent); }

  .content { flex: 1 1 auto; min-width: 0; overflow-y: auto; padding: 18px 22px 26px; }
  .content h3 { margin: 2px 0 14px; font-size: 14px; font-weight: 600; color: var(--text1); }

  .row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--hairline); }
  .row-text { flex: 1; min-width: 0; }
  .row-label { font-size: 13px; font-weight: 500; color: var(--text1); }
  .row-desc { font-size: 12px; color: var(--text3); margin-top: 3px; line-height: 1.45; }

  /* Pill switch — neutral off, accent on (a setting being "on" is a selection). */
  .switch { flex: 0 0 auto; width: 40px; height: 23px; border-radius: 999px; background: var(--surface3); border: 1px solid var(--hairline); padding: 0; cursor: pointer; position: relative; transition: background .14s ease, border-color .14s ease; }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: var(--text2); transition: transform .14s ease, background .14s ease; }
  .switch.on { background: var(--accent); border-color: var(--accent); }
  .switch.on .knob { transform: translateX(17px); background: #fff; }
  .switch:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accentQuiet); }

  /* Segmented control — accent marks the current choice (selection). */
  .seg { flex: 0 0 auto; display: inline-flex; background: var(--surface2); border: 1px solid var(--hairline); border-radius: 9px; padding: 2px; gap: 2px; }
  .seg.wide { flex-wrap: wrap; max-width: 320px; }
  .seg-btn { background: none; border: none; border-radius: 7px; padding: 6px 12px; font: inherit; font-size: 12px; color: var(--text2); cursor: pointer; white-space: nowrap; }
  .seg-btn:hover:not(:disabled):not(.sel) { color: var(--text1); }
  .seg-btn.sel { background: var(--accentQuiet); color: var(--text1); box-shadow: inset 0 0 0 1px var(--accent); }
  .seg-btn:disabled { color: var(--text3); opacity: 0.55; cursor: default; }

  .num { width: 76px; background: var(--surface2); color: var(--text1); border: 1px solid var(--hairline); border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px; font-family: ui-monospace, monospace; }
  .num:focus { outline: none; border-color: var(--accent); }

  .speed { display: flex; align-items: center; gap: 10px; }
  .speed input { width: 160px; }
  .speed-val { font-size: 12px; color: var(--text3); font-family: ui-monospace, monospace; min-width: 64px; text-align: right; }

  .hint { font-size: 12px; color: var(--text3); line-height: 1.5; margin: 12px 0 0; }

  /* Account */
  .acct-card { background: var(--surface2); border: 1px solid var(--hairline); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .acct-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text1); font-weight: 500; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text3); }
  .dot.on { background: var(--sig1); }
  .acct-row { display: flex; align-items: baseline; gap: 12px; font-size: 13px; }
  .acct-row span { width: 56px; flex: 0 0 auto; color: var(--text3); font-size: 12px; }
  .acct-row b { color: var(--text1); font-weight: 500; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field span { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: var(--text3); text-transform: uppercase; }
  .field input { background: var(--surface1); color: var(--text1); border: 1px solid var(--hairline); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; }
  .field input::placeholder { color: var(--text3); }
  .field input:focus { outline: none; border-color: var(--accent); }
  .ghost, .primary { align-self: flex-start; border-radius: 8px; padding: 8px 16px; font: inherit; font-size: 13px; cursor: pointer; }
  .ghost { background: var(--surface1); color: var(--text2); border: 1px solid var(--hairline); }
  .ghost:hover { background: var(--surface3); color: var(--text1); }
  .primary { background: var(--accent); color: #fff; border: 1px solid var(--accent); font-weight: 600; }
  .primary:hover { background: var(--accentHover); }

  .callout { margin-top: 16px; display: flex; flex-direction: column; gap: 4px; background: var(--surface2); border: 1px solid var(--hairline); border-left: 2px solid var(--hairlineStrong); border-radius: 10px; padding: 12px 14px; }
  .callout b { font-size: 13px; color: var(--text1); }
  .callout span { font-size: 12px; color: var(--text3); line-height: 1.5; }

  /* About */
  .about-name { font-size: 20px; font-weight: 700; color: var(--text1); letter-spacing: -0.02em; }
  .about-tag { font-size: 13px; color: var(--text2); margin-top: 4px; }
  .about-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; margin: 18px 0 0; font-size: 13px; }
  .about-grid span { color: var(--text3); }
  .about-grid b { color: var(--text1); font-weight: 500; font-family: ui-monospace, monospace; }

  :global([data-reduced-motion="1"]) .modal { animation: none; }
</style>

<script lang="ts">
  import {
    account, signInWithOAuth, signInWithMagicLink, signOut, initials, ACCOUNT_ENABLED,
  } from "./account.svelte.js";

  let { onOpenSettings, size = 34 }: {
    /** Open the Settings overlay, optionally at a given section. */
    onOpenSettings: (section?: "account") => void;
    /** Trigger-avatar diameter in px (opt-in; the in-menu avatar stays 34). */
    size?: number;
  } = $props();

  let open = $state(false);
  let mode = $state<"menu" | "email">("menu");
  let emailField = $state("");
  let sent = $state(false);
  let busy = $state(false);
  let err = $state("");

  function toggle() {
    open = !open;
    if (open) { mode = "menu"; sent = false; err = ""; }
  }
  function close() { open = false; mode = "menu"; }

  async function oauth(provider: "google" | "github") {
    busy = true; err = "";
    const { error } = await signInWithOAuth(provider);
    busy = false;
    if (error) err = error; // success redirects away, so we only land here on error
  }
  async function sendMagicLink() {
    const email = emailField.trim();
    if (!email) return;
    busy = true; err = "";
    const { error } = await signInWithMagicLink(email);
    busy = false;
    if (error) err = error; else sent = true;
  }
  async function doSignOut() { await signOut(); close(); }
  function openSettings(section?: "account") { close(); onOpenSettings(section); }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) { close(); e.stopPropagation(); }
  }
  function autofocus(node: HTMLInputElement) { node.focus(); }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="account" class:open>
  <button
    class="avatar"
    class:signed={account.status === "signedIn"}
    style="--avatar:{size}px"
    aria-haspopup="menu"
    aria-expanded={open}
    title={account.status === "signedIn" ? (account.name || account.email) : "Account"}
    onclick={toggle}
  >
    {#if account.status === "signedIn"}
      {#if account.avatarUrl}
        <img class="avatar-img" src={account.avatarUrl} alt="" referrerpolicy="no-referrer" />
      {:else}
        <span class="initials">{initials()}</span>
      {/if}
    {:else}
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="10" cy="7" r="3.2" />
        <path d="M4 16.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" stroke-linecap="round" />
      </svg>
    {/if}
  </button>

  {#if open}
    <!-- Click-catcher closes the menu when clicking elsewhere. -->
    <button class="scrim" aria-label="Close account menu" onclick={close}></button>

    <div class="panel" role="menu">
      {#if mode === "menu"}
        <div class="who">
          <span class="who-avatar" class:signed={account.status === "signedIn"}>
            {#if account.status === "signedIn"}
              {#if account.avatarUrl}<img class="avatar-img" src={account.avatarUrl} alt="" referrerpolicy="no-referrer" />{:else}{initials()}{/if}
            {:else}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="7" r="3.2" /><path d="M4 16.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" stroke-linecap="round" /></svg>{/if}
          </span>
          <span class="who-text">
            {#if account.status === "signedIn"}
              <span class="who-name">{account.name || "Signed in"}</span>
              {#if account.email}<span class="who-sub">{account.email}</span>{/if}
            {:else}
              <span class="who-name">Guest</span>
              <span class="who-sub">Not signed in</span>
            {/if}
          </span>
        </div>

        <div class="divider"></div>

        {#if account.status === "signedIn"}
          <div class="items">
            <button class="item" role="menuitem" onclick={() => openSettings("account")}>Manage account</button>
            <button class="item" role="menuitem" onclick={() => openSettings()}>Settings</button>
            <button class="item" role="menuitem" onclick={doSignOut}>Sign out</button>
          </div>
        {:else if ACCOUNT_ENABLED}
          <div class="providers">
            <!-- Monochrome marks: chrome stays neutral (visual-system rule). -->
            <button class="provider" disabled={busy} onclick={() => oauth("google")}>
              <svg class="prov-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20.5 12.2c0 4.8-3.5 8.1-8.6 8.1a8.3 8.3 0 1 1 5.4-14.6"/><path d="M20.5 12.2H12.4"/></svg>
              Continue with Google
            </button>
            <button class="provider" disabled={busy} onclick={() => oauth("github")}>
              <svg class="prov-ico" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
              Continue with GitHub
            </button>
            <button class="provider" disabled={busy} onclick={() => { mode = "email"; err = ""; }}>
              <svg class="prov-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></svg>
              Email me a link
            </button>
          </div>
          {#if err}<p class="err">{err}</p>{/if}
          <div class="divider"></div>
          <div class="items">
            <button class="item" role="menuitem" onclick={() => openSettings()}>Settings</button>
          </div>
        {:else}
          <p class="note">Cloud sign-in isn’t configured for this build. Projects are saved on this device.</p>
          <div class="divider"></div>
          <div class="items">
            <button class="item" role="menuitem" onclick={() => openSettings()}>Settings</button>
          </div>
        {/if}
      {:else}
        <div class="signin">
          {#if sent}
            <div class="signin-head">Check your inbox</div>
            <p class="note">We emailed a sign-in link to <b>{emailField.trim()}</b>. Open it on this device to finish signing in.</p>
            <div class="signin-actions">
              <button class="primary" onclick={close}>Done</button>
            </div>
          {:else}
            <div class="signin-head">Email me a sign-in link</div>
            <p class="note">No password — we’ll email you a one-time magic link.</p>
            <label class="field">
              <span>Email</span>
              <input use:autofocus bind:value={emailField} placeholder="you@example.com" type="email" spellcheck="false"
                onkeydown={(e) => { if (e.key === "Enter") sendMagicLink(); }} />
            </label>
            {#if err}<p class="err">{err}</p>{/if}
            <div class="signin-actions">
              <button class="ghost" onclick={() => { mode = "menu"; err = ""; }}>Back</button>
              <button class="primary" disabled={busy || !emailField.trim()} onclick={sendMagicLink}>Send link</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .account { position: relative; display: flex; }

  .avatar {
    width: var(--avatar, 34px); height: var(--avatar, 34px); border-radius: 50%;
    display: grid; place-items: center; padding: 0; overflow: hidden;
    background: var(--surface2); color: var(--text2);
    border: 1px solid var(--hairline); cursor: pointer;
    transition: background .14s ease, color .14s ease, border-color .14s ease;
  }
  .avatar:hover { background: var(--surface3); color: var(--text1); border-color: var(--hairlineStrong); }
  .avatar:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accentQuiet); }
  .account.open .avatar { border-color: var(--hairlineStrong); color: var(--text1); }
  .avatar svg { width: calc(var(--avatar, 34px) * 0.56); height: calc(var(--avatar, 34px) * 0.56); }
  .avatar.signed { color: var(--text1); }
  .avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .initials { font-size: calc(var(--avatar, 34px) * 0.35); font-weight: 600; letter-spacing: 0.02em; font-family: ui-monospace, monospace; }

  .scrim { position: fixed; inset: 0; z-index: 40; background: none; border: none; cursor: default; }

  .panel {
    position: absolute; top: calc(100% + 8px); right: 0; z-index: 41;
    width: 256px; padding: 8px;
    background: var(--surface1); border: 1px solid var(--hairlineStrong);
    border-radius: 12px; box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    animation: drop .14s ease both;
  }
  @keyframes drop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

  .who { display: flex; align-items: center; gap: 10px; padding: 6px 6px 8px; }
  .who-avatar {
    width: 34px; height: 34px; flex: 0 0 auto; border-radius: 50%; overflow: hidden;
    display: grid; place-items: center; background: var(--surface2);
    border: 1px solid var(--hairline); color: var(--text2);
    font-size: 12px; font-weight: 600; font-family: ui-monospace, monospace;
  }
  .who-avatar.signed { color: var(--text1); }
  .who-avatar svg { width: 19px; height: 19px; }
  .who-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .who-name { font-size: 14px; font-weight: 600; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who-sub { font-size: 12px; color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .divider { height: 1px; background: var(--hairline); margin: 4px 0; }

  .items { display: flex; flex-direction: column; gap: 1px; }
  .item {
    text-align: left; background: none; border: none; border-radius: 8px;
    padding: 8px 10px; font: inherit; font-size: 13px; color: var(--text2); cursor: pointer;
  }
  .item:hover { background: var(--surface2); color: var(--text1); }
  .item:focus-visible { outline: none; background: var(--surface2); color: var(--text1); box-shadow: 0 0 0 1px var(--accent) inset; }

  .note { margin: 4px 6px 2px; font-size: 11.5px; line-height: 1.45; color: var(--text3); }
  .note b { color: var(--text2); font-weight: 600; }
  .err { margin: 6px 6px 2px; font-size: 11.5px; line-height: 1.4; color: var(--text1); }

  /* Provider sign-in buttons — neutral, full-width. */
  .providers { display: flex; flex-direction: column; gap: 6px; padding: 2px; }
  .provider {
    display: flex; align-items: center; gap: 10px; width: 100%;
    background: var(--surface2); color: var(--text1); border: 1px solid var(--hairline);
    border-radius: 9px; padding: 9px 12px; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
    transition: background .14s ease, border-color .14s ease;
  }
  .provider:hover:not(:disabled) { background: var(--surface3); border-color: var(--hairlineStrong); }
  .provider:disabled { opacity: 0.55; cursor: default; }
  .prov-ico { width: 17px; height: 17px; flex: 0 0 auto; color: var(--text2); }

  .signin { padding: 4px; }
  .signin-head { font-size: 14px; font-weight: 600; color: var(--text1); padding: 4px 4px 0; }
  .field { display: flex; flex-direction: column; gap: 4px; margin: 10px 4px 0; }
  .field span { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: var(--text3); text-transform: uppercase; }
  .field input {
    background: var(--surface2); color: var(--text1); border: 1px solid var(--hairline);
    border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px;
  }
  .field input::placeholder { color: var(--text3); }
  .field input:focus { outline: none; border-color: var(--accent); }
  .signin-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 12px 4px 4px; }
  .ghost, .primary {
    border-radius: 8px; padding: 6px 14px; font: inherit; font-size: 13px; cursor: pointer;
    border: 1px solid var(--hairline);
  }
  .ghost { background: var(--surface2); color: var(--text2); }
  .ghost:hover { background: var(--surface3); color: var(--text1); }
  .primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .primary:hover:not(:disabled) { background: var(--accentHover); }
  .primary:disabled { opacity: 0.5; cursor: default; }

  :global([data-reduced-motion="1"]) .panel { animation: none; }
</style>

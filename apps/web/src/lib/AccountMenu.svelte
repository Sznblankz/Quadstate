<script lang="ts">
  import { account, signIn, signOut, initials, ACCOUNT_IS_MOCK } from "./account.svelte.js";

  let { onOpenSettings, size = 34 }: {
    /** Open the Settings overlay, optionally at a given section. */
    onOpenSettings: (section?: "account") => void;
    /** Trigger-avatar diameter in px (opt-in; the in-menu avatar stays 34). */
    size?: number;
  } = $props();

  let open = $state(false);
  let mode = $state<"menu" | "signin">("menu");
  let nameField = $state("");
  let emailField = $state("");

  function toggle() {
    open = !open;
    if (open) mode = "menu";
  }
  function close() { open = false; mode = "menu"; }

  function startSignIn() {
    mode = "signin";
    nameField = account.name;
    emailField = account.email;
  }
  function submitSignIn() {
    if (!nameField.trim() && !emailField.trim()) return;
    signIn(nameField, emailField);
    close();
  }
  function doSignOut() { signOut(); close(); }
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
      <span class="initials">{initials()}</span>
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
            {#if account.status === "signedIn"}{initials()}{:else}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="7" r="3.2" /><path d="M4 16.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" stroke-linecap="round" /></svg>{/if}
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

        <div class="items">
          {#if account.status === "signedIn"}
            <button class="item" role="menuitem" onclick={() => openSettings("account")}>Manage account</button>
            <button class="item" role="menuitem" onclick={doSignOut}>Sign out</button>
          {:else}
            <button class="item" role="menuitem" onclick={startSignIn}>Sign in</button>
          {/if}
          <button class="item" role="menuitem" onclick={() => openSettings()}>Settings</button>
        </div>

        {#if ACCOUNT_IS_MOCK}
          <div class="divider"></div>
          <p class="note">Local profile only — no cloud sync yet.</p>
        {/if}
      {:else}
        <div class="signin">
          <div class="signin-head">Create a local profile</div>
          <p class="note">Stored on this device only. Not real authentication.</p>
          <label class="field">
            <span>Name</span>
            <input use:autofocus bind:value={nameField} placeholder="Your name" spellcheck="false"
              onkeydown={(e) => { if (e.key === "Enter") submitSignIn(); }} />
          </label>
          <label class="field">
            <span>Email</span>
            <input bind:value={emailField} placeholder="you@example.com" spellcheck="false" type="email"
              onkeydown={(e) => { if (e.key === "Enter") submitSignIn(); }} />
          </label>
          <div class="signin-actions">
            <button class="ghost" onclick={() => (mode = "menu")}>Cancel</button>
            <button class="primary" onclick={submitSignIn}>Sign in</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .account { position: relative; display: flex; }

  .avatar {
    width: var(--avatar, 34px); height: var(--avatar, 34px); border-radius: 50%;
    display: grid; place-items: center; padding: 0;
    background: var(--surface2); color: var(--text2);
    border: 1px solid var(--hairline); cursor: pointer;
    transition: background .14s ease, color .14s ease, border-color .14s ease;
  }
  .avatar:hover { background: var(--surface3); color: var(--text1); border-color: var(--hairlineStrong); }
  .avatar:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accentQuiet); }
  .account.open .avatar { border-color: var(--hairlineStrong); color: var(--text1); }
  .avatar svg { width: calc(var(--avatar, 34px) * 0.56); height: calc(var(--avatar, 34px) * 0.56); }
  .avatar.signed { color: var(--text1); }
  .initials { font-size: calc(var(--avatar, 34px) * 0.35); font-weight: 600; letter-spacing: 0.02em; font-family: ui-monospace, monospace; }

  .scrim { position: fixed; inset: 0; z-index: 40; background: none; border: none; cursor: default; }

  .panel {
    position: absolute; top: calc(100% + 8px); right: 0; z-index: 41;
    width: 248px; padding: 8px;
    background: var(--surface1); border: 1px solid var(--hairlineStrong);
    border-radius: 12px; box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    animation: drop .14s ease both;
  }
  @keyframes drop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

  .who { display: flex; align-items: center; gap: 10px; padding: 6px 6px 8px; }
  .who-avatar {
    width: 34px; height: 34px; flex: 0 0 auto; border-radius: 50%;
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

  .note { margin: 4px 6px 2px; font-size: 11px; line-height: 1.45; color: var(--text3); }

  .signin { padding: 4px; }
  .signin-head { font-size: 14px; font-weight: 600; color: var(--text1); padding: 4px 4px 0; }
  .field { display: flex; flex-direction: column; gap: 4px; margin: 8px 4px 0; }
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
  .primary:hover { background: var(--accentHover); }

  :global([data-reduced-motion="1"]) .panel { animation: none; }
</style>

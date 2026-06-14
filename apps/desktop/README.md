# LogicSim desktop (Tauri shell)

Wraps the **identical** web bundle (`apps/web`) in a Tauri 2 window — no
forked code, which is a determinism prerequisite. The shell contributes
only the window and the `dialog`/`fs` plugins that the runtime-detected
storage adapter calls through `window.__TAURI__.core.invoke`.

## Prerequisites (not yet installed on this machine)

1. Rust toolchain: <https://rustup.rs> (`rustup default stable`)
2. WebView2 runtime (preinstalled on Windows 11)
3. Icons: replace the placeholders in `src-tauri/icons/` (generate a set
   from a 1024px PNG with `pnpm --filter @logicsim/desktop tauri icon path/to/icon.png`)

## Run

```
pnpm install
pnpm --filter @logicsim/desktop dev     # dev window against the Vite server
pnpm --filter @logicsim/desktop build   # production bundle from apps/web/dist
```

## Verification checklist (once Rust is available)

- App opens, circuit editing works identically to the browser.
- Save/Open use native dialogs (status bar shows "saved (tauri)").
- Determinism smoke: in the dev console run
  `await __logicsim.runSmoke()` and compare with `SMOKE_DIGEST` in
  `packages/engine/src/smoke.ts` — must match exactly.

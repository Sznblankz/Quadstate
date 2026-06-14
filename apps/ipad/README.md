# LogicSim iPad (Capacitor shell)

Wraps the **identical** web bundle (`apps/web`) in WKWebView. The storage
adapter detects the Capacitor bridge at runtime and uses the Filesystem
plugin (+ share sheet on save); no shell-specific code exists in the web
bundle.

## Building (requires macOS + Xcode — cannot run on this Windows machine)

```
pnpm install
pnpm --filter @logicsim/ipad exec cap add ios   # once, generates ios/
pnpm --filter @logicsim/ipad sync               # build web + copy into ios/
pnpm --filter @logicsim/ipad open               # open in Xcode, run on iPad
```

## Apple Pencil notes

WKWebView delivers Pencil input as W3C pointer events with
`pointerType: "pen"`, `pressure`, and `tiltX/Y` — the gesture recognizer's
pen policy (pen draws, simultaneous touch pans, palm-on-entity demoted to
pan) needs no shell code. `touch-action: none` and pointer capture are
already set by the canvas host.

## On-device verification checklist (plan M5)

- [ ] Pencil draws ink with visible pressure variation; finger pans while
      the Pencil is down; a resting palm does not select or drag.
- [ ] Pencil hover (M2 iPads) moves the cursor without drawing.
- [ ] Two-finger pinch zooms around the gesture midpoint.
- [ ] Save writes `circuit.logicsim.json` to Documents and offers the
      share sheet; Open restores the project including My Chips.
- [ ] Determinism smoke: in Safari Web Inspector run
      `await __logicsim.runSmoke()` — must equal `SMOKE_DIGEST` in
      `packages/engine/src/smoke.ts` (this is the JavaScriptCore leg of
      the cross-platform gate).

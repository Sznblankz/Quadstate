# QuadState

A 4-state (0/1/X/Z) digital logic simulator. pnpm monorepo; the shipping app
is `apps/web` (Svelte 5 + Vite, layered Canvas2D renderer, TS engine in a Web
Worker). Internal package names are `@logicsim/*` and the dev global is
`window.__logicsim` (intentionally kept — renaming them is not worth the churn).

## Layout

| Path | Role |
|---|---|
| `packages/engine` | Delta-cycle 0/1/X/Z simulator (deterministic). No DOM/Node deps. |
| `packages/schema` | Part schema, validation, content-hash ids, elaboration → netlist. |
| `packages/document` | Circuit document, invertible commands + undo, chip extraction, project files. |
| `packages/canvas` | Viewport, spatial grid, gesture recognizer, tools, 4-layer Canvas2D renderer. |
| `apps/web` | The Svelte 5 app + engine worker + storage adapters. This is what deploys. |
| `apps/desktop` / `apps/ipad` | Tauri / Capacitor shells (not part of the web deploy). |

## Commands

```
pnpm install
pnpm -r typecheck
pnpm -r test                       # 111 tests across the packages
pnpm --filter @logicsim/web dev    # app on :5173
pnpm --filter @logicsim/web build  # production build (Vercel runs this)
```

## Deployment — push after changes

This repo's `origin` is https://github.com/Sznblankz/Quadstate and is connected
to Vercel.

- **After making changes, commit and push to GitHub (`git push` to `main`).**
- **Pushing to `main` auto-deploys to Vercel** — there is no separate deploy
  step; the push is the deploy.
- Before pushing, make sure it builds and typechecks (`pnpm -r typecheck`,
  `pnpm --filter @logicsim/web build`) so the Vercel build doesn't fail.

## Conventions

- Keep the QuadState dark visual system: dark chrome, indigo/purple accent
  (`#6C72FF`) for focus/selection only, and the 4-state signal colors
  (0/1/X/Z) reserved for actual circuit state — never in chrome.
- Tokens live in `packages/canvas/src/tokens.ts` and are mirrored to CSS vars;
  don't hard-code colors in components.

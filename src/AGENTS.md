# AGENTS.md

## Scope

- Applies only to `src/` (renderer/web UI, hooks, services, types).

## Source-of-truth commands (web/renderer)

- `yarn dev` (source: `package.json` scripts)
- `yarn build` (source: `package.json` scripts)
- `yarn preview` (source: `package.json` scripts)

## High-risk boundaries

- Renderer must use the preload API (`window.electronAPI`) for desktop features; do not import `electron` or Node APIs directly in `src/` (source: `electron/preload.ts`).
- If the preload API shape changes, update renderer typings in `src/types/electron.d.ts` (source: file exists).
- Environment variables are injected via Vite `define` in `vite.config.ts`; avoid relying on runtime `process.env` in the browser.

## Minimal verification

- `yarn dev` for UI/logic changes.
- If build or Vite config is touched: `yarn build` (optionally `yarn preview`).

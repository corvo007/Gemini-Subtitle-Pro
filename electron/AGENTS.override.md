# AGENTS.override.md

## Scope

- Applies only to `electron/` (main process, preload, and desktop-only services).

## Source-of-truth commands (desktop-only)

- `yarn electron:dev` (source: `package.json` scripts)
- `yarn build:main` (source: `package.json` scripts)
- `yarn electron:build` (source: `package.json` scripts)

## High-risk boundaries

- Keep `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` in `BrowserWindow` unless explicitly approved (source: `electron/main.ts`).
- Preload entrypoint is built to `dist-electron/preload.cjs` from `electron/preload.ts` (source: `vite.config.electron.ts`); keep build config and runtime path in sync.
- IPC contract lives in `electron/preload.ts` (`contextBridge.exposeInMainWorld`) and `electron/main.ts` (`ipcMain.handle/on`); update both together.
- `open-external` is allowlisted in `electron/main.ts`; do not widen hosts without explicit review.
- `local-video` protocol and navigation restrictions are enforced in `electron/main.ts`; avoid relaxing without security review.

## Minimal verification

- `yarn electron:dev` for most changes.
- If touching build/entry/bundling: `yarn build:main` (optionally `yarn electron:build` for packaging).

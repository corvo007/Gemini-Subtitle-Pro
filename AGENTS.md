# AGENTS.md

## A. Working Agreement（严格）

- 先计划后执行：任何改动前先给 2–6 条计划步骤，待确认后再动手。
- 最小改动：只改与任务直接相关的文件/行，避免“顺手重构”。
- 可复现验证：每次改动后给出最小可运行的验证命令，且说明来源。
- 歧义默认策略：不确定就先指向“如何找到真相”的文件/命令，不凭空猜测；优先读取 `README.md`、`docs/ARCHITECTURE_zh.md`、`package.json`、`vite.config*.ts`。
- 报告规范：输出改动摘要、影响面、验证命令与未验证原因（如适用）。

## B. Repo Topology（双栈）

- 这是单仓库双栈（Web + Desktop），不是 monorepo（无 `apps/`/`packages/` 结构）。来源：仓库根目录结构、`docs/ARCHITECTURE_zh.md`。
- Web 入口：`src/index.tsx`、`src/App.tsx`、`index.html`、`vite.config.ts`。来源：`docs/ARCHITECTURE_zh.md`、`vite.config.ts`。
- Desktop 入口：`electron/main.ts`（主进程）、`electron/preload.ts`（预加载）、构建入口见 `vite.config.electron.ts`。来源：`docs/ARCHITECTURE_zh.md`、`vite.config.electron.ts`。
- 关键目录建议优先阅读：
  - Web：`src/`（UI、hooks、services、types、workers）。来源：`docs/ARCHITECTURE_zh.md`。
  - Desktop：`electron/`（main、preload、services）。来源：`docs/ARCHITECTURE_zh.md`。
  - 构建与配置：`package.json`、`vite.config.ts`、`vite.config.electron.ts`、`tsconfig.json`。来源：对应文件。

## C. Electron 安全与进程边界

- 进程边界：主进程在 `electron/main.ts`，预加载在 `electron/preload.ts`，渲染进程为 `src/`。来源：`docs/ARCHITECTURE_zh.md`。
- 安全基线（必须保持）：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，并通过 preload 暴露最小 API。来源：`electron/main.ts`（BrowserWindow webPreferences）。
- IPC 契约位置：`electron/preload.ts`（`contextBridge.exposeInMainWorld`）与 `electron/main.ts`（`ipcMain.handle/on`）。来源：对应文件。
- 新增 IPC 规范：
  - 命名：`feature:action` 风格（如 `video:compress`），与现有命名保持一致。来源：`electron/main.ts`、`electron/preload.ts`。
  - Payload：明确类型与字段，必要时在 `src/types/` 定义并复用。来源：`src/types/`、`electron/main.ts`。
  - 校验：主进程必须做参数校验与异常保护；仅白名单域名可 `openExternal`。来源：`electron/main.ts`（open-external allowlist）。

## D. Toolchain & Package Manager

- 包管理器：使用 Yarn（存在 `yarn.lock`）。来源：`yarn.lock`。
- Node 版本来源：`README.md` 指定 Node.js 18+；未发现 `.nvmrc` 或 `.tool-versions`。来源：`README.md`、仓库根目录。
- Lockfile 政策：只在依赖变更时更新 `yarn.lock`，不要生成/修改 `package-lock.json`。来源：`yarn.lock`、`.gitignore`（忽略 `package-lock.json`）。

## E. Source-of-truth Commands

> 仅列出仓库已定义脚本；未定义的命令请先在 `package.json` 中确认或补充。

- Install：`yarn install`（或 `npm install`）。来源：`README.md`。
- Dev (Web)：`yarn dev`。来源：`package.json` scripts。
- Dev (Desktop)：`yarn electron:dev`。来源：`package.json` scripts。
- Build (Web)：`yarn build`。来源：`package.json` scripts。
- Build (Desktop)：`yarn build:main` + `yarn electron:build`。来源：`package.json` scripts。
- Build (Debug Desktop)：`yarn build:debug`。来源：`package.json` scripts。
- Preview：`yarn preview`。来源：`package.json` scripts。
- i18n：`yarn i18n:extract`。来源：`package.json` scripts。
- Lint / Typecheck / Test / E2E：未在 `package.json` scripts 中定义；若需要请先补充脚本或在 `package.json` 中搜索。来源：`package.json`。

## F. Cross-stack Consistency Rules

- 共享逻辑优先放在 `src/services/`、`src/types/`、`src/config/`，仅 Desktop 专用逻辑放在 `electron/services/`。来源：`docs/ARCHITECTURE_zh.md`。
- 环境变量：`GEMINI_API_KEY`、`OPENAI_API_KEY` 用于 Web 与 Desktop；Web 侧由 Vite define 注入。来源：`README.md`、`vite.config.ts`。
- 变更影响面判断：
  - 只改 Web：仅触及 `src/`、`vite.config.ts`、`index.html`。
  - 只改 Desktop：仅触及 `electron/`、`vite.config.electron.ts`、打包配置（`package.json` build）。
  - 双端都要改：涉及 API 契约（IPC）、共享 types/config/services 或环境变量读取逻辑。来源：`docs/ARCHITECTURE_zh.md`、`electron/preload.ts`。

## G. Change Boundaries

- 允许改动：`src/`、`electron/`、`scripts/`、`docs/`、根目录配置文件（如 `package.json`、`vite.config*.ts`、`tsconfig.json`）。来源：仓库结构。
- 构建/生成产物（禁止手改）：`dist/`、`dist-electron/`、`release/`。来源：仓库目录结构、`package.json` build。
- 依赖目录（只读）：`node_modules/`。来源：仓库目录结构。
- 敏感/二进制资源（慎改/禁止触碰）：`resources/` 中的 `.exe`/`.dll`/模型文件。来源：仓库结构、`package.json` build 资源配置。
- 环境配置：`.env`/`.env.local` 仅按需读取，不提交敏感内容。来源：仓库根目录文件。

## H. Handling ignored/large dirs

- 默认遵循 `.gitignore`（如 `dist/`、`dist-electron/`、`release/`、`node_modules/`）。来源：`.gitignore`。
- 只有在必须时，才对忽略目录做只读检索：
  - `rg --no-ignore --hidden <pattern>`
  - `rg --files --no-ignore --hidden`
  - `Get-ChildItem -Force`

## I. Definition of Done（验收）

- UI 改动（Web）：
  - 最小验证：`yarn dev`。
  - 人工检查：页面渲染、交互、国际化文案是否正常。
  - 来源：`package.json` scripts。
- IPC 改动（preload/IPC）：
  - 最小验证：`yarn electron:dev`。
  - 人工检查：调用链 `preload -> ipcMain` 是否一致、返回值/错误处理是否正确。
  - 来源：`package.json` scripts、`electron/preload.ts`。
- 主进程改动（Electron main）：
  - 最小验证：`yarn electron:dev`；如涉及打包资源，跑 `yarn build:main`。
  - 人工检查：窗口创建、菜单、协议/拦截是否正常。
  - 来源：`package.json` scripts、`electron/main.ts`。
- 构建配置改动（Vite/Electron Builder）：
  - 最小验证：`yarn build`（Web）/ `yarn electron:build`（Desktop）。
  - 人工检查：输出目录 `dist/`、`dist-electron/`、`release/` 是否符合预期。
  - 来源：`package.json` scripts、`vite.config*.ts`。

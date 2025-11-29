<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Gemini Subtitle Pro

**Gemini Subtitle Pro** 是一款基于 AI 的字幕创建、翻译和润色工具。它利用 Google 的 Gemini 模型进行高质量的翻译和校对，并使用 OpenAI 的 Whisper 进行精准的语音转写。

## ✨ 功能特性

### 核心 AI 功能
- **🤖 AI 转写**: 使用 OpenAI Whisper (通过 API) 转写视频/音频
- **🌍 智能翻译**: 使用 Gemini 2.5 Flash 将字幕翻译为简体中文
- **🧐 深度校对**: 使用 Gemini 2.5 Flash 或 Gemini 3.0 Pro 润色和校正字幕，确保措辞自然准确
- **🎯 智能分割**: 使用 Silero VAD 进行智能音频分割，优化字幕时间轴

### 术语管理
- **📚 自定义术语表**: 维护项目特定的术语和翻译
- **🔄 AI 生成术语**: 从源内容自动生成术语建议
- **📤 导入/导出**: 轻松分享和备份您的术语表
- **🛡️ 强大的重试机制**: 内置术语提取重试逻辑，防止瞬时错误导致数据丢失

### 性能优化
- **⚡ VAD Worker**: 将音频处理移至后台线程，确保 UI 流畅
- **🚀 自定义 API 端点**: 支持配置自定义 OpenAI 和 Gemini API 端点 (Base URL)
- **⏱️ 请求超时配置**: 可自定义 API 请求超时时间，适应不同网络环境

### 批量操作
- **⏱️ 修复时间轴**: 使用 AI 自动对齐字幕时间轴与音频
- **✏️ 润色**: 结合上下文对选中片段进行批量润色

### 工作流功能
- **📸 版本控制**: 内置快照系统，可保存和恢复不同版本的工作
- **📂 双模式**: 支持从头开始 (新建项目) 或编辑现有文件 (导入模式)
- **💾 双语导出**: 下载 SRT 或 ASS 格式字幕 (双语或仅目标语言)
- **🐛 调试日志**: 具有可配置详细级别的综合日志系统，便于故障排查

## 🛠️ 技术栈

- **前端**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **样式**: Vanilla CSS 配合现代设计模式
- **AI 集成**:
    - [Google GenAI SDK](https://www.npmjs.com/package/@google/genai) (Gemini 2.5 Flash, Gemini 3.0 Pro)
    - [OpenAI API](https://www.npmjs.com/package/openai) (Whisper-1)
- **音频处理**:
    - [@ricky0123/vad-web](https://www.npmjs.com/package/@ricky0123/vad-web) (Silero VAD 用于智能分割)
    - [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) (ML 模型运行时)
- **图标**: [Lucide React](https://lucide.dev/)

## 🚀 本地运行

**前提条件:** Node.js 18+

1. **安装依赖:**
   ```bash
   npm install
   # 或
   yarn install
   ```

2. **配置环境:**
   在根目录创建一个 `.env.local` 文件并添加您的 API 密钥：
   ```bash
   cp .env.example .env.local
   ```
   编辑 `.env.local`:
   ```env
   # 翻译和校对需要
   GEMINI_API_KEY=your_gemini_key

   # 转写 (Whisper) 需要
   OPENAI_API_KEY=your_openai_key
   ```

3. **运行应用:**
   ```bash
   npm run dev
   # 或
   yarn dev
   ```

## ⚙️ 配置说明

在应用设置中，您可以配置以下高级选项：

- **API 端点**:
  - `OpenAI Endpoint`: 自定义 OpenAI API 的 Base URL (例如用于代理)
  - `Gemini Endpoint`: 自定义 Google Gemini API 的 Base URL
- **请求超时**: 设置 API 请求的超时时间 (默认 600 秒)，以解决网络较慢时的超时问题
- **术语表设置**: 启用/禁用自动术语提取，设置采样时长等

## ☁️ 部署

您可以将此应用程序部署到各种 Serverless 平台。

### Vercel

最简单的部署方式是使用 Vercel。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcorvo007%2Fgemini-subtitle-pro&env=GEMINI_API_KEY,OPENAI_API_KEY)

1. 点击上方按钮。
2. 连接您的 GitHub 仓库。
3. Vercel 将自动检测 Vite 配置。
4. **重要:** 在 Environment Variables 部分添加 `GEMINI_API_KEY` 和 `OPENAI_API_KEY`。

### Google Cloud Run

作为容器化应用程序部署在 Google Cloud Run 上。

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run)

1. 点击上方按钮。
2. 选择您的项目和仓库。
3. 将自动检测 `Dockerfile`。
4. 在 **Variables & Secrets** 步骤中，添加您的 `GEMINI_API_KEY` 和 `OPENAI_API_KEY`。

### Cloudflare Pages

1. 将代码推送到 GitHub 仓库。
2. 登录 Cloudflare Dashboard 并转到 **Pages**。
3. 选择 **Connect to Git** 并选择您的仓库。
4. **构建设置:**
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
5. **环境变量:**
   - 添加 `GEMINI_API_KEY` 和 `OPENAI_API_KEY`。

### Netlify

使用配置好的 `netlify.toml` 部署到 Netlify。

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/corvo007/gemini-subtitle-pro)

1. 点击上方按钮。
2. 连接您的 GitHub 仓库。
3. Netlify 将检测 `netlify.toml` 设置。
4. 转到 **Site settings > Build & deploy > Environment** 并添加您的 API 密钥。

### Render

在 Render 上作为静态站点部署。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/corvo007/gemini-subtitle-pro)

1. 点击上方按钮。
2. Render 将读取 `render.yaml` 文件。
3. 设置过程中系统会提示您输入 `GEMINI_API_KEY` 和 `OPENAI_API_KEY`。

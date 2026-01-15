# 模块架构

## 🧱 应用模块架构

```mermaid
flowchart TB
    subgraph APP_LAYER["应用层 (App Layer)"]
        direction LR
        APP["App.tsx<br/>路由与状态容器"]

        subgraph PAGES["页面"]
            HOME["HomePage<br/>上传入口"]
            WORKSPACE["WorkspacePage<br/>编辑工作区"]
            GLOSSARY_PAGE["GlossaryManager<br/>术语管理"]
            DOWNLOAD_PAGE["DownloadPage<br/>视频下载"]
            COMPRESS_PAGE["CompressionPage<br/>视频压制"]
            E2E_WIZARD["EndToEndWizard<br/>全自动处理"]
        end

        APP --> PAGES
    end

    subgraph HOOKS_LAYER["状态层 (Hooks Layer)"]
        direction LR

        subgraph CORE_HOOKS["核心 Hooks"]
            USE_WORKSPACE["useWorkspaceLogic<br/>工作区逻辑入口"]
            USE_AUTO_SAVE["useAutoSave"]
            USE_FILE_OPS["useFileOperations"]
            USE_GENERATION["useGeneration"]
            USE_BATCH["useBatchActions"]
            USE_SETTINGS["useSettings<br/>设置持久化"]
        end

        subgraph FEATURE_HOOKS["功能 Hooks"]
            USE_GLOSSARY["useGlossaryFlow<br/>术语流程"]
            USE_SNAPSHOTS["useSnapshots<br/>版本快照"]
            USE_DOWNLOAD["useDownload<br/>下载逻辑"]
            USE_TOAST["useToast<br/>通知系统"]
            USE_E2E["useEndToEnd<br/>流程状态"]
            USE_VIDEO_PREVIEW["useVideoPreview<br/>视频播放与转码"]
        end
    end

    subgraph SERVICES_LAYER["服务层 (Services Layer)"]
        direction TB

        subgraph API_SVC["API 服务"]
            direction LR
            GEMINI_CORE["gemini/core/<br/>client.ts (客户端与配置)"]
            OPENAI_SVC2["openai/<br/>transcribe.ts"]
            WHISPER_SVC["whisper-local/<br/>transcribe.ts"]
        end

        subgraph GENERATION_SVC["生成服务"]
            direction TB
            PIPELINE["pipeline/<br/>index.ts (流程编排)<br/>pipelineCore.ts<br/>steps/*.ts"]
            EXTRACTORS["extractors/<br/>glossary.ts<br/>speakerProfile.ts"]
            BATCH_OPS["batch/<br/>proofread.ts<br/>regenerate.ts"]
        end

        subgraph AUDIO_SVC["音频服务"]
            direction LR
            SEGMENTER_SVC["segmenter.ts (17KB)<br/>智能切分"]
            SAMPLER_SVC["sampler.ts (12KB)<br/>智能采样"]
            DECODER_SVC["decoder.ts<br/>音频解码"]
        end

        subgraph SUBTITLE_SVC["字幕服务"]
            direction LR
            PARSER_SVC["parser.ts (13KB)<br/>多格式解析"]
            GENERATOR_SVC["generator.ts<br/>格式导出"]
            TIME_SVC["time.ts<br/>时间码处理"]
            RECONCILER_SVC["reconciler.ts<br/>数据协调"]
        end

        subgraph ALIGNMENT_SVC["对齐服务"]
            direction LR
            AL_STRATEGY["utils/strategies/ctcAligner.ts<br/>CTC 时间戳校正"]
            AL_IDX["utils/index.ts<br/>工厂"]
        end

        subgraph GLOSSARY_SVC["术语服务"]
            direction LR
            MANAGER_SVC["manager.ts<br/>术语管理"]
            MERGER_SVC["merger.ts<br/>术语合并"]
            SELECTOR_SVC["selector.ts<br/>片段选择"]
        end

        subgraph DOWNLOAD_SVC["下载服务"]
            direction LR
            DL_SVC["download.ts<br/>下载逻辑"]
            DL_TYPES["types.ts<br/>下载类型"]
        end
    end

    subgraph INFRA_LAYER["基础设施层 (Infrastructure Layer)"]
        direction LR

        subgraph UTILS["工具库"]
            CONCURRENCY["concurrency.ts<br/>Semaphore"]
            LOGGER["logger.ts<br/>日志系统"]
            ENV["env.ts<br/>环境变量"]
            SNAPSHOT["snapshotStorage.ts<br/>快照持久化"]
        end

        subgraph WORKERS_GROUP["Workers"]
            VAD_WORKER["vad.worker.ts<br/>VAD 后台"]
            PARSER_WORKER["parser.worker.ts<br/>解析后台"]
        end

        subgraph TYPES_GROUP["类型 (全局)"]
            SUBTITLE_TYPE["src/types/subtitle.ts"]
            SETTINGS_TYPE["src/types/settings.ts"]
            API_TYPE["src/types/api.ts"]
            GLOSSARY_TYPE["src/types/glossary.ts"]
            PIPELINE_TYPE["src/types/pipeline.ts"]
        end
    end

    subgraph ELECTRON_LAYER["Electron 层 (仅桌面端)"]
        direction LR
        MAIN_PROCESS["main.ts (15KB)<br/>主进程"]
        PRELOAD_SCRIPT["preload.ts<br/>安全桥接"]

        subgraph ELECTRON_SVC["桌面服务"]
            LOCAL_WHISPER_SVC["localWhisper.ts (13KB)<br/>GPU 检测"]
            FFMPEG_SVC["ffmpegAudioExtractor.ts"]
            COMPRESSOR_SVC["videoCompressor.ts<br/>硬件加速"]
            YTDLP_SVC["ytdlp.ts"]
            PIPELINE_SVC["endToEndPipeline.ts<br/>全自动流水线"]
            PREVIEW_SVC["videoPreviewTranscoder.ts<br/>视频预览与缓存"]
            STORAGE_SVC["storage.ts<br/>便携式存储"]
            LOGGER_SVC["logger.ts<br/>JSON 视图"]
            PATHS_UTIL["utils/paths.ts<br/>路径解析"]
        end

        MAIN_PROCESS --> ELECTRON_SVC
        PIPELINE_SVC -.-> YTDLP_SVC
        PIPELINE_SVC -.-> COMPRESSOR_SVC
        ELECTRON_SVC -.-> PREVIEW_SVC
    end

    APP_LAYER --> HOOKS_LAYER
    HOOKS_LAYER --> SERVICES_LAYER
    SERVICES_LAYER --> INFRA_LAYER
    SERVICES_LAYER -.-|"Electron Only"| ELECTRON_LAYER
```

---

## 🔗 模块依赖关系

```mermaid
flowchart LR
    subgraph ENTRY["入口"]
        PIPELINE_IDX["generation/pipeline/index.ts<br/>generateSubtitles()"]
    end

    subgraph EXTRACTORS_DEPS["提取器依赖"]
        GLOSSARY_EXT["extractors/glossary.ts"]
        SPEAKER_EXT["extractors/speakerProfile.ts"]
    end

    subgraph CORE_DEPS["核心依赖"]
        BATCH_OPS["generation/batch/<br/>proofread.ts, regenerate.ts"]
        GEMINI_CLIENT["api/gemini/core/client.ts"]
        PROMPTS_TS["api/gemini/core/prompts.ts"]
        SCHEMAS_TS["api/gemini/core/schemas.ts"]
    end

    subgraph AUDIO_DEPS["音频依赖"]
        SEGMENTER_TS["segmenter.ts<br/>SmartSegmenter"]
        SAMPLER_TS["sampler.ts<br/>intelligentSampling()"]
        DECODER_TS["decoder.ts"]
        PROCESSOR_TS["processor.ts<br/>sliceAudioBuffer()"]
    end

    subgraph TRANSCRIBE_DEPS["转写依赖"]
        OPENAI_TRANSCRIBE["openai/transcribe.ts"]
        LOCAL_TRANSCRIBE["whisper-local/transcribe.ts"]
    end

    subgraph UTIL_DEPS["通用依赖"]
        CONCURRENCY_TS["concurrency.ts<br/>Semaphore, mapInParallel"]
        LOGGER_TS["logger.ts"]
        PRICING_TS["pricing.ts"]
    end

    subgraph DOWNLOAD_DEPS["下载依赖"]
        DOWNLOAD_TS["download/download.ts"]
        DOWNLOAD_UTILS["download/utils.ts"]
    end

    DOWNLOAD_TS --> DOWNLOAD_UTILS
    DOWNLOAD_TS --> LOGGER_TS

    PIPELINE_IDX --> EXTRACTORS_DEPS
    PIPELINE_IDX --> BATCH_OPS
    PIPELINE_IDX --> SEGMENTER_TS
    PIPELINE_IDX --> TRANSCRIBE_DEPS

    EXTRACTORS_DEPS --> GEMINI_CLIENT
    EXTRACTORS_DEPS --> SAMPLER_TS
    BATCH_OPS --> GEMINI_CLIENT
    GEMINI_CLIENT --> PROMPTS_TS
    GEMINI_CLIENT --> SCHEMAS_TS

    SEGMENTER_TS --> DECODER_TS
    SAMPLER_TS --> PROCESSOR_TS

    SUBTITLE_TS --> CONCURRENCY_TS
    CLIENT_TS --> LOGGER_TS
    SUBTITLE_TS --> PRICING_TS
```

---

## 📁 目录结构

```
Gemini-Subtitle-Pro/
├── 📂 src/                          # 前端源代码
│   ├── 📄 App.tsx                   # 应用主入口
│   ├── 📄 index.tsx                 # React 渲染入口
│   ├── 📄 index.css                 # 全局样式
│   ├── 📄 i18n.ts                   # [NEW] 国际化配置入口
│   │
│   ├── 📂 components/               # UI 组件
│   │   ├── 📂 common/               # 通用业务组件 (Header, PageHeader 等)
│   │   ├── 📂 editor/               # 字幕编辑器与视频预览组件
│   │   │   ├── 📄 VideoPlayerPreview.tsx  # [NEW] 渐进式视频播放器
│   │   │   ├── 📄 RegenerateModal.tsx     # [NEW] 批量重新生成模态框
│   │   │   └── 📄 ...               # SubtitleRow, Batch 等
│   │   ├── 📂 compression/          # [NEW] 视频压制页面组件
│   │   │   ├── 📄 EncoderSelector.tsx # 编码器选择与配置
│   │   │   └── 📄 ...
│   │   ├── 📂 pages/                # 页面级组件
│   │   ├── 📂 ui/                   # 基础 UI 组件库
│   │   ├── 📂 settings/             # 设置相关组件
│   │   │   ├── 📂 tabs/             # [NEW] 模块化设置面板
│   │   │   └── 📄 SettingsModal.tsx
│   │   ├── 📂 layout/               # 布局容器
│   │   ├── 📂 modals/               # 业务弹窗
│   │   ├── 📂 endToEnd/             # 端到端向导组件
│   │   └── 📂 ...
│   │
│   ├── 📂 hooks/                    # React Hooks
│   │   ├── 📂 useWorkspaceLogic/    # 核心工作区逻辑
│   │   ├── 📄 useVideoPreview.ts    # [NEW] 视频预览与转码状态
│   │   └── ...
│   │
│   ├── 📂 locales/                  # [NEW] 国际化资源目录
│   │   ├── 📂 zh-CN/                # 简体中文
│   │   ├── 📂 en-US/                # 英语
│   │   └── 📂 ja-JP/                # 日语 (v2.13 新增)
│   │
│   ├── 📂 services/                 # 服务层 (纯逻辑)
│   │   ├── 📂 api/                  # API 集成
│   │   ├── 📂 generation/           # 生成服务
│   │   │   ├── 📂 pipeline/         # 完整流水线
│   │   │   │   ├── 📂 core/         # [NEW] 步骤基类
│   │   │   │   └── 📂 steps/        # [NEW] 步骤实现
│   │   │   ├── 📂 extractors/       # 信息提取
│   │   │   └── 📂 batch/            # 批量操作
│   │   ├── 📂 audio/                # 音频处理
│   │   ├── 📂 subtitle/             # 字幕解析与生成
│   │   │   ├── 📄 reconciler.ts     # [NEW] 数据协调器
│   │   │   └── 📄 ...
│   │   ├── 📂 glossary/             # 术语管理
│   │   ├── 📂 download/             # 视频下载
│   │   └── 📂 utils/                # 基础设施
│   │
│   ├── 📂 types/                    # 全局类型定义
│   └── 📂 config/                   # 配置文件
│       └── 📄 models.ts             # [NEW] 模型配置中心
│
├── 📂 electron/                     # Electron 桌面端代码
│   ├── 📄 main.ts                   # 主进程入口
│   ├── 📄 preload.ts                # 预加载脚本
│   └── 📂 services/                 # 桌面服务
│       ├── 📄 localWhisper.ts
│       ├── 📄 videoCompressor.ts
│       ├── 📄 videoPreviewTranscoder.ts
│       ├── 📄 endToEndPipeline.ts
│       ├── 📄 ytdlp.ts
│       └── 📂 utils/
│
├── 📂 docs/                         # 文档目录
│   ├── 📄 ARCHITECTURE_zh.md        # 中文架构文档
│   └── 📄 ARCHITECTURE.md           # 英文架构文档
│
└── 📄 package.json                  # 项目配置
```

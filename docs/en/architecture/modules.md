# Module Architecture

## 🧱 Application Module Architecture

```mermaid
flowchart TB
    subgraph APP_LAYER["Application Layer"]
        direction LR
        APP["App.tsx<br/>Router & State Container"]

        subgraph PAGES["Pages"]
            HOME["HomePage<br/>Upload Entry"]
            WORKSPACE["WorkspacePage<br/>Editing Workspace"]
            GLOSSARY_PAGE["GlossaryManager<br/>Glossary Management"]
            DOWNLOAD_PAGE["DownloadPage<br/>Video Download"]
            COMPRESS_PAGE["CompressionPage<br/>Video Encoding"]
            E2E_WIZARD["EndToEndWizard<br/>Full Automation"]
        end

        APP --> PAGES
    end

    subgraph HOOKS_LAYER["State Layer (Hooks)"]
        direction LR

        subgraph CORE_HOOKS["Core Hooks"]
            USE_WORKSPACE["useWorkspaceLogic<br/>Workspace Logic Entry"]
            USE_AUTO_SAVE["useAutoSave"]
            USE_FILE_OPS["useFileOperations"]
            USE_GENERATION["useGeneration"]
            USE_BATCH["useBatchActions"]
            USE_SETTINGS["useSettings<br/>Settings Persistence"]
        end

        subgraph FEATURE_HOOKS["Feature Hooks"]
            USE_GLOSSARY["useGlossaryFlow<br/>Glossary Flow"]
            USE_SNAPSHOTS["useSnapshots<br/>Version Snapshots"]
            USE_DOWNLOAD["useDownload<br/>Download Logic"]
            USE_TOAST["useToast<br/>Notification System"]
            USE_E2E["useEndToEnd<br/>Flow State"]
            USE_VIDEO_PREVIEW["useVideoPreview<br/>Video Playback & Transcoding"]
        end
    end

    subgraph SERVICES_LAYER["Services Layer"]
        direction TB

        subgraph API_SVC["API Services"]
            direction LR
            GEMINI_CORE["gemini/core/<br/>client.ts (Client & Config)"]
            OPENAI_SVC2["openai/<br/>transcribe.ts"]
            WHISPER_SVC["whisper-local/<br/>transcribe.ts"]
        end

        subgraph GENERATION_SVC["Generation Services"]
            direction TB
            PIPELINE["pipeline/<br/>index.ts (Orchestrator)<br/>pipelineCore.ts<br/>steps/*.ts"]
            EXTRACTORS["extractors/<br/>glossary.ts<br/>speakerProfile.ts"]
            BATCH_OPS["batch/<br/>proofread.ts<br/>regenerate.ts"]
        end

        subgraph AUDIO_SVC["Audio Services"]
            direction LR
            SEGMENTER_SVC["segmenter.ts<br/>Smart Segmentation"]
            SAMPLER_SVC["sampler.ts<br/>Intelligent Sampling"]
            DECODER_SVC["decoder.ts<br/>Audio Decoding"]
        end

        subgraph SUBTITLE_SVC["Subtitle Services"]
            direction LR
            PARSER_SVC["parser.ts<br/>Multi-format Parsing"]
            GENERATOR_SVC["generator.ts<br/>Format Export"]
            TIME_SVC["time.ts<br/>Timecode Processing"]
            RECONCILER_SVC["reconciler.ts<br/>Data Reconciliation"]
        end
    end

    subgraph INFRA_LAYER["Infrastructure Layer"]
        direction LR

        subgraph UTILS["Utilities"]
            CONCURRENCY["concurrency.ts<br/>Semaphore"]
            LOGGER["logger.ts<br/>Logging System"]
            ENV["env.ts<br/>Environment Variables"]
            SNAPSHOT["snapshotStorage.ts<br/>Snapshot Persistence"]
        end

        subgraph WORKERS_GROUP["Workers"]
            VAD_WORKER["vad.worker.ts<br/>VAD Background"]
            PARSER_WORKER["parser.worker.ts<br/>Parser Background"]
        end
    end

    subgraph ELECTRON_LAYER["Electron Layer (Desktop Only)"]
        direction LR
        MAIN_PROCESS["main.ts<br/>Main Process"]
        PRELOAD_SCRIPT["preload.ts<br/>Security Bridge"]

        subgraph ELECTRON_SVC["Desktop Services"]
            LOCAL_WHISPER_SVC["localWhisper.ts<br/>GPU Detection"]
            COMPRESSOR_SVC["videoCompressor.ts<br/>Hardware Acceleration"]
            PREVIEW_SVC["videoPreviewTranscoder.ts<br/>Video Preview & Cache"]
            PIPELINE_SVC["endToEndPipeline.ts<br/>Full Automation Pipeline"]
        end

        MAIN_PROCESS --> ELECTRON_SVC
    end

    APP_LAYER --> HOOKS_LAYER
    HOOKS_LAYER --> SERVICES_LAYER
    SERVICES_LAYER --> INFRA_LAYER
    SERVICES_LAYER -.-|"Electron Only"| ELECTRON_LAYER
```

---

## 🔗 Module Dependencies

```mermaid
flowchart LR
    subgraph ENTRY["Entry"]
        PIPELINE_IDX["generation/pipeline/index.ts<br/>generateSubtitles()"]
    end

    subgraph EXTRACTORS_DEPS["Extractor Dependencies"]
        GLOSSARY_EXT["extractors/glossary.ts"]
        SPEAKER_EXT["extractors/speakerProfile.ts"]
    end

    subgraph CORE_DEPS["Core Dependencies"]
        BATCH_OPS["generation/batch/<br/>proofread.ts, regenerate.ts"]
        GEMINI_CLIENT["api/gemini/core/client.ts"]
        PROMPTS_TS["api/gemini/core/prompts.ts"]
        SCHEMAS_TS["api/gemini/core/schemas.ts"]
    end

    subgraph AUDIO_DEPS["Audio Dependencies"]
        SEGMENTER_TS["segmenter.ts<br/>SmartSegmenter"]
        SAMPLER_TS["sampler.ts<br/>intelligentSampling()"]
        DECODER_TS["decoder.ts"]
        PROCESSOR_TS["processor.ts<br/>sliceAudioBuffer()"]
    end

    subgraph TRANSCRIBE_DEPS["Transcription Dependencies"]
        OPENAI_TRANSCRIBE["openai/transcribe.ts"]
        LOCAL_TRANSCRIBE["whisper-local/transcribe.ts"]
    end

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
```

---

## 📁 Directory Structure

```
Gemini-Subtitle-Pro/
├── 📂 src/                          # Frontend source code
│   ├── 📄 App.tsx                   # Application entry
│   ├── 📄 index.tsx                 # React render entry
│   ├── 📄 index.css                 # Global styles
│   ├── 📄 i18n.ts                   # i18n configuration
│   │
│   ├── 📂 components/               # UI Components
│   │   ├── 📂 common/               # Common business components
│   │   ├── 📂 editor/               # Subtitle editor & video preview
│   │   │   ├── 📄 VideoPlayerPreview.tsx  # Progressive video player
│   │   │   ├── 📄 RegenerateModal.tsx     # Batch regenerate modal
│   │   │   └── ...
│   │   ├── 📂 compression/          # Video encoding components
│   │   ├── 📂 pages/                # Page-level components
│   │   ├── 📂 ui/                   # Base UI component library
│   │   ├── 📂 settings/             # Settings components
│   │   ├── 📂 layout/               # Layout containers
│   │   ├── 📂 modals/               # Business modals
│   │   └── 📂 endToEnd/             # End-to-end wizard components
│   │
│   ├── 📂 hooks/                    # React Hooks
│   │   ├── 📂 useWorkspaceLogic/    # Core workspace logic
│   │   ├── 📄 useVideoPreview.ts    # Video preview & transcoding state
│   │   └── ...
│   │
│   ├── 📂 locales/                  # i18n resources
│   │   ├── 📂 zh-CN/                # Simplified Chinese
│   │   ├── 📂 en-US/                # English
│   │   └── 📂 ja-JP/                # Japanese (v2.13)
│   │
│   ├── 📂 services/                 # Service layer (pure logic)
│   │   ├── 📂 api/                  # API integration
│   │   ├── 📂 generation/           # Generation services
│   │   │   ├── 📂 pipeline/         # Complete pipeline
│   │   │   │   ├── 📂 core/         # Step base classes
│   │   │   │   └── 📂 steps/        # Step implementations
│   │   │   ├── 📂 extractors/       # Information extraction
│   │   │   └── 📂 batch/            # Batch operations
│   │   ├── 📂 audio/                # Audio processing
│   │   ├── 📂 subtitle/             # Subtitle parsing & generation
│   │   │   ├── 📄 reconciler.ts     # Data reconciler
│   │   │   └── ...
│   │   └── 📂 utils/                # Infrastructure
│   │
│   ├── 📂 types/                    # Global type definitions
│   └── 📂 config/                   # Configuration files
│       └── 📄 models.ts             # Model configuration center
│
├── 📂 electron/                     # Electron desktop code
│   ├── 📄 main.ts                   # Main process entry
│   ├── 📄 preload.ts                # Preload script
│   └── 📂 services/                 # Desktop services
│
├── 📂 docs/                         # Documentation
│   ├── 📄 ARCHITECTURE_zh.md        # Chinese architecture docs
│   └── 📄 ARCHITECTURE.md           # English architecture docs
│
└── 📄 package.json                  # Project configuration
```

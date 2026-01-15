# Pipeline 流程

## 🔄 完整 Pipeline 并发架构图

下图展示了字幕生成的完整并发架构，包含并行异步任务、Semaphore 控制及任务间依赖关系：

```mermaid
flowchart TB
    subgraph INIT["🎬 初始化阶段"]
        A[音视频文件] --> B[音频解码]
        B --> C{是否智能切分?}
        C -->|是| D["VAD 智能切分<br/>(Silero VAD)"]
        C -->|否| E[固定时长切分]
        D --> F[Audio Chunk 列表]
        E --> F
        D --> G["缓存 VAD 片段<br/>(供说话人采样复用)"]
    end

    subgraph PARALLEL["⚡ 并行异步任务 (Promise)"]
        direction TB

        subgraph GLOSSARY["📚 术语提取流水线"]
            H["glossaryPromise<br/>(Gemini 3 Pro)"]
            H --> I[选择采样片段]
            I --> J["并发提取术语<br/>(concurrencyPro=2)"]
            J --> K[Search Grounding 验证]
            K --> L["⏸️ 等待用户确认<br/>(BLOCKING)"]
            L --> M["GlossaryState<br/>(非阻塞包装器)"]
        end

        subgraph SPEAKER["🗣️ 说话人识别流水线"]
            N["speakerProfilePromise<br/>(Gemini 3 Pro)"]
            N --> O["智能音频采样<br/>(复用 VAD 片段)"]
            O --> P[提取说话人特征]
            P --> Q["SpeakerProfile[]<br/>{name, style, tone, catchphrases}"]
        end
    end

    subgraph CHUNKS["🔄 Chunk 并发处理 (mapInParallel)"]
        direction TB

        subgraph CHUNK1["Chunk 1"]
            C1_T["Transcription<br/>⏳ 等待 transcriptionSemaphore"]
            C1_T --> C1_G["⏳ await glossaryState.get()"]
            C1_G --> C1_S["⏳ await speakerProfiles"]
            C1_S --> C1_R["Refinement<br/>⏳ 等待 refinementSemaphore"]
            C1_R --> C1_TR[Translation]
        end

        subgraph CHUNK2["Chunk 2"]
            C2_T["Transcription<br/>⏳ 等待 transcriptionSemaphore"]
            C2_T --> C2_G["⏳ await glossaryState.get()"]
            C2_G --> C2_S["⏳ await speakerProfiles"]
            C2_S --> C2_R["Refinement<br/>⏳ 等待 refinementSemaphore"]
            C2_R --> C2_TR[Translation]
        end

        subgraph CHUNKN["Chunk N..."]
            CN_T["Transcription"]
            CN_T --> CN_G["等待术语"]
            CN_G --> CN_S["等待说话人"]
            CN_S --> CN_R["Refinement"]
            CN_R --> CN_TR[Translation]
        end
    end

    F --> PARALLEL
    G --> O
    F --> CHUNKS
    M -.-|"非阻塞访问"| C1_G
    M -.-|"非阻塞访问"| C2_G
    Q -.-|"等待完成"| C1_S
    Q -.-|"等待完成"| C2_S

    subgraph MERGE["📦 合并结果"]
        R[合并所有 Chunk 结果]
        R --> S[重新编号字幕 ID]
        S --> T[Token 用量报告]
    end

    CHUNKS --> MERGE
```

---

## 🔒 双 Semaphore 并发控制详解

```mermaid
flowchart LR
    subgraph SEMAPHORES["🔒 Semaphore 资源池"]
        subgraph TRANS["transcriptionSemaphore"]
            T1["Slot 1"]
            T2["Slot 2<br/>(本地 Whisper 默认 1)"]
        end

        subgraph ALIGN["alignmentSemaphore"]
            A1["Slot 1"]
            A2["Slot 2"]
            A3["Slot 3"]
        end

        subgraph REFINE["refinementSemaphore"]
            R1["Slot 1"]
            R2["Slot 2"]
            R3["Slot 3"]
            R4["Slot 4"]
            R5["Slot 5<br/>(Flash 默认 5)"]
        end
    end

    subgraph CHUNKS["Chunks 排队"]
        C1["Chunk 1"]
        C2["Chunk 2"]
        C3["Chunk 3"]
        C4["Chunk 4"]
        C5["Chunk 5"]
        C6["Chunk 6"]
    end

    C1 -->|"acquire()"| T1
    C2 -->|"acquire()"| T2
    C3 -->|"等待..."| TRANS

    C1 -->|"转录完成后"| R1
    C2 -->|"转录完成后"| R2

    C1 -->|"校对完成后"| A1
    C2 -->|"校对完成后"| A2
```

**配置说明：**

| Semaphore                | 用途                  | 默认并发数       | 配置项                 |
| ------------------------ | --------------------- | ---------------- | ---------------------- |
| `transcriptionSemaphore` | 控制 Whisper API 调用 | 本地: 1, 云端: 5 | `whisperConcurrency`   |
| `refinementSemaphore`    | 控制 Gemini Flash API | 5                | `concurrencyFlash`     |
| `alignmentSemaphore`     | 控制对齐服务          | 2                | `concurrencyAlignment` |
| (术语提取内部)           | 控制 Gemini Pro API   | 2                | `concurrencyPro`       |

---

## 📊 Chunk 内部 6 阶段流水线

```mermaid
sequenceDiagram
    participant Chunk as Chunk N
    participant TSem as transcriptionSemaphore
    participant Whisper as Whisper API
    participant GState as GlossaryState
    participant SProm as speakerProfilePromise
    participant RSem as refinementSemaphore
    participant Gemini as Gemini Flash
    participant ASem as alignmentSemaphore
    participant Aligner as CTC Aligner

    Note over Chunk: Stage 1: Transcription
    Chunk->>TSem: acquire()
    activate TSem
    TSem-->>Chunk: 获得许可
    Chunk->>Whisper: transcribe(audioChunk)
    Whisper-->>Chunk: rawSegments[]
    Chunk->>TSem: release()
    deactivate TSem

    Note over Chunk: Stage 2: Wait for Glossary (Non-blocking)
    Chunk->>GState: await get()
    GState-->>Chunk: finalGlossary[]

    Note over Chunk: Stage 3: Wait for Speaker Profiles
    Chunk->>SProm: await speakerProfiles
    SProm-->>Chunk: SpeakerProfile[]

    Note over Chunk: Stage 4: Refinement
    Chunk->>RSem: acquire()
    activate RSem
    RSem-->>Chunk: 获得许可
    Chunk->>Gemini: Refinement (音频+原文)
    Note right of Gemini: 时间轴校正<br/>术语应用<br/>说话人匹配
    Gemini-->>Chunk: refinedSegments[]
    Chunk->>RSem: release()
    deactivate RSem

    Note over Chunk: Stage 5: Alignment
    Chunk->>ASem: acquire()
    activate ASem
    ASem-->>Chunk: 获得许可 (CTC)
    Chunk->>Aligner: align(refinedSegments)
    Note right of Aligner: 精确时间轴<br/>强制对齐
    Aligner-->>Chunk: alignedSegments[]
    Chunk->>ASem: release()
    deactivate ASem

    Note over Chunk: Stage 6: Translation
    Chunk->>RSem: acquire()
    activate RSem
    RSem-->>Chunk: 获得许可
    Chunk->>Gemini: Translation (批量)
    Gemini-->>Chunk: translatedItems[]
    Chunk->>RSem: release()
    deactivate RSem

    Note over Chunk: 完成
```

---

## 🏗️ Pipeline 步骤架构 (v2.13 新增)

v2.13 引入了基于类的步骤架构，将 Chunk 处理逻辑模块化：

```mermaid
classDiagram
    class BaseStep~TInput, TOutput~ {
        <<abstract>>
        #context: StepContext
        #pipelineContext: PipelineContext
        +execute(input: TInput) StepResult~TOutput~
        #run(input: TInput)* TOutput
        #shouldSkip(input: TInput) boolean
        #getMockOutput(input: TInput) TOutput
    }

    class TranscriptionStep {
        +run(input) SubtitleItem[]
        -transcribeWithWhisper()
    }

    class WaitForDepsStep {
        +run(input) WaitForDepsOutput
        -awaitGlossary()
        -awaitSpeakers()
    }

    class RefinementStep {
        +run(input) SubtitleItem[]
        -refineWithGemini()
    }

    class AlignmentStep {
        +run(input) SubtitleItem[]
        -alignWithCTC()
    }

    class TranslationStep {
        +run(input) SubtitleItem[]
        -translateWithGemini()
    }

    class ProofreadStep {
        +run(input) SubtitleItem[]
        -proofreadWithGemini()
    }

    BaseStep <|-- TranscriptionStep
    BaseStep <|-- WaitForDepsStep
    BaseStep <|-- RefinementStep
    BaseStep <|-- AlignmentStep
    BaseStep <|-- TranslationStep
    BaseStep <|-- ProofreadStep
```

**步骤说明：**

| 步骤                | 文件                   | 输入             | 输出                | 用途                       |
| :------------------ | :--------------------- | :--------------- | :------------------ | :------------------------- |
| `TranscriptionStep` | `TranscriptionStep.ts` | AudioChunk       | `SubtitleItem[]`    | Whisper 语音转文字         |
| `WaitForDepsStep`   | `WaitForDepsStep.ts`   | -                | Glossary + Speakers | 等待术语表和说话人提取完成 |
| `RefinementStep`    | `RefinementStep.ts`    | `SubtitleItem[]` | `SubtitleItem[]`    | 时间轴校正、术语应用       |
| `AlignmentStep`     | `AlignmentStep.ts`     | `SubtitleItem[]` | `SubtitleItem[]`    | CTC 强制对齐               |
| `TranslationStep`   | `TranslationStep.ts`   | `SubtitleItem[]` | `SubtitleItem[]`    | AI 翻译                    |
| `ProofreadStep`     | `ProofreadStep.ts`     | `SubtitleItem[]` | `SubtitleItem[]`    | 批量校对 (可选)            |

---

## ⚖️ 批量操作对比 (v2.13 新增)

v2.13 将批量操作拆分为两种独立模式：

| 特性         | Proofread (校对)         | Regenerate (重新生成)                    |
| :----------- | :----------------------- | :--------------------------------------- |
| **文件**     | `batch/proofread.ts`     | `batch/regenerate.ts`                    |
| **用途**     | 润色和校对已有翻译       | 完全重新处理选中片段                     |
| **流程**     | 仅调用 Gemini Pro 校对   | 转录 → 润色 → 对齐 → 翻译 (完整流水线)   |
| **输入**     | 已有的 `SubtitleItem[]`  | 原始音频 + 时间范围                      |
| **保留内容** | 保留原始时间轴           | 全部重新生成                             |
| **适用场景** | 改善翻译质量、修正错别字 | 修复转录错误、重新分句、更新术语表后重跑 |
| **用户提示** | 不支持                   | 支持转录提示和翻译提示                   |
| **模型**     | Gemini 3 Pro             | Whisper + Gemini Flash                   |

```mermaid
flowchart LR
    subgraph PROOFREAD["校对模式 (Proofread)"]
        P_IN["选中片段"] --> P_GEMINI["Gemini Pro<br/>校对润色"]
        P_GEMINI --> P_OUT["校对后片段"]
    end

    subgraph REGENERATE["重新生成模式 (Regenerate)"]
        R_IN["选中片段<br/>+ 时间范围"] --> R_AUDIO["提取音频片段"]
        R_AUDIO --> R_TRANS["Whisper 转录"]
        R_TRANS --> R_REFINE["Refinement"]
        R_REFINE --> R_ALIGN["CTC 对齐"]
        R_ALIGN --> R_TRANSLATE["Translation"]
        R_TRANSLATE --> R_OUT["重新生成片段"]
    end
```

---

## 🔗 Pipeline 依赖总结

| 阶段          | 依赖项                                      | 说明                   |
| :------------ | :------------------------------------------ | :--------------------- |
| Transcription | `transcriptionSemaphore`                    | 独立执行，无阻塞依赖   |
| Wait Glossary | `glossaryState.get()`                       | 必须等待术语表确认完成 |
| Wait Speakers | `speakerProfilePromise`                     | 必须等待说话人识别完成 |
| Refinement    | `refinementSemaphore` + Glossary + Speakers | 合并并使用所有数据     |
| Alignment     | `alignmentSemaphore`                        | 高精度时间轴对齐       |
| Translation   | `refinementSemaphore` (共享)                | 对齐后进行翻译         |

---

## 📚 术语提取与用户交互流程

```mermaid
sequenceDiagram
    participant Pipeline as generateSubtitles
    participant Glossary as extractGlossaryFromAudio
    participant Pro as Gemini 3 Pro
    participant State as GlossaryState
    participant UI as 用户界面
    participant Chunks as Chunk Workers

    Note over Pipeline: 启动并行术语提取
    Pipeline->>+Glossary: glossaryPromise = extract()
    Pipeline->>State: new GlossaryState(promise)
    Note over State: 包装 Promise 为非阻塞访问器

    par 术语提取并行进行
        loop 采样片段并发处理 (concurrencyPro=2)
            Glossary->>Pro: 发送音频片段
            Pro->>Pro: Search Grounding 验证
            Pro-->>Glossary: GlossaryExtractionResult
        end
    and Chunks 可以开始转录
        Chunks->>Chunks: 开始 Transcription 阶段
        Chunks->>State: await get()
        Note over State: Chunks 在此等待术语表
    end

    Glossary-->>-Pipeline: extractedResults[]

    Note over Pipeline: 等待用户确认 (BLOCKING)
    Pipeline->>UI: onGlossaryReady(metadata)
    UI->>UI: 显示术语表弹窗
    UI-->>Pipeline: confirmedGlossary[]

    Pipeline->>State: resolve(confirmedGlossary)
    Note over State: 所有等待的 Chunks 被唤醒

    State-->>Chunks: finalGlossary[]
    Note over Chunks: 继续进入 Refinement 阶段
```

---

## 🗣️ 说话人识别在 Pipeline 中的位置

```mermaid
flowchart TB
    subgraph PARALLEL["并行启动的 Promise"]
        GP["glossaryPromise<br/>术语提取"]
        SP["speakerProfilePromise<br/>说话人识别"]
    end

    subgraph CHUNK["每个 Chunk 的处理流程"]
        T["Transcription<br/>(独立进行)"]
        WG["等待 glossaryState.get()"]
        WS["等待 speakerProfiles"]
        R["Refinement<br/>(合并使用术语+说话人)"]
        TR["Translation"]

        T --> WG
        WG --> WS
        WS --> R
        R --> TR
    end

    GP -.-|"After User Confirms"| WG
    SP -.-|"After Extraction Complete"| WS

    subgraph REFINEMENT["Refinement Stage Uses"]
        G["Glossary → Correct Recognition Errors"]
        S["Speaker Profiles → Match Speakers"]
        G --> PROMPT["System Prompt"]
        S --> PROMPT
    end

    R --> REFINEMENT
```

---

## 🔄 数据完整性与协调 ("数据枢纽")

系统采用严格的 **数据协调策略** (`src/services/subtitle/reconciler.ts`) 以确保在流水线各个阶段（Refinement, Alignment, Translation）之间，即使片段数量发生变化（如拆分或合并），元数据也能保持一致。

### 协调器逻辑 (The Reconciler Logic)

`reconcile(prev, curr)` 函数充当连接流水线各个阶段的"数据枢纽"。它智能地将 `prev`（源）的元数据合并到 `curr`（新生成）的片段中：

- **语义元数据 (Semantic Metadata)** (始终继承):
  - `speaker` (说话人 ID/名称)
  - `comment` (用户备注)
  - **逻辑**: 继承自重叠率最高的 `prev` 片段。即使片段被拆分，所有子片段都会继承父片段的说话人信息。
- **内部状态 (Internal State)** (条件继承):
  - `alignmentScore` (CTC 置信度)
  - `lowConfidence` (低置信度标记)
  - `hasRegressionIssue`, `hasCorruptedRangeIssue` (错误标记)
  - **逻辑**: **仅当**检测到 **1:1 映射**时才严格继承。如果片段被拆分或合并，这些内部标记会被重置。

### 对齐策略 (CTC)

系统使用 **CTC (Connectionist Temporal Classification)** 进行高精度对齐：

- **引擎**: `ctcAligner.ts` 调用外部 `align.exe` (MMS-300m 模型)。
- **功能**: 基于音频对齐结果更新 `startTime` 和 `endTime`，但**绝不拆分或合并**片段。
- **元数据**: 为片段添加 `alignmentScore`。低于阈值的评分会触发 `lowConfidence` 标记以供用户复查。

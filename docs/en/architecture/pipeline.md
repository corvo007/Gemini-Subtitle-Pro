# Pipeline Flow

## 🔄 Complete Pipeline Concurrent Architecture

The following diagram shows the complete concurrent architecture of subtitle generation, including parallel async tasks, Semaphore control, and inter-task dependencies:

```mermaid
flowchart TB
    subgraph INIT["🎬 Initialization Phase"]
        A[Audio/Video File] --> B[Audio Decode]
        B --> C{Smart Split?}
        C -->|Yes| D["VAD Smart Split<br/>(Silero VAD)"]
        C -->|No| E[Fixed Duration Split]
        D --> F[Audio Chunk List]
        E --> F
        D --> G["Cache VAD Segments<br/>(for speaker sampling reuse)"]
    end

    subgraph PARALLEL["⚡ Parallel Async Tasks (Promise)"]
        direction TB

        subgraph GLOSSARY["📚 Glossary Extraction Pipeline"]
            H["glossaryPromise<br/>(Gemini 3 Pro)"]
            H --> I[Select Sample Segments]
            I --> J["Concurrent Extraction<br/>(concurrencyPro=2)"]
            J --> K[Search Grounding Validation]
            K --> L["⏸️ Await User Confirmation<br/>(BLOCKING)"]
            L --> M["GlossaryState<br/>(Non-blocking Wrapper)"]
        end

        subgraph SPEAKER["🗣️ Speaker Recognition Pipeline"]
            N["speakerProfilePromise<br/>(Gemini 3 Pro)"]
            N --> O["Intelligent Audio Sampling<br/>(Reuse VAD Segments)"]
            O --> P[Extract Speaker Features]
            P --> Q["SpeakerProfile[]<br/>{name, style, tone, catchphrases}"]
        end
    end

    subgraph CHUNKS["🔄 Chunk Concurrent Processing (mapInParallel)"]
        direction TB

        subgraph CHUNK1["Chunk 1"]
            C1_T["Transcription<br/>⏳ await transcriptionSemaphore"]
            C1_T --> C1_G["⏳ await glossaryState.get()"]
            C1_G --> C1_S["⏳ await speakerProfiles"]
            C1_S --> C1_R["Refinement<br/>⏳ await refinementSemaphore"]
            C1_R --> C1_TR[Translation]
        end

        subgraph CHUNK2["Chunk 2"]
            C2_T["Transcription<br/>⏳ await transcriptionSemaphore"]
            C2_T --> C2_G["⏳ await glossaryState.get()"]
            C2_G --> C2_S["⏳ await speakerProfiles"]
            C2_S --> C2_R["Refinement<br/>⏳ await refinementSemaphore"]
            C2_R --> C2_TR[Translation]
        end
    end

    F --> PARALLEL
    G --> O
    F --> CHUNKS
    M -.-|"Non-blocking Access"| C1_G
    Q -.-|"Wait for Completion"| C1_S

    subgraph MERGE["📦 Merge Results"]
        R[Merge All Chunk Results]
        R --> S[Re-number Subtitle IDs]
        S --> T[Token Usage Report]
    end

    CHUNKS --> MERGE
```

---

## 🔒 Dual Semaphore Concurrency Control

```mermaid
flowchart LR
    subgraph SEMAPHORES["🔒 Semaphore Resource Pool"]
        subgraph TRANS["transcriptionSemaphore"]
            T1["Slot 1"]
            T2["Slot 2<br/>(Local Whisper default: 1)"]
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
            R5["Slot 5<br/>(Flash default: 5)"]
        end
    end

    subgraph CHUNKS["Chunks Queue"]
        C1["Chunk 1"]
        C2["Chunk 2"]
        C3["Chunk 3"]
    end

    C1 -->|"acquire()"| T1
    C2 -->|"acquire()"| T2
    C3 -->|"waiting..."| TRANS

    C1 -->|"after transcription"| R1
    C2 -->|"after transcription"| R2
```

**Configuration:**

| Semaphore                | Purpose              | Default Concurrency | Config Key             |
| ------------------------ | -------------------- | ------------------- | ---------------------- |
| `transcriptionSemaphore` | Control Whisper API  | Local: 1, Cloud: 5  | `whisperConcurrency`   |
| `refinementSemaphore`    | Control Gemini Flash | 5                   | `concurrencyFlash`     |
| `alignmentSemaphore`     | Control Alignment    | 2                   | `concurrencyAlignment` |
| (Glossary internal)      | Control Gemini Pro   | 2                   | `concurrencyPro`       |

---

## 📊 6-Stage Chunk Pipeline

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
    TSem-->>Chunk: Permission granted
    Chunk->>Whisper: transcribe(audioChunk)
    Whisper-->>Chunk: rawSegments[]
    Chunk->>TSem: release()
    deactivate TSem

    Note over Chunk: Stage 2: Wait for Glossary
    Chunk->>GState: await get()
    GState-->>Chunk: finalGlossary[]

    Note over Chunk: Stage 3: Wait for Speaker Profiles
    Chunk->>SProm: await speakerProfiles
    SProm-->>Chunk: SpeakerProfile[]

    Note over Chunk: Stage 4: Refinement
    Chunk->>RSem: acquire()
    activate RSem
    Chunk->>Gemini: Refinement (audio+text)
    Note right of Gemini: Timeline correction<br/>Term application<br/>Speaker matching
    Gemini-->>Chunk: refinedSegments[]
    Chunk->>RSem: release()
    deactivate RSem

    Note over Chunk: Stage 5: Alignment
    Chunk->>ASem: acquire()
    activate ASem
    Chunk->>Aligner: align(refinedSegments)
    Note right of Aligner: Precise timeline<br/>Forced alignment
    Aligner-->>Chunk: alignedSegments[]
    Chunk->>ASem: release()
    deactivate ASem

    Note over Chunk: Stage 6: Translation
    Chunk->>RSem: acquire()
    activate RSem
    Chunk->>Gemini: Translation (batch)
    Gemini-->>Chunk: translatedItems[]
    Chunk->>RSem: release()
    deactivate RSem

    Note over Chunk: Complete
```

---

## 🏗️ Pipeline Step Architecture (v2.13)

v2.13 introduced class-based step architecture, modularizing Chunk processing logic:

```mermaid
classDiagram
    class BaseStep~TInput, TOutput~ {
        <<abstract>>
        #context: StepContext
        #pipelineContext: PipelineContext
        +execute(input: TInput) StepResult~TOutput~
        #run(input: TInput)* TOutput
        #shouldSkip(input: TInput) boolean
    }

    class TranscriptionStep {
        +run(input) SubtitleItem[]
    }

    class WaitForDepsStep {
        +run(input) WaitForDepsOutput
    }

    class RefinementStep {
        +run(input) SubtitleItem[]
    }

    class AlignmentStep {
        +run(input) SubtitleItem[]
    }

    class TranslationStep {
        +run(input) SubtitleItem[]
    }

    class ProofreadStep {
        +run(input) SubtitleItem[]
    }

    BaseStep <|-- TranscriptionStep
    BaseStep <|-- WaitForDepsStep
    BaseStep <|-- RefinementStep
    BaseStep <|-- AlignmentStep
    BaseStep <|-- TranslationStep
    BaseStep <|-- ProofreadStep
```

**Step Descriptions:**

| Step                | File                   | Input            | Output              | Purpose                        |
| :------------------ | :--------------------- | :--------------- | :------------------ | :----------------------------- |
| `TranscriptionStep` | `TranscriptionStep.ts` | AudioChunk       | `SubtitleItem[]`    | Whisper speech-to-text         |
| `WaitForDepsStep`   | `WaitForDepsStep.ts`   | -                | Glossary + Speakers | Wait for extraction completion |
| `RefinementStep`    | `RefinementStep.ts`    | `SubtitleItem[]` | `SubtitleItem[]`    | Timeline correction, term app  |
| `AlignmentStep`     | `AlignmentStep.ts`     | `SubtitleItem[]` | `SubtitleItem[]`    | CTC forced alignment           |
| `TranslationStep`   | `TranslationStep.ts`   | `SubtitleItem[]` | `SubtitleItem[]`    | AI translation                 |
| `ProofreadStep`     | `ProofreadStep.ts`     | `SubtitleItem[]` | `SubtitleItem[]`    | Batch proofreading (optional)  |

---

## ⚖️ Batch Operations Comparison (v2.13)

| Feature       | Proofread                    | Regenerate                                        |
| :------------ | :--------------------------- | :------------------------------------------------ |
| **File**      | `batch/proofread.ts`         | `batch/regenerate.ts`                             |
| **Purpose**   | Polish existing translations | Completely reprocess segments                     |
| **Flow**      | Gemini Pro only              | Full pipeline (Transcribe→Refine→Align→Translate) |
| **Input**     | Existing `SubtitleItem[]`    | Original audio + time range                       |
| **Preserves** | Original timestamps          | Nothing (regenerates all)                         |
| **Use Case**  | Improve translation quality  | Fix transcription errors, re-segment              |
| **Model**     | Gemini 3 Pro                 | Whisper + Gemini Flash                            |

---

## 🔄 Data Integrity & Reconciliation

The system uses strict **data reconciliation strategy** (`src/services/subtitle/reconciler.ts`) to ensure metadata consistency across pipeline stages.

### Reconciler Logic

`reconcile(prev, curr)` function acts as the "data hub" connecting pipeline stages:

- **Semantic Metadata** (always inherited):
  - `speaker` (Speaker ID/Name)
  - `comment` (User notes)
  - **Logic**: Inherited from `prev` segment with highest overlap. Even split segments inherit parent's speaker.
- **Internal State** (conditionally inherited):
  - `alignmentScore` (CTC confidence)
  - `lowConfidence` (Low confidence flag)
  - **Logic**: Strictly inherited **only when** 1:1 mapping detected. Reset if segments are split/merged.

### Alignment Strategy (CTC)

- **Engine**: `ctcAligner.ts` calls external `align.exe` (MMS-300m model)
- **Function**: Updates `startTime` and `endTime` based on audio alignment, but **never splits or merges** segments
- **Metadata**: Adds `alignmentScore`. Scores below threshold trigger `lowConfidence` flag

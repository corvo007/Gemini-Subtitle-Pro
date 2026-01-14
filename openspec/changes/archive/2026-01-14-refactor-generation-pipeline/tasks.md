## 1. Core Infrastructure

- [x] 1.1 Create `core/types.ts` - StepName, StepContext, StepResult types
- [x] 1.2 Create `core/BaseStep.ts` - Abstract base class with Template Method
- [x] 1.3 Create `core/PipelineRunner.ts` - Step execution and chaining

## 2. Extract Steps

- [x] 2.1 Create `steps/TranscriptionStep.ts` - lines 120-224
- [x] 2.2 Create `steps/WaitForDepsStep.ts` - lines 225-274 (Glossary/Speaker waiting)
- [x] 2.3 Create `steps/RefinementStep.ts` - lines 276-445
- [x] 2.4 Create `steps/AlignmentStep.ts` - lines 447-605
- [x] 2.5 Create `steps/TranslationStep.ts` - lines 607-791
- [x] 2.6 Create `steps/index.ts` - re-export all steps

## 3. Refactor ChunkProcessor

- [x] 3.1 Update `chunkProcessor.ts` to use BaseStep and PipelineRunner
- [x] 3.2 Remove extracted logic, keep only orchestration (~50 lines)
- [x] 3.3 Ensure ChunkResult interface unchanged

## 4. Verification (Manual)

- [x] 4.1 Full Flow: Transcription → Refinement → Alignment → Translation
- [x] 4.2 Mock Mode: Test `mockStage='alignment'` (skip Transcribe/Refine)
- [x] 4.3 Mock Mode: Test `mockStage='translation'` (load Alignment artifact)
- [x] 4.4 Mock API: Test individual `mockApi.transcribe/refinement/alignment/translation`
- [x] 4.5 skipAfter: Test `skipAfter='transcribe'`, `'refinement'`, `'alignment'`
- [x] 4.6 Cancellation: Verify abort signal works during heavy steps
- [x] 4.7 Artifact Saving: Verify intermediate artifacts are saved correctly
- [x] 4.8 Batch Operations: Verify `batch/operations.ts` still works (uses translateBatch, UsageReporter, adjustTimestampOffset)

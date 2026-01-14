## 1. Types

- [x] 1.1 Update `types/subtitle.ts` - Change `BatchOperationMode`, add `RegeneratePrompts`

## 2. Core Logic

- [x] 2.1 Create `services/generation/batch/regenerate.ts` - Main entry point
- [x] 2.2 Implement `calculateTimeRange()` - Calculate time range from batch indices
- [x] 2.3 Implement `createChunksForRange()` - Auto-split into chunks if range > chunkDuration
- [x] 2.4 Implement `mergeChunkResults()` - Combine results from multiple chunks
- [x] 2.5 Implement `mergeResults()` - Replace original subtitles with regenerated ones
- [x] 2.6 Update `services/generation/batch/operations.ts` - Remove `fix_timestamps` logic

## 3. Prompts

- [x] 3.1 Delete `getFixTimestampsPrompt()` from `prompts.ts`
- [x] 3.2 Add user hint injection to `getSystemInstruction()` for refinement
- [x] 3.3 Add user hint injection to `getTranslationBatchPrompt()` for translation

## 4. Hooks

- [x] 4.1 Update `useBatchActions.ts` - Add `prompts` parameter, call `runRegenerateOperation`

## 5. UI Components

- [x] 5.1 Create `components/editor/RegenerateModal.tsx` - Simple modal with 2 textareas
- [x] 5.2 Update `components/editor/BatchHeader.tsx` - Replace button, add modal state

## 6. Locales

- [x] 6.1 Update `locales/zh-CN/editor.json` - Add regenerate texts
- [x] 6.2 Update `locales/en-US/editor.json` - Add regenerate texts
- [x] 6.3 Update `locales/ja-JP/editor.json` - Add regenerate texts
- [x] 6.4 Update `locales/*/workspace.json` - Update batch action texts

## 7. Verification (Manual)

- [x] 7.1 UI: Modal opens with two input fields
- [x] 7.2 UI: ProgressOverlay shows during regeneration
- [x] 7.3 Function: Regenerated subtitles have accurate timestamps
- [x] 7.4 Function: All sentences are translated (no missing)
- [x] 7.5 Function: Cancel restores original state via snapshot
- [x] 7.6 Regression: Proofread mode still works correctly

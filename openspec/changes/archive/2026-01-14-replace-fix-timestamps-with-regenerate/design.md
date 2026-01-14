## Context

现有「校对时间轴」功能使用 LLM (Gemini) 来"听音频校正时间戳"，但：

- LLM 无法精确输出毫秒级时间戳
- 无法解决漏翻译问题
- 结果不可靠

**解决方案**：重跑完整 Pipeline (Transcription → Refinement → Alignment → Translation)

## Goals / Non-Goals

- Goals:
  - 用可靠的 Whisper + Alignment 替代不可靠的 LLM 时间戳猜测
  - 解决漏翻译问题（全新翻译）
  - 允许用户通过 prompt 指引生成和翻译
- Non-Goals:
  - 保留原有翻译（用户确认不需要）
  - 复杂的配置 UI

## Decisions

### 1. 复用现有 ChunkProcessor

调用 `ChunkProcessor.process()` 对选中时间范围重跑 Pipeline，而非重写逻辑。

```typescript
// regenerate.ts
export async function runRegenerateOperation(
  file: File,
  subtitles: SubtitleItem[],
  batchIndices: number[],
  settings: AppSettings,
  prompts: RegeneratePrompts,
  speakerProfiles?: SpeakerProfile[],
  glossary?: GlossaryItem[],
  onProgress?: ProgressHandler,
  signal?: AbortSignal
): Promise<SubtitleItem[]> {
  // 1. 计算选中批次的时间范围
  const timeRange = calculateTimeRange(subtitles, batchIndices, settings.proofreadBatchSize);

  // 2. 自动分块 (如果时间范围 > chunkDuration)
  const chunkDuration = settings.chunkDuration || 300;
  const chunks = createChunksForRange(timeRange, chunkDuration);

  // 3. 创建 PipelineContext (注入用户指引)
  const context = buildPipelineContext(settings, prompts, glossary, speakerProfiles);

  // 4. 并发处理所有 chunks
  const results = await mapInParallel(chunks, settings.concurrencyFlash, async (chunk, i) => {
    onProgress?.({ id: `chunk-${i}`, total: chunks.length, status: 'processing' });
    return ChunkProcessor.process(chunk, context, deps);
  });

  // 5. 合并结果并替换原字幕
  const merged = mergeChunkResults(results);
  return mergeResults(subtitles, batchIndices, merged);
}
```

### 1.5 自动分块处理

当用户选择的时间范围超过 `chunkDuration` 时，自动分块：

```typescript
function createChunksForRange(
  timeRange: { start: number; end: number },
  chunkDuration: number
): ChunkParams[] {
  const duration = timeRange.end - timeRange.start;

  // 如果时间范围 <= chunkDuration，返回单个 chunk
  if (duration <= chunkDuration) {
    return [{ index: 0, start: timeRange.start, end: timeRange.end }];
  }

  // 否则按 chunkDuration 分块
  const chunks: ChunkParams[] = [];
  let cursor = timeRange.start;
  let index = 0;

  while (cursor < timeRange.end) {
    chunks.push({
      index: index++,
      start: cursor,
      end: Math.min(cursor + chunkDuration, timeRange.end),
    });
    cursor += chunkDuration;
  }

  return chunks;
}
```

> [!NOTE]
> 可选：复用 `preprocessor.ts` 中的 `SmartSegmenter` 进行智能分割，
> 但对于重新生成场景，简单的固定分块可能更稳定。

### 2. 用户指引注入

用户指引注入到现有 prompt 的 `customPrompt` 位置：

| 指引类型 | 注入位置                                                   |
| -------- | ---------------------------------------------------------- |
| 转录指引 | `getSystemInstruction(genre, customPrompt, 'refinement')`  |
| 翻译指引 | `getSystemInstruction(genre, customPrompt, 'translation')` |

```typescript
// 在 buildPipelineContext 中
const refinementPrompt = settings.customTranslationPrompt
  ? `${settings.customTranslationPrompt}\n${prompts.transcriptionHint || ''}`
  : prompts.transcriptionHint;
```

### 3. RegeneratePrompts 类型

```typescript
export interface RegeneratePrompts {
  transcriptionHint?: string; // 转录/校正指引
  translationHint?: string; // 翻译指引
}
```

### 4. UI 组件设计

**RegenerateModal** - 简单 Modal：

```tsx
<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
  <h3>{t('regenerateModal.title')}</h3>

  <label>{t('regenerateModal.transcriptionHint')}</label>
  <textarea
    placeholder={t('regenerateModal.transcriptionHintPlaceholder')}
    value={transcriptionHint}
    onChange={(e) => setTranscriptionHint(e.target.value)}
  />

  <label>{t('regenerateModal.translationHint')}</label>
  <textarea
    placeholder={t('regenerateModal.translationHintPlaceholder')}
    value={translationHint}
    onChange={(e) => setTranslationHint(e.target.value)}
  />

  <div>
    <Button onClick={handleConfirm}>{t('regenerateModal.confirm')}</Button>
    <Button onClick={() => setShowModal(false)}>{t('regenerateModal.cancel')}</Button>
  </div>
</Modal>
```

### 5. 时间范围计算

```typescript
function calculateTimeRange(
  subtitles: SubtitleItem[],
  batchIndices: number[],
  batchSize: number
): { start: number; end: number } {
  // 根据批次索引计算对应的字幕范围
  const sortedIndices = [...batchIndices].sort((a, b) => a - b);
  const firstBatch = sortedIndices[0];
  const lastBatch = sortedIndices[sortedIndices.length - 1];

  const firstSubIndex = firstBatch * batchSize;
  const lastSubIndex = Math.min((lastBatch + 1) * batchSize - 1, subtitles.length - 1);

  return {
    start: timeToSeconds(subtitles[firstSubIndex].startTime),
    end: timeToSeconds(subtitles[lastSubIndex].endTime),
  };
}
```

### 6. 结果合并

```typescript
function mergeResults(
  original: SubtitleItem[],
  batchIndices: number[],
  newSubtitles: SubtitleItem[]
): SubtitleItem[] {
  // 计算要替换的范围
  const batchSize = settings.proofreadBatchSize;
  const firstIndex = Math.min(...batchIndices) * batchSize;
  const lastIndex = Math.min((Math.max(...batchIndices) + 1) * batchSize, original.length);

  // 生成新的 ID
  const renumbered = renumberSubtitles(newSubtitles, firstIndex + 1);

  // 替换
  const result = [...original];
  result.splice(firstIndex, lastIndex - firstIndex, ...renumbered);

  // 重新编号后续字幕 ID
  return renumberAllSubtitles(result);
}
```

## Breaking Change Analysis

| 现有功能                 | 影响   | 处理                       |
| ------------------------ | ------ | -------------------------- |
| `fix_timestamps` mode    | 删除   | 替换为 `regenerate`        |
| `getFixTimestampsPrompt` | 删除   | 可选保留备用               |
| batch/operations.ts      | 无影响 | 只删除 fix_timestamps 分支 |
| proofread mode           | 无影响 | 保持不变                   |

## Risks / Trade-offs

- **Risk**: 重新生成比原功能慢
  - Mitigation: 明确 UI 提示，用户已有心理预期
- **Risk**: 丢失用户校对过的翻译
  - Mitigation: 操作前自动创建快照
- **Risk**: 批次边界时间戳衔接
  - Mitigation: 在 mergeResults 中处理边界对齐

## Verification Plan

1. **UI 验证**：Modal 弹出、输入、确认
2. **功能验证**：时间戳精确、无漏翻
3. **取消回滚**：中断后状态恢复
4. **回归测试**：Proofread 仍正常

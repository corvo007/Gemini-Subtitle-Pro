# Change: Replace "Fix Timestamps" with "Regenerate"

## Why

现有「校对时间轴」(Fix Timestamps) 功能存在根本性缺陷：

1. **LLM 无时间感知** - LLM 无法精确感知毫秒级时间戳，输出靠"猜测"
2. **不可靠** - 结果不稳定，可能把正确的改错
3. **漏翻译未解决** - 只修时间戳，无法补充遗漏的翻译
4. **用户期望落空** - 名称暗示"修复"，实际效果差

## What Changes

用「重新生成」(Regenerate) 替换 Fix Timestamps 功能，对选中批次重跑完整 Pipeline：

### 新增文件

| 文件                                      | 描述                          |
| ----------------------------------------- | ----------------------------- |
| `services/generation/batch/regenerate.ts` | 重新生成逻辑入口              |
| `components/editor/RegenerateModal.tsx`   | 用户输入转录/翻译指引的 Modal |

### 修改文件

| 文件                                         | 变更说明                                        |
| -------------------------------------------- | ----------------------------------------------- |
| `types/subtitle.ts`                          | 更新 `BatchOperationMode` 类型                  |
| `services/generation/batch/operations.ts`    | 删除 `fix_timestamps` 逻辑                      |
| `services/api/gemini/core/prompts.ts`        | 删除 `getFixTimestampsPrompt`，添加用户指引注入 |
| `hooks/useWorkspaceLogic/useBatchActions.ts` | 更新调用逻辑                                    |
| `components/editor/BatchHeader.tsx`          | 替换按钮 + Modal 状态管理                       |
| `locales/**/*.json`                          | 国际化文案更新                                  |

### 删除功能

- `getFixTimestampsPrompt()` - 无效的时间戳修复提示词
- Fix Timestamps 相关 UI 和逻辑

---

## Architecture Design

### Pipeline 流程

```
用户选择批次 + 填写指引 (可选)
              ↓
┌─────────────────────────────────────────────────────────┐
│  Transcription (Whisper)                                │
│  - 切片选中时间段音频，重新转录                           │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│  Refinement (Gemini Flash)                              │
│  - 听音频校正转录                                        │
│  - 应用用户「转录指引」+ Glossary + SpeakerProfile        │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│  Alignment (CTC/Gemini)                                 │
│  - 精确对齐时间戳                                        │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│  Translation (Gemini Flash)                             │
│  - 翻译所有句子                                          │
│  - 应用用户「翻译指引」+ Glossary                        │
└─────────────────────────────────────────────────────────┘
              ↓
        替换原批次字幕
```

### UI 变更

| Before                      | After                            |
| --------------------------- | -------------------------------- |
| 校对时间轴 (Fix Timestamps) | 重新生成 (Regenerate)            |
| 无用户输入                  | 简单 Modal (转录指引 + 翻译指引) |

### Progress 显示

复用现有 `ProgressOverlay` 组件。

## Impact

- Affected code:
  - `types/subtitle.ts` - `BatchOperationMode` 类型
  - `services/generation/batch/operations.ts` - 删除 fix_timestamps
  - `services/api/gemini/core/prompts.ts` - 删除 `getFixTimestampsPrompt`
  - `hooks/useWorkspaceLogic/useBatchActions.ts` - 更新调用
  - `components/editor/BatchHeader.tsx` - 替换按钮 + Modal
  - `locales/**/*.json` - 国际化文案

## Decisions (Confirmed)

- ✅ 不需要「保留翻译」选项，全部重新生成
- ✅ Modal 使用简单的两个输入框
- ✅ 用户指引注入到现有预置 prompt 中
- ✅ 复用 `ProgressOverlay` 显示进度

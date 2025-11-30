# 本地 Whisper 使用指南

## 模型下载

从 [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp) 下载 GGML 格式模型。

### 推荐模型

| 模型 | 大小 | 内存 | 速度 | 精度 |
|------|------|------|------|------|
| tiny | 75 MB | ~390 MB | 最快 | 较低 |
| base | 142 MB | ~500 MB | 快 | 一般 |
| small | 466 MB | ~1 GB | 中等 | 良好 |
| medium | 1.5 GB | ~2.6 GB | 慢 | 很好 |
| large-v3 | 2.9 GB | ~4.7 GB | 最慢 | 最佳 |

**推荐**：
- 日常使用：`base` 或 `small`
- 高质量：`medium` 或 `large-v3`
- 快速预览：`tiny`

## 使用方法

1. 打开设置 → 性能选项卡
2. 勾选"使用本地 Whisper"
3. 选择下载的 .bin 文件
4. 等待状态变为"运行中"
5. 开始转录（无需 API Key）

## 故障排查

- **状态显示"错误"**: 检查模型文件路径
- **转录失败**: 确保是 GGML 格式 (.bin)
- **性能较差**: 尝试更小的模型

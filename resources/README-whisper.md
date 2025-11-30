# 本地 Whisper 使用指南

## 核心组件安装

为了使用本地 Whisper 功能，您需要下载 `whisper.cpp` 的服务端程序：

1. 访问 [whisper.cpp Releases](https://github.com/ggerganov/whisper.cpp/releases)
2. 下载最新的 Windows 版本压缩包 (例如 `whisper-bin-x64.zip`)
3. 解压所有文件
4. 找到 `server.exe` 并将其重命名为 `whisper-server.exe`
5. 将**所有解压出的文件** (包括 `.dll` 和重命名后的 `whisper-server.exe`) 放入项目的 `resources` 文件夹中

> **注意**：如果您下载的是支持 GPU 加速的版本 (如 `whisper-cublas-bin-x64.zip`)，请务必将相关的 `.dll` 文件一并复制，否则无法启用 GPU 加速。

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

# Local Whisper Setup

This project integrates [whisper.cpp](https://github.com/ggerganov/whisper.cpp) for fully offline speech recognition.

- **Included**: CPU version of Whisper (`whisper-cli.exe`) is bundled
- **Required**: Download model files (`.bin`) manually
- **GPU**: Replace with CUDA version for faster processing

## ⚡ Quick Start

1. **Download Model**: Visit [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main) for GGML models
2. **Enable Feature**: Settings > Services > Speech Recognition > "Local Whisper"
3. **Load Model**: Click "Browse" and select the `.bin` model file
4. **Ready**: Start using after model path is set

## 📦 Model Guide

| Model        | Filename            | Size   | Memory  | Speed   | Use Case     |
| :----------- | :------------------ | :----- | :------ | :------ | :----------- |
| **Tiny**     | `ggml-tiny.bin`     | 75 MB  | ~390 MB | Fastest | Quick test   |
| **Base**     | `ggml-base.bin`     | 142 MB | ~500 MB | Fast    | Casual ⭐    |
| **Small**    | `ggml-small.bin`    | 466 MB | ~1 GB   | Medium  | Podcast ⭐   |
| **Medium**   | `ggml-medium.bin`   | 1.5 GB | ~2.6 GB | Slow    | Complex      |
| **Large-v3** | `ggml-large-v3.bin` | 2.9 GB | ~4.7 GB | Slowest | Professional |

## 🛠️ GPU Acceleration (NVIDIA)

1. Download `whisper-cublas-bin-x64.zip` from [whisper.cpp Releases](https://github.com/ggerganov/whisper.cpp/releases)
2. Extract `whisper-cli.exe` and `.dll` files
3. Place in `resources` folder next to the app
4. Restart and test

# Timeline Alignment

Use forced alignment models for character-level timestamps with millisecond precision.

## 📋 Setup

1. **Download Tool**: Get `aligner-windows-x64.zip` from [Releases](https://github.com/corvo007/Gemini-Subtitle-Pro/releases), extract `align.exe`
2. **Download Model**: Get [mms-300m-1130-forced-aligner](https://huggingface.co/MahmoudAshraf/mms-300m-1130-forced-aligner) from Hugging Face
3. **Configure**:
   - Settings > Enhancement > Timeline Alignment > Mode: "CTC"
   - Settings > Enhancement > Timeline Alignment > Aligner: select `align.exe`
   - Settings > Enhancement > Timeline Alignment > Model: select model folder
4. **Enable**: Ready to use

## 🎯 How It Works

CTC-based high-precision alignment:

- Millisecond-level character alignment
- Auto-corrects Whisper timing errors
- Perfect for sync-critical subtitles

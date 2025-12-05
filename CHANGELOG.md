# Changelog

All notable changes to this project will be documented in this file.

## [2.6.0] - 2025-12-05

### Features

- **Video Compression**: Built-in FFmpeg engine supporting H.264/H.265 encoding, CRF quality control, resolution adjustment, and subtitle hardcoding.
- **Video Download**: Integrated yt-dlp for downloading videos from YouTube and Bilibili.
- **Workspace History**: New history panel showing session snapshots and persistent project history.
- **UI Improvements**: Enhanced dropdown menus to open upwards when near the screen bottom.

### Fixes

- **Compression**: Fixed error handling for `isStream` during compression.
- **UI**: Fixed CRF input field to support decimal values.
- **UI**: Fixed `CustomSelect` dropdown positioning.

### Performance

- **Gemini API**: Optimized client error handling and retry logic.

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    readAudioFile: (filePath: string) => ipcRenderer.invoke('read-audio-file', filePath),
    saveSubtitleDialog: (defaultName: string, content: string, format: 'srt' | 'ass') =>
        ipcRenderer.invoke('save-subtitle-dialog', defaultName, content, format),

    // New: Local Whisper APIs
    selectWhisperModel: () => ipcRenderer.invoke('select-whisper-model'),
    updateWhisperConfig: (config: any) => ipcRenderer.invoke('update-whisper-config', config),
    getWhisperStatus: () => ipcRenderer.invoke('get-whisper-status'),

    // FFmpeg APIs
    extractAudioFFmpeg: (videoPath: string, options?: any) =>
        ipcRenderer.invoke('extract-audio-ffmpeg', videoPath, options),
    readExtractedAudio: (audioPath: string) =>
        ipcRenderer.invoke('read-extracted-audio', audioPath),
    cleanupTempAudio: (audioPath: string) =>
        ipcRenderer.invoke('cleanup-temp-audio', audioPath),
    getAudioInfo: (videoPath: string) =>
        ipcRenderer.invoke('get-audio-info', videoPath),
    onAudioExtractionProgress: (callback: (progress: any) => void) => {
        ipcRenderer.on('audio-extraction-progress', (_event, progress) => callback(progress));
    },

    // Storage
    storage: {
        getSettings: () => ipcRenderer.invoke('storage-get'),
        setSettings: (settings: any) => ipcRenderer.invoke('storage-set', settings)
    }
});

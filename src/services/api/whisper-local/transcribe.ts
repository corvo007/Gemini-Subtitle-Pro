import { SubtitleItem } from '@/types/subtitle';
import { logger } from '@/services/utils/logger';

// Error types
class WhisperLocalError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'WhisperLocalError';
    }
}

export const transcribeWithLocalWhisper = async (
    audioBlob: Blob,
    port: number = 8080,
    timeout: number = 300000
): Promise<SubtitleItem[]> => {
    logger.info(`Starting local whisper on port ${port}`);

    // Environment check
    if (!window.electronAPI) {
        throw new WhisperLocalError('NOT_ELECTRON', '本地 Whisper 仅在桌面应用中可用');
    }

    // Status check
    const status = await window.electronAPI.getWhisperStatus();
    if (status.status !== 'running') {
        throw new WhisperLocalError('SERVER_NOT_RUNNING', '服务器未运行');
    }

    // Size check
    if (audioBlob.size > 100 * 1024 * 1024) {
        throw new WhisperLocalError('FILE_TOO_LARGE', '文件过大');
    }

    // Prepare request
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('response-format', 'json');

    // Timeout control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`http://localhost:${port}/inference`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 400) {
                throw new WhisperLocalError('INVALID_AUDIO', '音频格式不支持');
            } else {
                throw new WhisperLocalError('SERVER_ERROR', `服务器错误 (${response.status})`);
            }
        }

        const result = await response.json();
        logger.debug(`Received ${result.segments?.length || 0} segments`);

        if (!result.segments) return [];

        return result.segments.map((seg: any) => ({
            start: seg.start,
            end: seg.end,
            text: seg.text.trim()
        }));

    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new WhisperLocalError('TIMEOUT', '转录超时');
        }
        if (error instanceof WhisperLocalError) throw error;

        throw new WhisperLocalError('UNKNOWN_ERROR', error.message);
    }
};

import { type SubtitleItem } from '@/types/subtitle';
import { logger } from '@/services/utils/logger';
import i18n from '@/i18n';
import { transcribeWithWhisper } from '@/services/api/openai/whisper';
import { transcribeWithOpenAIChat } from '@/services/api/openai/chat';

export const transcribeAudio = async (
  audioBlob: Blob,
  apiKey: string,
  model: string = 'whisper-1',
  endpoint?: string,
  timeout?: number,
  useLocalWhisper?: boolean,
  localModelPath?: string,
  localThreads?: number,
  signal?: AbortSignal,
  customBinaryPath?: string
): Promise<SubtitleItem[]> => {
  // Check cancellation
  if (signal?.aborted) {
    throw new Error(i18n.t('services:pipeline.errors.cancelled'));
  }

  // Try local Whisper
  if (useLocalWhisper && window.electronAPI) {
    if (!localModelPath) {
      throw new Error(i18n.t('services:api.whisperLocal.errors.noModelPath'));
    }
    try {
      logger.debug('Attempting local whisper');
      const segments = await window.electronAPI.transcribeLocal({
        audioData: await audioBlob.arrayBuffer(),
        modelPath: localModelPath,
        language: 'auto', // TODO: Make configurable
        threads: localThreads || 4,
        customBinaryPath: customBinaryPath,
      });

      if (segments.success && segments.segments) {
        return segments.segments.map((seg, index) => ({
          id: String(index + 1),
          startTime: seg.start,
          endTime: seg.end,
          original: seg.text.trim(),
          translated: '',
        }));
      }

      throw new Error(
        segments.error || i18n.t('services:api.whisperLocal.errors.transcriptionFailed')
      );
    } catch (error: any) {
      logger.warn('Local failed, fallback to API:', error.message);

      if (apiKey) {
        // Show fallback toast
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast(
            i18n.t('services:api.whisperLocal.errors.fallbackToApi'),
            'warning'
          );
        }
        logger.info('Falling back to API');
      } else {
        throw new Error(
          `${i18n.t('services:api.whisperLocal.errors.transcriptionFailed')}: ${error.message}`
        );
      }
    }
  }

  logger.debug(`Starting transcription with model: ${model} on endpoint: ${endpoint || 'default'}`);
  if (model.includes('gpt-4o')) {
    return transcribeWithOpenAIChat(audioBlob, apiKey, model, endpoint, timeout, signal);
  } else {
    return transcribeWithWhisper(audioBlob, apiKey, model, endpoint, timeout, signal);
  }
};

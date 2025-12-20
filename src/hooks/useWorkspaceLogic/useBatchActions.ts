import { type RefObject } from 'react';
import type React from 'react';
import { useRef, useCallback } from 'react';
import { type SubtitleItem, type BatchOperationMode } from '@/types/subtitle';
import { type AppSettings } from '@/types/settings';
import { GenerationStatus, type ChunkStatus } from '@/types/api';
import { generateSrtContent, generateAssContent } from '@/services/subtitle/generator';
import { downloadFile } from '@/services/subtitle/downloader';
import { logger } from '@/services/utils/logger';
import { runBatchOperation } from '@/services/generation/batch/operations';
import { getActiveGlossaryTerms } from '@/services/glossary/utils';
import { retryGlossaryExtraction } from '@/services/generation/extractors/glossary';
import { ENV } from '@/config';
import { type GlossaryFlowProps, type SnapshotsValuesProps, type ProgressHandler } from './types';

interface UseBatchActionsProps {
  // State reading
  file: File | null;
  subtitles: SubtitleItem[];
  selectedBatches: Set<number>;
  batchComments: Record<number, string>;
  settings: AppSettings;

  // State setters
  setSubtitles: (subtitles: SubtitleItem[]) => void;
  setSelectedBatches: (batches: Set<number>) => void;
  setBatchComments: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setStatus: (status: GenerationStatus) => void;
  setError: (error: string | null) => void;
  setChunkProgress: React.Dispatch<React.SetStateAction<Record<string, ChunkStatus>>>;
  setStartTime: (time: number | null) => void;

  // Refs
  abortControllerRef: RefObject<AbortController | null>;
  audioCacheRef: RefObject<{ file: File; buffer: AudioBuffer } | null>;

  // External dependencies
  handleProgress: ProgressHandler;
  glossaryFlow: GlossaryFlowProps;
  snapshotsValues: Pick<SnapshotsValuesProps, 'createSnapshot'>;
  addToast: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    duration?: number
  ) => void;
}

interface UseBatchActionsReturn {
  handleBatchAction: (mode: BatchOperationMode, singleIndex?: number) => Promise<void>;
  handleDownload: (format: 'srt' | 'ass') => void;
  handleRetryGlossary: () => Promise<void>;
}

/**
 * Hook for batch operations, download, and glossary retry.
 */
export function useBatchActions({
  file,
  subtitles,
  selectedBatches,
  batchComments,
  settings,
  setSubtitles,
  setSelectedBatches,
  setBatchComments,
  setStatus,
  setError,
  setChunkProgress,
  setStartTime,
  abortControllerRef,
  audioCacheRef,
  handleProgress,
  glossaryFlow,
  snapshotsValues,
  addToast,
}: UseBatchActionsProps): UseBatchActionsReturn {
  // Use ref instead of state to avoid closure issues in async catch block
  const snapshotBeforeOperationRef = useRef<SubtitleItem[] | null>(null);

  const handleBatchAction = useCallback(
    async (mode: BatchOperationMode, singleIndex?: number) => {
      const indices: number[] =
        singleIndex !== undefined ? [singleIndex] : (Array.from(selectedBatches) as number[]);
      if (indices.length === 0) return;
      if (!settings.geminiKey && !ENV.GEMINI_API_KEY) {
        setError('缺少 API 密钥。');
        return;
      }
      if (mode === 'fix_timestamps' && !file) {
        setError('校对时间轴需要源视频或音频文件。');
        return;
      }

      // Save current state BEFORE operation (use ref for fresh value in catch block)
      snapshotBeforeOperationRef.current = [...subtitles];

      // Create snapshot BEFORE AI operation for user recovery
      const actionName = mode === 'fix_timestamps' ? '校对时间轴' : '润色翻译';
      const fileId = file ? window.electronAPI?.getFilePath?.(file) || file.name : '';
      const fileName = file?.name || '';
      snapshotsValues.createSnapshot(
        `${actionName}前备份`,
        subtitles,
        batchComments,
        fileId,
        fileName
      );

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setStatus(GenerationStatus.PROOFREADING);
      setError(null);
      setChunkProgress({});
      setStartTime(Date.now());
      logger.info(`Starting batch action: ${mode}`, { indices, mode });
      try {
        const refined = await runBatchOperation(
          file,
          subtitles,
          indices,
          settings,
          mode,
          batchComments,
          handleProgress,
          signal
        );
        setSubtitles(refined);
        setStatus(GenerationStatus.COMPLETED);
        setBatchComments((prev) => {
          const next = { ...prev };
          indices.forEach((idx) => delete next[idx]);
          return next;
        });
        if (singleIndex === undefined) setSelectedBatches(new Set());
        logger.info(`Batch action ${mode} completed`);
        addToast(`批量操作 '${actionName}' 完成！`, 'success');
      } catch (err: unknown) {
        const error = err as Error;
        // Check if it was a cancellation
        if (error.message === 'Operation cancelled' || signal.aborted) {
          setStatus(GenerationStatus.CANCELLED);
          logger.info('Batch operation cancelled by user');

          // Restore from snapshot (read from ref for fresh value)
          if (snapshotBeforeOperationRef.current) {
            setSubtitles(snapshotBeforeOperationRef.current);
            addToast('操作已终止，已恢复原状态', 'warning');
          } else {
            addToast('操作已终止', 'info');
          }
        } else {
          setStatus(GenerationStatus.ERROR);
          setError(`操作失败: ${error.message}`);
          logger.error(`Batch action ${mode} failed`, err);
          addToast(`操作失败：${error.message}`, 'error');
        }
      } finally {
        abortControllerRef.current = null;
        snapshotBeforeOperationRef.current = null;
      }
    },
    [
      file,
      subtitles,
      selectedBatches,
      settings,
      batchComments,
      snapshotsValues,
      addToast,

      abortControllerRef,
      handleProgress,
      setSubtitles,
      setSelectedBatches,
      setBatchComments,
      setStatus,
      setError,
      setChunkProgress,
      setStartTime,
    ]
  );

  const handleDownload = useCallback(
    (format: 'srt' | 'ass') => {
      if (subtitles.length === 0) return;
      const isBilingual = settings.outputMode === 'bilingual';
      const includeSpeaker = settings.includeSpeakerInExport || false;
      const content =
        format === 'srt'
          ? generateSrtContent(subtitles, isBilingual, includeSpeaker)
          : generateAssContent(
              subtitles,
              file ? file.name : 'video',
              isBilingual,
              includeSpeaker,
              settings.useSpeakerColors
            );
      const filename = file ? file.name.replace(/\.[^/.]+$/, '') : 'subtitles';
      logger.info(`Downloading subtitles: ${filename}.${format}`);
      void downloadFile(`${filename}.${format}`, content, format);
    },
    [
      subtitles,
      settings.outputMode,
      settings.includeSpeakerInExport,
      settings.useSpeakerColors,
      file,
    ]
  );

  const handleRetryGlossary = useCallback(async () => {
    if (!glossaryFlow.glossaryMetadata?.glossaryChunks || !audioCacheRef.current) return;

    glossaryFlow.setIsGeneratingGlossary(true);
    try {
      const apiKey = settings.geminiKey || ENV.GEMINI_API_KEY;
      const newMetadata = await retryGlossaryExtraction(
        apiKey,
        audioCacheRef.current.buffer,
        glossaryFlow.glossaryMetadata.glossaryChunks,
        settings.genre,
        settings.concurrencyPro,
        settings.geminiEndpoint,
        (settings.requestTimeout || 600) * 1000
      );

      glossaryFlow.setGlossaryMetadata(newMetadata);
      if (newMetadata.totalTerms > 0 || newMetadata.hasFailures) {
        if (newMetadata.totalTerms > 0) {
          glossaryFlow.setPendingGlossaryResults(newMetadata.results);
          glossaryFlow.setShowGlossaryConfirmation(true);
          glossaryFlow.setShowGlossaryFailure(false);
        } else {
          glossaryFlow.setShowGlossaryFailure(true); // Still failed
        }
      } else {
        // Empty results, no failure
        if (glossaryFlow.glossaryConfirmCallback) {
          glossaryFlow.glossaryConfirmCallback(getActiveGlossaryTerms(settings));
          glossaryFlow.setGlossaryConfirmCallback(null);
        }
        glossaryFlow.setShowGlossaryFailure(false);
        glossaryFlow.setGlossaryMetadata(null);
      }
    } catch (e) {
      logger.error('Retry failed', e);
      setError('Retry failed: ' + (e as Error).message);
    } finally {
      glossaryFlow.setIsGeneratingGlossary(false);
    }
  }, [glossaryFlow, settings, audioCacheRef, setError]);

  return {
    handleBatchAction,
    handleDownload,
    handleRetryGlossary,
  };
}

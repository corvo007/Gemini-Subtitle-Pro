import { useState, useEffect, useCallback } from 'react';
import { WorkspaceHistory } from '@/types/history';
import { SubtitleItem } from '@/types/subtitle';
import { GenerationStatus } from '@/types/api';
import { logger } from '@/services/utils/logger';

const MAX_HISTORIES = 5;

interface UseWorkspaceHistoryProps {
  file: File | null;
  subtitles: SubtitleItem[];
  status: GenerationStatus;
  setSubtitles: React.Dispatch<React.SetStateAction<SubtitleItem[]>>;
  setStatus: React.Dispatch<React.SetStateAction<GenerationStatus>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  loadFileFromPath: (filePath: string) => Promise<void>;
  createSnapshot: (
    description: string,
    subtitles: SubtitleItem[],
    batchComments: Record<number, string>
  ) => void;
}

export function useWorkspaceHistory({
  file,
  subtitles,
  status,
  setSubtitles,
  setStatus,
  setError,
  loadFileFromPath,
  createSnapshot,
}: UseWorkspaceHistoryProps) {
  const [histories, setHistories] = useState<WorkspaceHistory[]>([]);

  // Load histories on mount
  useEffect(() => {
    const loadHistories = async () => {
      if (!window.electronAPI?.history) return;
      try {
        const data = await window.electronAPI.history.get();
        setHistories(data || []);
      } catch (e) {
        logger.error('Failed to load histories', e);
      }
    };
    loadHistories();
  }, []);

  const getHistories = useCallback((): WorkspaceHistory[] => {
    return histories;
  }, [histories]);

  const saveHistory = useCallback(async () => {
    if (!window.electronAPI?.isElectron || !file || subtitles.length === 0) return;

    const filePath = window.electronAPI.getFilePath(file);
    if (!filePath) {
      logger.debug('Cannot save history: file path not available (file selected via HTML input)');
      return;
    }

    // Remove existing entry for same file
    const filtered = histories.filter((h) => h.filePath !== filePath);

    const newHistory: WorkspaceHistory = {
      id: Date.now().toString(),
      filePath,
      fileName: file.name,
      subtitles,
      savedAt: new Date().toISOString(),
    };

    // Add new entry at the beginning, limit to MAX_HISTORIES
    const updated = [newHistory, ...filtered].slice(0, MAX_HISTORIES);

    try {
      await window.electronAPI.history.save(updated);
      setHistories(updated);
      logger.info('Saved workspace history', {
        fileName: file.name,
        subtitleCount: subtitles.length,
      });
    } catch (e) {
      logger.error('Failed to save history', e);
    }
  }, [file, subtitles, histories]);

  const deleteHistory = useCallback(async (id: string) => {
    if (!window.electronAPI?.history) return;
    try {
      await window.electronAPI.history.delete(id);
      setHistories((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      logger.error('Failed to delete history', e);
    }
  }, []);

  const loadHistory = useCallback(
    async (history: WorkspaceHistory) => {
      try {
        await loadFileFromPath(history.filePath);
        setSubtitles(history.subtitles);
        setStatus(GenerationStatus.COMPLETED);
        createSnapshot('从历史恢复', history.subtitles, {});
        logger.info('Loaded workspace history', { fileName: history.fileName });
      } catch (e: any) {
        logger.error('Failed to load history', e);
        setError('无法加载历史: ' + e.message);
      }
    },
    [loadFileFromPath, setSubtitles, setStatus, createSnapshot, setError]
  );

  // Auto-save history when subtitles are generated/imported
  useEffect(() => {
    if (status === GenerationStatus.COMPLETED && subtitles.length > 0 && file) {
      saveHistory();
    }
  }, [status, subtitles.length, file, saveHistory]);

  return {
    histories,
    getHistories,
    saveHistory,
    loadHistory,
    deleteHistory,
  };
}

import { useCallback } from 'react';
import { SubtitleItem } from '@/types/subtitle';

interface UseSubtitleCRUDProps {
  setSubtitles: React.Dispatch<React.SetStateAction<SubtitleItem[]>>;
}

export function useSubtitleCRUD({ setSubtitles }: UseSubtitleCRUDProps) {
  const updateSubtitleText = useCallback(
    (id: number, text: string) => {
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, translated: text } : s)));
    },
    [setSubtitles]
  );

  const updateSubtitleOriginal = useCallback(
    (id: number, text: string) => {
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, original: text } : s)));
    },
    [setSubtitles]
  );

  const updateSpeaker = useCallback(
    (id: number, speaker: string | undefined) => {
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, speaker } : s)));
    },
    [setSubtitles]
  );

  const updateSubtitleTime = useCallback(
    (id: number, startTime: string, endTime: string) => {
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, startTime, endTime } : s)));
    },
    [setSubtitles]
  );

  const updateLineComment = useCallback(
    (id: number, comment: string) => {
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, comment } : s)));
    },
    [setSubtitles]
  );

  const deleteSubtitle = useCallback(
    (id: number) => {
      setSubtitles((prev) => prev.filter((s) => s.id !== id));
    },
    [setSubtitles]
  );

  const deleteMultipleSubtitles = useCallback(
    (ids: number[]) => {
      const idSet = new Set(ids);
      setSubtitles((prev) => prev.filter((s) => !idSet.has(s.id)));
    },
    [setSubtitles]
  );

  return {
    updateSubtitleText,
    updateSubtitleOriginal,
    updateSpeaker,
    updateSubtitleTime,
    updateLineComment,
    deleteSubtitle,
    deleteMultipleSubtitles,
  };
}

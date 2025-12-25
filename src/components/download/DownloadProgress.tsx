/**
 * Download Progress Component - Tailwind CSS Version
 */
import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DownloadProgress as Progress } from '@/types/download';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface DownloadProgressProps {
  progress: Progress | null;
  onCancel: () => void;
}

export function DownloadProgress({ progress, onCancel }: DownloadProgressProps) {
  const { t } = useTranslation('ui');

  const getStageLabel = () => {
    if (!progress) return t('download.preparing');
    switch (progress.stage) {
      case 'video':
        return t('download.downloadingVideo');
      case 'audio':
        return t('download.downloadingAudio');
      case 'merging':
        return t('download.merging');
      default:
        return t('download.downloading');
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-white/80 font-medium">{getStageLabel()}</span>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-transparent border border-red-500/50 rounded-md text-red-400 text-sm
                        transition-colors hover:bg-red-500/10"
        >
          <span className="flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> {t('download.cancel')}
          </span>
        </button>
      </div>

      {/* Progress Bar */}
      <ProgressBar
        percent={progress?.percent || 0}
        indeterminate={!progress}
        size="sm"
        className="mb-3"
      />

      {/* Stats */}
      <div className="flex justify-between text-sm text-white/50">
        {progress ? (
          <>
            <span>{progress.percent.toFixed(1)}%</span>
            <span>{progress.speed}</span>
            <span>{t('download.eta', { time: progress.eta })}</span>
          </>
        ) : (
          <span>{t('download.connecting')}</span>
        )}
      </div>
    </div>
  );
}

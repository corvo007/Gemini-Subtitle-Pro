/**
 * Quality Selector Component - Tailwind CSS Version
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoFormat } from '@/types/download';
import { cn } from '@/lib/cn';

interface QualitySelectorProps {
  formats: VideoFormat[];
  selectedFormat: string;
  onSelect: (formatId: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function QualitySelector({
  formats,
  selectedFormat,
  onSelect,
  disabled,
  label,
  className = '',
}: QualitySelectorProps) {
  const { t } = useTranslation('download');
  const displayLabel = label || t('qualityLabel');

  const formatFilesize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className={className}>
      <label className="block text-sm text-white/60 mb-3">{displayLabel}</label>
      <div className="flex flex-wrap gap-2 md:gap-3">
        {formats.map((format) => (
          <button
            key={format.formatId}
            type="button"
            onClick={() => !disabled && onSelect(format.formatId)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm transition-colors border',
              selectedFormat === format.formatId
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {format.quality}
            {format.filesize && (
              <span className="ml-2 text-white/40 text-xs">~{formatFilesize(format.filesize)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

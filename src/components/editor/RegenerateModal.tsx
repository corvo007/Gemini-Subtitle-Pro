import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RefreshCw } from 'lucide-react';
import { type RegeneratePrompts } from '@/types/subtitle';
import { cn } from '@/lib/cn';

interface RegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (prompts: RegeneratePrompts) => void;
  selectedCount: number;
}

export const RegenerateModal: React.FC<RegenerateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}) => {
  const { t } = useTranslation('editor');
  const [transcriptionHint, setTranscriptionHint] = useState('');
  const [translationHint, setTranslationHint] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      transcriptionHint: transcriptionHint.trim() || undefined,
      translationHint: translationHint.trim() || undefined,
    });
    // Reset state
    setTranscriptionHint('');
    setTranslationHint('');
  };

  const handleClose = () => {
    setTranscriptionHint('');
    setTranslationHint('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t('regenerateModal.title')}</h3>
              <p className="text-xs text-slate-400">
                {t('regenerateModal.subtitle', { count: selectedCount })}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Info */}
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
            <p className="text-xs text-slate-400">{t('regenerateModal.info')}</p>
          </div>

          {/* Transcription Hint */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {t('regenerateModal.transcriptionHint')}
            </label>
            <textarea
              value={transcriptionHint}
              onChange={(e) => setTranscriptionHint(e.target.value)}
              placeholder={t('regenerateModal.transcriptionHintPlaceholder')}
              className="w-full h-20 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          {/* Translation Hint */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {t('regenerateModal.translationHint')}
            </label>
            <textarea
              value={translationHint}
              onChange={(e) => setTranslationHint(e.target.value)}
              placeholder={t('regenerateModal.translationHintPlaceholder')}
              className="w-full h-20 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            {t('regenerateModal.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
            )}
          >
            <RefreshCw className="w-4 h-4" />
            {t('regenerateModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

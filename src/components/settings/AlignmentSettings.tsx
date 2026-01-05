import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { type AppSettings } from '@/types/settings';
import { logger } from '@/services/utils/logger';

interface AlignmentSettingsProps {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => void;
  addToast: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
}

export const AlignmentSettings: React.FC<AlignmentSettingsProps> = ({
  settings,
  updateSetting,
  addToast,
}) => {
  const { t } = useTranslation('settings');

  // CTC alignment requires Electron environment (uses IPC for native process)
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

  // Build alignment mode options - CTC only available in Electron
  const alignmentOptions = [
    { value: 'none', label: t('enhance.alignment.modeOptions.none') },
    ...(isElectron ? [{ value: 'ctc', label: t('enhance.alignment.modeOptions.ctc') }] : []),
    { value: 'llm', label: t('enhance.alignment.modeOptions.llm') },
  ];

  // Handle aligner executable selection
  const handleSelectAligner = async () => {
    if (!window.electronAPI) {
      console.error('[AlignmentSettings] electronAPI not available for selection');
      return;
    }
    try {
      const result = await window.electronAPI.selectAlignerExecutable();
      if (result && result.success && result.path) {
        updateSetting('alignerPath', result.path);
      } else if (result && result.error) {
        addToast(t('enhance.alignment.selectError', { error: result.error }), 'error');
        console.error('[AlignmentSettings] Aligner selection error:', result.error);
      }
    } catch (error: any) {
      logger.error('[AlignmentSettings] Aligner selection failed', error);
      addToast(t('enhance.alignment.selectErrorGeneric'), 'error');
    }
  };

  // Handle model directory selection
  const handleSelectModelDir = async () => {
    if (!window.electronAPI) {
      console.error('[AlignmentSettings] electronAPI not available for selection');
      return;
    }
    try {
      const result = await window.electronAPI.selectAlignerModelDir();
      if (result && result.success && result.path) {
        updateSetting('alignmentModelPath', result.path);
      } else if (result && result.error) {
        addToast(t('enhance.alignment.selectError', { error: result.error }), 'error');
        console.error('[AlignmentSettings] Model dir selection error:', result.error);
      }
    } catch (error: any) {
      logger.error('[AlignmentSettings] Model dir selection failed', error);
      addToast(t('enhance.alignment.selectErrorGeneric'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {t('enhance.alignment.mode')}
        </label>
        <CustomSelect
          value={settings.alignmentMode || 'none'}
          onChange={(val) => updateSetting('alignmentMode', val)}
          options={alignmentOptions}
          icon={<Crosshair className="w-4 h-4" />}
        />
        <p className="text-xs text-slate-500 mt-1">{t('enhance.alignment.modeHint')}</p>
      </div>

      {/* CTC-specific settings */}
      {settings.alignmentMode === 'ctc' && (
        <div className="space-y-4 p-4 border border-slate-700 rounded-lg bg-slate-800/50 animate-fade-in">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-slate-200">
              {t('enhance.alignment.ctcConfig')}
            </h3>
            <p className="text-xs text-slate-500">{t('enhance.alignment.ctcConfigDesc')}</p>
          </div>

          {/* Aligner Path */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t('enhance.alignment.alignerPath')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.alignerPath || ''}
                placeholder={t('enhance.alignment.alignerPathPlaceholder')}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-700 rounded bg-slate-900 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
              <button
                onClick={handleSelectAligner}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors text-sm"
              >
                {t('enhance.alignment.browseButton')}
              </button>
            </div>
          </div>

          {/* Model Path */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t('enhance.alignment.modelPath')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.alignmentModelPath || ''}
                placeholder={t('enhance.alignment.modelPathPlaceholder')}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-700 rounded bg-slate-900 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
              <button
                onClick={handleSelectModelDir}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors text-sm"
              >
                {t('enhance.alignment.browseButton')}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-700/50">
            <p className="font-medium mb-1 text-slate-300">{t('enhance.alignment.instructions')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('enhance.alignment.instructionAligner')}</li>
              <li>{t('enhance.alignment.instructionModel')}</li>
            </ul>
          </div>
        </div>
      )}

      {/* LLM mode hint */}
      {settings.alignmentMode === 'llm' && (
        <div className="text-xs text-amber-400 bg-amber-900/20 p-3 rounded border border-amber-500/30 animate-fade-in">
          {t('enhance.alignment.llmHint')}
        </div>
      )}
    </div>
  );
};

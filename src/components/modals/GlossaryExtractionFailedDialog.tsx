import React from 'react';
import { AlertCircle, Loader2, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';

interface GlossaryExtractionFailedDialogProps {
  isOpen: boolean;
  isGeneratingGlossary: boolean;
  glossaryConfirmCallback: ((glossary: any[]) => void) | null;
  onRetry: () => void;
  onContinue: () => void;
}

export const GlossaryExtractionFailedDialog: React.FC<GlossaryExtractionFailedDialogProps> = ({
  isOpen,
  isGeneratingGlossary,
  glossaryConfirmCallback,
  onRetry,
  onContinue,
}) => {
  const { t } = useTranslation('modals');

  if (!glossaryConfirmCallback) return null;

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth="md" zIndex={60} showCloseButton={false}>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white">
          {t('glossaryConfirmation.extractionFailed.title')}
        </h3>
        <p className="text-slate-400 text-sm">
          {t('glossaryConfirmation.extractionFailed.description')}
        </p>
        <div className="flex flex-col space-y-2 pt-4">
          <button
            onClick={onRetry}
            disabled={isGeneratingGlossary}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center"
          >
            {isGeneratingGlossary ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCcw className="w-4 h-4 mr-2" />
            )}
            {isGeneratingGlossary
              ? t('glossaryConfirmation.extractionFailed.retryProcessing')
              : t('glossaryConfirmation.extractionFailed.retry')}
          </button>
          <button
            onClick={onContinue}
            disabled={isGeneratingGlossary}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors"
          >
            {t('glossaryConfirmation.extractionFailed.continue')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

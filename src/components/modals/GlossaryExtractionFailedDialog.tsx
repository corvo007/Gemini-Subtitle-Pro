import React from 'react';
import { AlertCircle, Loader2, RefreshCcw } from 'lucide-react';
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
  if (!glossaryConfirmCallback) return null;

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth="md" zIndex={60} showCloseButton={false}>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white">术语提取失败</h3>
        <p className="text-slate-400 text-sm">
          无法从音频中提取术语，可能是网络问题或音频质量不佳。
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
            {isGeneratingGlossary ? '正在重试...' : '重试提取'}
          </button>
          <button
            onClick={onContinue}
            disabled={isGeneratingGlossary}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors"
          >
            跳过 (继续而不使用新术语)
          </button>
        </div>
      </div>
    </Modal>
  );
};

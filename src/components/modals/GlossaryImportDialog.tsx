import React, { useState, useEffect } from 'react';
import { FileText, Plus, Merge, X, CheckCircle } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { type Glossary } from '@/types/glossary';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { cn } from '@/lib/cn';

export type ImportMode = 'create' | 'merge';
export type ConflictMode = 'skip' | 'overwrite';

interface GlossaryImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    mode: ImportMode,
    targetId: string | null,
    conflictMode: ConflictMode,
    newName: string | null
  ) => void;
  glossaries: Glossary[];
  importCount: number;
  defaultName: string;
}

export const GlossaryImportDialog: React.FC<GlossaryImportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  glossaries,
  importCount,
  defaultName,
}) => {
  const { t } = useTranslation('modals');
  const [mode, setMode] = useState<ImportMode>('create');
  const [newName, setNewName] = useState(defaultName);
  const [targetId, setTargetId] = useState<string>(glossaries.length > 0 ? glossaries[0].id : '');
  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');

  useEffect(() => {
    if (isOpen) {
      setNewName(defaultName);
      if (glossaries.length > 0) {
        setTargetId(glossaries[0].id);
      }
      setMode('create');
      setConflictMode('skip');
    }
  }, [isOpen, defaultName, glossaries]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (mode === 'create' && !newName.trim()) return;
    if (mode === 'merge' && !targetId) return;

    onConfirm(
      mode,
      mode === 'merge' ? targetId : null,
      conflictMode,
      mode === 'create' ? newName : null
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="text-xl font-bold text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-400" />
            {t('glossaryImport.title')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 flex items-start space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-full">
              <CheckCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-300">{t('glossaryImport.ready')}</h4>
              <p className="text-sm text-slate-400 mt-1">
                <Trans
                  i18nKey="modals:glossaryImport.readCount"
                  count={importCount}
                  components={{ 1: <span className="text-white font-bold" /> }}
                />
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-300">
              {t('glossaryImport.selectMode')}
            </label>

            <div className="grid grid-cols-1 gap-3">
              {/* Option 1: Create New */}
              <div
                onClick={() => setMode('create')}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all',
                  mode === 'create'
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center',
                      mode === 'create' ? 'border-indigo-500' : 'border-slate-500'
                    )}
                  >
                    {mode === 'create' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white flex items-center">
                      <Plus className="w-4 h-4 mr-2" /> {t('glossaryImport.create')}
                    </div>
                  </div>
                </div>

                {mode === 'create' && (
                  <div className="mt-4 pl-8 animate-fade-in">
                    <label className="block text-xs text-slate-400 mb-1">
                      {t('glossaryImport.nameLabel')}
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder={t('glossaryImport.namePlaceholder')}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>

              {/* Option 2: Merge */}
              <div
                onClick={() => setMode('merge')}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all',
                  mode === 'merge'
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center',
                      mode === 'merge' ? 'border-indigo-500' : 'border-slate-500'
                    )}
                  >
                    {mode === 'merge' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white flex items-center">
                      <Merge className="w-4 h-4 mr-2" /> {t('glossaryImport.merge')}
                    </div>
                  </div>
                </div>

                {mode === 'merge' && (
                  <div className="mt-4 pl-8 space-y-4 animate-fade-in">
                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="block text-xs text-slate-400 mb-1">
                        {t('glossaryImport.targetLabel')}
                      </label>
                      <CustomSelect
                        value={targetId}
                        onChange={(val) => setTargetId(val)}
                        options={glossaries.map((g) => ({ value: g.id, label: g.name }))}
                        className="w-full"
                        placeholder={t('glossaryImport.selectPlaceholder')}
                      />
                    </div>

                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                      <label className="block text-xs text-slate-400 mb-2">
                        {t('glossaryImport.conflictLabel')}
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <div
                            className={cn(
                              'w-4 h-4 rounded-full border flex items-center justify-center transition-all',
                              conflictMode === 'skip' ? 'border-indigo-500' : 'border-slate-500'
                            )}
                          >
                            {conflictMode === 'skip' && (
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            )}
                          </div>
                          <span className="text-sm text-slate-300">{t('glossaryImport.skip')}</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <div
                            className={cn(
                              'w-4 h-4 rounded-full border flex items-center justify-center transition-all',
                              conflictMode === 'overwrite'
                                ? 'border-indigo-500'
                                : 'border-slate-500'
                            )}
                          >
                            {conflictMode === 'overwrite' && (
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            )}
                          </div>
                          <span className="text-sm text-slate-300">
                            {t('glossaryImport.overwrite')}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t('glossaryImport.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={(mode === 'create' && !newName.trim()) || (mode === 'merge' && !targetId)}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {t('glossaryImport.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

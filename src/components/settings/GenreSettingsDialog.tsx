import React, { useState, useEffect } from 'react';
import { Clapperboard, X } from 'lucide-react';
import { GENRE_PRESETS, GENRE_LABELS } from '@/types/settings';
import { OptionButton } from '@/components/ui/OptionButton';

interface GenreSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentGenre: string;
  onSave: (genre: string) => void;
}

export const GenreSettingsDialog: React.FC<GenreSettingsDialogProps> = ({
  isOpen,
  onClose,
  currentGenre,
  onSave,
}) => {
  const [tempGenre, setTempGenre] = useState(currentGenre);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (GENRE_PRESETS.includes(currentGenre)) {
        setTempGenre(currentGenre);
        setCustomInput('');
      } else {
        setTempGenre('custom');
        setCustomInput(currentGenre);
      }
    }
  }, [isOpen, currentGenre]);

  const handleSave = () => {
    onSave(tempGenre === 'custom' ? customInput : tempGenre);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center">
            <Clapperboard className="w-5 h-5 mr-2 text-indigo-400" /> 内容类型设置
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">选择预设</label>
            <div className="grid grid-cols-2 gap-2">
              {GENRE_PRESETS.map((g) => (
                <OptionButton key={g} selected={tempGenre === g} onClick={() => setTempGenre(g)}>
                  {GENRE_LABELS[g] || g}
                </OptionButton>
              ))}
              <OptionButton
                selected={tempGenre === 'custom'}
                onClick={() => setTempGenre('custom')}
              >
                自定义...
              </OptionButton>
            </div>
          </div>
          {tempGenre === 'custom' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                自定义内容类型
              </label>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="例如：游戏解说、医学讲座、科技评测..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-colors"
          >
            保存更改
          </button>
        </div>
      </div>
    </div>
  );
};

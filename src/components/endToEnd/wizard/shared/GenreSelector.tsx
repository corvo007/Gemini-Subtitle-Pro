import React, { useState } from 'react';
import { Film } from 'lucide-react';

/** 内容类型选择器 - 复刻自 GenreSettingsDialog */
export const GENRE_PRESETS = ['general', 'anime', 'movie', 'news', 'tech'];
export const GENRE_LABELS: Record<string, string> = {
  general: '通用',
  anime: '动漫',
  movie: '电影/剧集',
  news: '新闻',
  tech: '科技',
};

export function GenreSelector({
  currentGenre,
  onGenreChange,
}: {
  currentGenre: string;
  onGenreChange: (genre: string) => void;
}) {
  const isCustom = !GENRE_PRESETS.includes(currentGenre);
  const [showCustomInput, setShowCustomInput] = useState(isCustom);
  const [customValue, setCustomValue] = useState(isCustom ? currentGenre : '');

  const handlePresetClick = (genre: string) => {
    setShowCustomInput(false);
    setCustomValue('');
    onGenreChange(genre);
  };

  const handleCustomClick = () => {
    setShowCustomInput(true);
  };

  const handleCustomChange = (value: string) => {
    setCustomValue(value);
    if (value.trim()) {
      onGenreChange(value.trim());
    }
  };

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <label className="block text-sm font-medium text-white/80 mb-3">
        <Film className="w-4 h-4 inline mr-2" />
        内容类型
      </label>
      <div className="grid grid-cols-3 gap-2">
        {GENRE_PRESETS.map((genre) => (
          <button
            key={genre}
            onClick={() => handlePresetClick(genre)}
            className={`px-3 py-2 rounded-lg text-sm border transition-all ${
              currentGenre === genre && !showCustomInput
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {GENRE_LABELS[genre] || genre}
          </button>
        ))}
        <button
          onClick={handleCustomClick}
          className={`px-3 py-2 rounded-lg text-sm border transition-all ${
            showCustomInput
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          自定义...
        </button>
      </div>
      {showCustomInput && (
        <div className="mt-3">
          <input
            type="text"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="例如：游戏解说、医学讲座、科技评测..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/50 placeholder-white/40"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

/** 行内内容类型选择器 */
export function GenreSelectorInline({
  currentGenre,
  onGenreChange,
}: {
  currentGenre: string;
  onGenreChange: (genre: string) => void;
}) {
  const isCustom = !GENRE_PRESETS.includes(currentGenre);
  const [showCustomInput, setShowCustomInput] = useState(isCustom);
  const [customValue, setCustomValue] = useState(isCustom ? currentGenre : '');

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {GENRE_PRESETS.map((genre) => (
          <button
            key={genre}
            onClick={() => {
              setShowCustomInput(false);
              onGenreChange(genre);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              currentGenre === genre && !showCustomInput
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            {GENRE_LABELS[genre] || genre}
          </button>
        ))}
        <button
          onClick={() => setShowCustomInput(true)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
            showCustomInput
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
          }`}
        >
          自定义...
        </button>
      </div>
      {showCustomInput && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            if (e.target.value.trim()) onGenreChange(e.target.value.trim());
          }}
          placeholder="例如：游戏解说、医学讲座..."
          className="mt-2 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/50 placeholder-white/40"
          autoFocus
        />
      )}
    </>
  );
}

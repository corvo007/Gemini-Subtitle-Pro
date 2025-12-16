import React from 'react';
import { cn } from '@/lib/cn';

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'indigo' | 'violet';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export const OptionButton: React.FC<OptionButtonProps> = ({
  selected,
  onClick,
  children,
  color = 'indigo',
  size = 'sm',
  fullWidth = false,
  className = '',
}) => {
  const colorClasses = {
    indigo: selected
      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700',
    violet: selected
      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10',
  };

  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'p-3',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg text-sm border transition-all flex items-center justify-center space-x-2',
        sizeClasses[size],
        colorClasses[color],
        fullWidth && 'w-full',
        className
      )}
    >
      {children}
    </button>
  );
};

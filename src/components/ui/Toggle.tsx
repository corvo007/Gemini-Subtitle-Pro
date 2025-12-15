import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: 'indigo' | 'violet' | 'emerald' | 'amber';
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  color = 'indigo',
}) => {
  const colorClasses = {
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-colors relative ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${checked ? colorClasses[color] : 'bg-slate-600'}`}
    >
      <div
        className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
};

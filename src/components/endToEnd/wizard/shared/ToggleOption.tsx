import React from 'react';

/** 切换选项组件 */
export function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer transition-colors hover:bg-white/8"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-white text-sm">{label}</div>
          <div className="text-xs text-white/50">{description}</div>
        </div>
        <div
          className={`w-10 h-6 rounded-full transition-colors relative ${
            checked ? 'bg-violet-500' : 'bg-white/20'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

/** 行内切换选项（更紧凑） */
export function ToggleOptionInline({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 cursor-pointer group"
      onClick={() => onChange(!checked)}
    >
      <div className="flex-1">
        <div className="text-sm text-white group-hover:text-violet-300 transition-colors">
          {label}
        </div>
        {description && <div className="text-xs text-white/40">{description}</div>}
      </div>
      <div
        className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
          checked ? 'bg-violet-500' : 'bg-white/20'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
    </div>
  );
}

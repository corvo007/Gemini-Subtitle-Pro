import React from 'react';
import { ChevronDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDropdown } from '@/hooks/useDropdown';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: React.ReactNode | string; disabled?: boolean }[];
  className?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  forceDropUp?: boolean; // Force dropdown to always expand upward
}

import { Portal } from './Portal';

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  icon,
  placeholder,
  forceDropUp,
}) => {
  const {
    isOpen,
    setIsOpen,
    toggle,
    triggerRef: containerRef,
    contentRef: dropdownRef,
    coords,
    direction: { dropUp: autoDropUp },
  } = useDropdown<HTMLDivElement, HTMLDivElement>({
    closeOnScroll: false,
    recalculateOnScroll: true,
  });

  const dropUp = forceDropUp !== undefined ? forceDropUp : autoDropUp;

  // Manual close if needed (optionally exposed)
  // const close = () => setIsOpen(false);

  // Memoize selected label to avoid .find() on every render (Audit fix)
  const selectedLabel = React.useMemo(
    () => options.find((opt) => opt.value === value)?.label || placeholder || value,
    [options, value, placeholder]
  );

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-3 text-slate-700 focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10 text-sm transition-all hover:bg-slate-50 hover:border-slate-300 shadow-sm"
      >
        <div className="flex items-center text-left overflow-hidden">
          {icon && <span className="mr-2 text-slate-400 shrink-0">{icon}</span>}
          <span className="block truncate font-medium">{selectedLabel}</span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && coords && (
        <Portal>
          <div
            ref={dropdownRef}
            className={cn(
              'custom-select-dropdown fixed z-100 bg-white border border-slate-200 rounded-lg shadow-xl shadow-slate-200/50 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100'
            )}
            style={{
              left: coords.left,
              width: coords.width,
              top: dropUp ? undefined : coords.bottom + 4,
              bottom: dropUp ? window.innerHeight - coords.top + 4 : undefined,
            }}
          >
            <div className="p-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  disabled={option.disabled}
                  onClick={() => {
                    if (!option.disabled) {
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between',
                    option.disabled && 'opacity-40 cursor-not-allowed text-slate-400',
                    !option.disabled &&
                      value === option.value &&
                      'bg-brand-purple/10 text-brand-purple font-medium',
                    !option.disabled &&
                      value !== option.value &&
                      'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <div className={typeof option.label === 'string' ? 'truncate' : ''}>
                    {option.label}
                  </div>
                  {value === option.value && !option.disabled && (
                    <CheckCircle className="w-3 h-3 text-brand-purple shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

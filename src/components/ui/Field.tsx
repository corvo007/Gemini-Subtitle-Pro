import React from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label?: React.ReactNode;
  labelClassName?: string;
  description?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  id?: string; // Optional ID for label-input association
}

export const Field: React.FC<FieldProps> = ({
  label,
  labelClassName,
  description,
  error,
  className,
  children,
  id,
}) => {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn('block text-sm font-medium text-slate-700', labelClassName)}
        >
          {label}
        </label>
      )}
      {children}
      {description && <p className="text-xs text-slate-500">{description}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

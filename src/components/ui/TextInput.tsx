import React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ icon, error, className = '', ...props }) => (
  <div className="relative">
    {icon && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
    )}
    <input
      className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-slate-200 
        focus:outline-none focus:border-indigo-500 text-sm
        ${icon ? 'pl-10' : ''} 
        ${error ? 'border-red-500' : ''} 
        ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
  </div>
);

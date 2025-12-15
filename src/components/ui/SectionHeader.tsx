import React from 'react';

interface SectionHeaderProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ children, icon, className = '' }) => (
  <h3
    className={`text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 ${className}`}
  >
    {icon}
    {children}
  </h3>
);

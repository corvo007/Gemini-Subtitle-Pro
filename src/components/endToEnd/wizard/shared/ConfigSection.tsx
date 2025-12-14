import React from 'react';

/** 配置区块组件 */
export function ConfigSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <span className="text-violet-400">{icon}</span>
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

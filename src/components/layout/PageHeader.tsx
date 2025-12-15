import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  /** 主标题 */
  title: string | React.ReactNode;
  /** 副标题 */
  subtitle?: string;
  /** 左侧图标（如果提供，则显示图标容器；否则显示返回按钮） */
  icon?: React.ReactNode;
  /** 返回按钮回调（如果提供，则显示返回按钮） */
  onBack?: () => void;
  /** 右侧按钮区域 */
  actions?: React.ReactNode;
}

/**
 * 通用页面头部组件
 * 统一所有页面的 header 样式，使用响应式尺寸
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  onBack,
  actions,
}) => {
  return (
    <header
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-800 shrink-0 window-drag-region"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        {/* 返回按钮或图标 */}
        {onBack ? (
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        ) : icon ? (
          <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
            {icon}
          </div>
        ) : null}

        {/* 标题区域 */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
            {typeof title === 'string' ? <span className="truncate">{title}</span> : title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-[300px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* 右侧按钮区域 */}
      {actions && (
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
};

/**
 * 通用头部按钮组件
 * 统一按钮样式
 */
interface HeaderButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  title?: string;
  /** 图标悬浮颜色 */
  hoverColor?: 'blue' | 'indigo' | 'emerald' | 'amber';
  /** 是否高亮显示 */
  highlighted?: boolean;
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  onClick,
  icon,
  label,
  title,
  hoverColor = 'blue',
  highlighted = false,
}) => {
  const hoverColorClass = {
    blue: 'group-hover:text-blue-400',
    indigo: 'group-hover:text-indigo-400',
    emerald: 'group-hover:text-emerald-400',
    amber: 'group-hover:text-amber-400',
  }[hoverColor];

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 border rounded-lg transition-colors text-xs sm:text-sm font-medium group ${
        highlighted
          ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-200'
          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
      }`}
      title={title}
    >
      <span className={`text-slate-400 ${hoverColorClass} transition-colors`}>{icon}</span>
      {label && <span className="hidden sm:inline group-hover:text-white">{label}</span>}
    </button>
  );
};

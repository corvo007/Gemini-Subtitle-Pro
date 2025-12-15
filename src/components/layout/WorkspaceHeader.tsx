import React from 'react';
import { GitCommit, FileText, Book, Settings } from 'lucide-react';
import { PageHeader, HeaderButton } from './PageHeader';

interface WorkspaceHeaderProps {
  title: string;
  modeLabel: string;
  subtitleInfo: string;
  onBack: () => void;
  showSnapshots: boolean;
  onToggleSnapshots: () => void;
  hasSnapshots: boolean;
  onShowLogs: () => void;
  onShowGlossary: () => void;
  onShowSettings: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  title,
  modeLabel,
  subtitleInfo,
  onBack,
  showSnapshots,
  onToggleSnapshots,
  hasSnapshots,
  onShowLogs,
  onShowGlossary,
  onShowSettings,
}) => {
  return (
    <PageHeader
      title={
        <>
          <span className="truncate">{title}</span>
          <span className="text-[10px] sm:text-xs font-normal text-slate-500 bg-slate-900 border border-slate-800 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">
            {modeLabel}
          </span>
        </>
      }
      subtitle={subtitleInfo}
      onBack={onBack}
      actions={
        <>
          <HeaderButton
            onClick={onToggleSnapshots}
            icon={<GitCommit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            label="历史"
            title="历史记录"
            highlighted={hasSnapshots}
          />
          <HeaderButton
            onClick={onShowLogs}
            icon={<FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            label="日志"
            title="查看日志"
            hoverColor="blue"
          />
          <HeaderButton
            onClick={onShowGlossary}
            icon={<Book className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            label="术语表"
            title="术语表管理"
            hoverColor="indigo"
          />
          <HeaderButton
            onClick={onShowSettings}
            icon={<Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            label="设置"
            hoverColor="emerald"
          />
        </>
      }
    />
  );
};

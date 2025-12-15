import React from 'react';
import { Languages, FileText, Book, Settings } from 'lucide-react';
import { PageHeader, HeaderButton } from './PageHeader';

interface HeaderProps {
  onShowLogs?: () => void;
  onShowGlossary?: () => void;
  onShowSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onShowLogs, onShowGlossary, onShowSettings }) => {
  return (
    <PageHeader
      title={
        <>
          <span className="text-indigo-400">Gemini</span> Subtitle Pro
        </>
      }
      subtitle="AI 字幕生成与翻译工具"
      icon={<Languages className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
      actions={
        <>
          {onShowLogs && (
            <HeaderButton
              onClick={onShowLogs}
              icon={<FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              label="日志"
              title="查看日志"
              hoverColor="blue"
            />
          )}
          {onShowGlossary && (
            <HeaderButton
              onClick={onShowGlossary}
              icon={<Book className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              label="术语表"
              title="术语表管理"
              hoverColor="indigo"
            />
          )}
          {onShowSettings && (
            <HeaderButton
              onClick={onShowSettings}
              icon={<Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              label="设置"
              hoverColor="emerald"
            />
          )}
        </>
      }
    />
  );
};

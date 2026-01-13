import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, X } from 'lucide-react';
import { type AppSettings } from '@/types/settings';
import { cn } from '@/lib/cn';
import { GeneralTab, ServicesTab, PerformanceTab, EnhanceTab, DebugTab, AboutTab } from './tabs';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  envGeminiKey: string;
  envOpenaiKey: string;
  onOpenGlossaryManager: () => void;
  addToast: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSetting,
  activeTab,
  setActiveTab,
  envGeminiKey,
  envOpenaiKey,
  onOpenGlossaryManager,
  addToast,
}) => {
  const { t } = useTranslation('settings');

  if (!isOpen) return null;

  // Common props for tabs that need settings access
  const tabProps = { settings, updateSetting };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl animate-fade-in relative overflow-hidden"
        style={{ maxHeight: 'calc(var(--app-height-safe, 100vh) * 0.9)' }}
      >
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-indigo-400" /> {t('title')}
          </h2>

          {/* Tab Navigation */}
          <div className="flex space-x-1 border-b border-slate-700 mb-6 overflow-x-auto">
            {[
              'general',
              'services',
              'performance',
              'enhance',
              'about',
              ...(window.electronAPI?.isDebug ? ['debug'] : []),
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap',
                  activeTab === tab
                    ? 'bg-slate-800 text-indigo-400 border-t border-x border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )}
              >
                {t(`tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6 min-h-[400px]">
            {activeTab === 'general' && <GeneralTab {...tabProps} />}

            {activeTab === 'services' && (
              <ServicesTab
                {...tabProps}
                envGeminiKey={envGeminiKey}
                envOpenaiKey={envOpenaiKey}
                addToast={addToast}
              />
            )}

            {activeTab === 'performance' && <PerformanceTab {...tabProps} />}

            {activeTab === 'enhance' && (
              <EnhanceTab
                {...tabProps}
                onOpenGlossaryManager={onOpenGlossaryManager}
                addToast={addToast}
                onClose={onClose}
              />
            )}

            {activeTab === 'about' && <AboutTab />}

            {activeTab === 'debug' && <DebugTab {...tabProps} />}
          </div>
        </div>
      </div>
    </div>
  );
};

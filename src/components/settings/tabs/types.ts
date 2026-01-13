import type { AppSettings } from '@/types/settings';

/**
 * Base props shared by all settings tab components
 */
export interface TabProps {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => void;
}

/**
 * Props for ServicesTab - needs API key environment hints
 */
export interface ServicesTabProps extends TabProps {
  envGeminiKey: string;
  envOpenaiKey: string;
  addToast: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
}

/**
 * Props for EnhanceTab - needs glossary manager callback
 */
export interface EnhanceTabProps extends TabProps {
  onOpenGlossaryManager: () => void;
  addToast: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
}

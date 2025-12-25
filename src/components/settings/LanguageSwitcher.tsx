import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { CustomSelect } from '@/components/settings/CustomSelect';

interface LanguageSwitcherProps {
  className?: string;
}

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];

/**
 * Language switcher component for selecting UI language
 * Persists selection to localStorage via i18next-browser-languagedetector
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className }) => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <CustomSelect
      value={i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US'}
      onChange={handleLanguageChange}
      options={LANGUAGE_OPTIONS}
      icon={<Languages className="w-4 h-4" />}
      className={className}
    />
  );
};

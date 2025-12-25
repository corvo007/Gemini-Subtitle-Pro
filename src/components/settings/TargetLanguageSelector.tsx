import React from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from './CustomSelect';

interface TargetLanguageSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  variant?: 'default' | 'inline';
}

export const TargetLanguageSelector: React.FC<TargetLanguageSelectorProps> = ({
  value = 'Simplified Chinese',
  onChange,
  className = '',
  variant = 'default',
}) => {
  const { t } = useTranslation('settings');

  const languages = [
    { value: 'Simplified Chinese', label: t('languages.simplifiedChinese') },
    { value: 'Traditional Chinese', label: t('languages.traditionalChinese') },
    { value: 'English', label: t('languages.english') },
    { value: 'Japanese', label: t('languages.japanese') },
    { value: 'Korean', label: t('languages.korean') },
    { value: 'Spanish', label: t('languages.spanish') },
    { value: 'French', label: t('languages.french') },
    { value: 'German', label: t('languages.german') },
    { value: 'Russian', label: t('languages.russian') },
    { value: 'Portuguese', label: t('languages.portuguese') },
    { value: 'Italian', label: t('languages.italian') },
    { value: 'Vietnamese', label: t('languages.vietnamese') },
    { value: 'Thai', label: t('languages.thai') },
    { value: 'Indonesian', label: t('languages.indonesian') },
  ];

  if (variant === 'inline') {
    return (
      <CustomSelect
        value={value}
        onChange={onChange}
        options={languages}
        className={className}
        placeholder={t('general.output.targetLanguage.placeholder')}
        icon={<Languages className="w-4 h-4" />}
      />
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
        <Languages className="w-4 h-4" />
        {t('general.output.targetLanguage.label')}
      </label>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={languages}
        placeholder={t('general.output.targetLanguage.placeholder')}
      />
      <p className="mt-1.5 text-xs text-slate-500">
        {t('general.output.targetLanguage.description')}
      </p>
    </div>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, X, Languages, Type, Clock, Book, Bug } from 'lucide-react';
import { type AppSettings } from '@/types/settings';
import { CustomSelect } from '@/components/settings/CustomSelect';
import { LocalWhisperSettings } from '@/components/settings/LocalWhisperSettings';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { Toggle } from '@/components/ui/Toggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { InputWithReset } from '@/components/ui/InputWithReset';
import { EnvKeyHint } from '@/components/ui/EnvKeyHint';
import { SettingRow } from '@/components/ui/SettingRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { OptionButton } from '@/components/ui/OptionButton';
import { cn } from '@/lib/cn';

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
}) => {
  const { t } = useTranslation('settings');
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

  if (!isOpen) return null;

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

          <div className="flex space-x-1 border-b border-slate-700 mb-6 overflow-x-auto">
            {[
              'general',
              'services',
              'performance',
              'glossary',
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

          <div className="space-y-6 min-h-[400px]">
            {activeTab === 'general' && (
              <div className="space-y-6 animate-fade-in">
                {/* Interface Zoom Settings */}
                <div className="space-y-3">
                  <SectionHeader>{t('general.display.title')}</SectionHeader>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      {t('general.display.zoomLevel')}
                    </label>
                    <CustomSelect
                      value={settings.zoomLevel?.toString() || '1'}
                      onChange={(val) => updateSetting('zoomLevel', parseFloat(val))}
                      options={[
                        { value: '0.5', label: t('general.display.zoomOptions.50') },
                        { value: '0.67', label: t('general.display.zoomOptions.67') },
                        { value: '0.75', label: t('general.display.zoomOptions.75') },
                        { value: '0.8', label: t('general.display.zoomOptions.80') },
                        { value: '0.9', label: t('general.display.zoomOptions.90') },
                        { value: '1', label: t('general.display.zoomOptions.100') },
                        { value: '1.1', label: t('general.display.zoomOptions.110') },
                        { value: '1.25', label: t('general.display.zoomOptions.125') },
                        { value: '1.5', label: t('general.display.zoomOptions.150') },
                      ]}
                      icon={<Type className="w-4 h-4" />}
                    />
                    <p className="text-xs text-slate-500 mt-2">{t('general.display.zoomHint')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      {t('general.display.language')}
                    </label>
                    <LanguageSwitcher />
                    <p className="text-xs text-slate-500 mt-2">
                      {t('general.display.languageHint')}
                    </p>
                  </div>
                </div>

                {/* Output Settings */}
                <div className="space-y-3">
                  <SectionHeader>{t('general.output.title')}</SectionHeader>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      {t('general.output.exportMode')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <OptionButton
                        selected={settings.outputMode === 'bilingual'}
                        onClick={() => updateSetting('outputMode', 'bilingual')}
                        size="md"
                      >
                        <Languages className="w-4 h-4" />
                        <span>{t('general.output.bilingual')}</span>
                      </OptionButton>
                      <OptionButton
                        selected={settings.outputMode === 'target_only'}
                        onClick={() => updateSetting('outputMode', 'target_only')}
                        size="md"
                      >
                        <Type className="w-4 h-4" />
                        <span>{t('general.output.targetOnly')}</span>
                      </OptionButton>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {t('general.output.bilingualHint')}
                    </p>
                  </div>

                  {/* Speaker Diarization Settings */}
                  <div className="space-y-4 mt-4 pt-4 border-t border-slate-700/50">
                    <SettingRow
                      label={t('general.speaker.enableDiarization')}
                      description={t('general.speaker.enableDiarizationDesc')}
                    >
                      <Toggle
                        checked={settings.enableDiarization || false}
                        onChange={(v) => updateSetting('enableDiarization', v)}
                      />
                    </SettingRow>

                    {settings.enableDiarization && (
                      <SettingRow
                        label={t('general.speaker.enablePreAnalysis')}
                        description={t('general.speaker.enablePreAnalysisDesc')}
                        indented
                      >
                        <Toggle
                          checked={settings.enableSpeakerPreAnalysis || false}
                          onChange={(v) => {
                            updateSetting('enableSpeakerPreAnalysis', v);
                            // Auto-disable styled translation when pre-analysis is disabled
                            if (!v) {
                              updateSetting('useSpeakerStyledTranslation', false);
                            }
                          }}
                        />
                      </SettingRow>
                    )}

                    {settings.enableDiarization && (
                      <div className="space-y-3 animate-fade-in">
                        <SettingRow
                          label={t('general.speaker.includeSpeakerInExport')}
                          description={t('general.speaker.includeSpeakerInExportDesc')}
                          indented
                        >
                          <Toggle
                            checked={settings.includeSpeakerInExport || false}
                            onChange={(v) => updateSetting('includeSpeakerInExport', v)}
                          />
                        </SettingRow>
                        <SettingRow
                          label={t('general.speaker.useSpeakerColors')}
                          description={t('general.speaker.useSpeakerColorsDesc')}
                          indented
                        >
                          <Toggle
                            checked={settings.useSpeakerColors || false}
                            onChange={(v) => updateSetting('useSpeakerColors', v)}
                          />
                        </SettingRow>
                        <SettingRow
                          label={t('general.speaker.styledTranslation')}
                          description={
                            settings.enableSpeakerPreAnalysis
                              ? t('general.speaker.styledTranslationDesc')
                              : t('general.speaker.styledTranslationDisabledDesc')
                          }
                          indented
                          disabled={!settings.enableSpeakerPreAnalysis}
                        >
                          <Toggle
                            checked={settings.useSpeakerStyledTranslation || false}
                            onChange={(v) => updateSetting('useSpeakerStyledTranslation', v)}
                            disabled={!settings.enableSpeakerPreAnalysis}
                          />
                        </SettingRow>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-6 animate-fade-in">
                {/* API Settings */}
                <div className="space-y-3">
                  <SectionHeader>{t('services.translation.title')}</SectionHeader>
                  <div className="space-y-4">
                    {/* Gemini */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        {t('services.translation.geminiKey')}
                      </label>
                      <div className="relative">
                        <PasswordInput
                          value={settings.geminiKey}
                          onChange={(e) => updateSetting('geminiKey', e.target.value.trim())}
                          placeholder={t('services.translation.geminiKeyPlaceholder')}
                        />
                      </div>
                      <p
                        className="text-xs text-slate-500 mt-1"
                        dangerouslySetInnerHTML={{
                          __html: t('services.translation.geminiKeyHint'),
                        }}
                      />
                      <EnvKeyHint envKey={envGeminiKey} userKey={settings.geminiKey} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        {t('services.translation.geminiEndpoint')}
                      </label>
                      <InputWithReset
                        value={settings.geminiEndpoint || ''}
                        onChange={(val) => updateSetting('geminiEndpoint', val)}
                        onReset={() => updateSetting('geminiEndpoint', undefined)}
                        placeholder={t('services.translation.geminiEndpointPlaceholder')}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {t('services.translation.geminiEndpointHint')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transcription Provider Settings */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <SectionHeader>{t('services.transcription.title')}</SectionHeader>

                  {isElectron ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <OptionButton
                          selected={!settings.useLocalWhisper}
                          onClick={() => updateSetting('useLocalWhisper', false)}
                          size="md"
                        >
                          <span>{t('services.transcription.openaiApi')}</span>
                        </OptionButton>
                        <OptionButton
                          selected={settings.useLocalWhisper || false}
                          onClick={() => updateSetting('useLocalWhisper', true)}
                          size="md"
                        >
                          <span>{t('services.transcription.localWhisper')}</span>
                        </OptionButton>
                      </div>

                      {settings.useLocalWhisper ? (
                        <LocalWhisperSettings
                          useLocalWhisper={true}
                          whisperModelPath={settings.whisperModelPath}
                          onToggle={(enabled) => {
                            updateSetting('useLocalWhisper', enabled);
                          }}
                          onModelPathChange={(path) => {
                            updateSetting('whisperModelPath', path);
                          }}
                        />
                      ) : (
                        <div className="space-y-4 animate-fade-in">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                              {t('services.transcription.openaiKey')}
                            </label>
                            <div className="relative">
                              <PasswordInput
                                value={settings.openaiKey}
                                onChange={(e) => updateSetting('openaiKey', e.target.value.trim())}
                                placeholder={t('services.transcription.openaiKeyPlaceholder')}
                              />
                            </div>
                            <p
                              className="text-xs text-slate-500 mt-1"
                              dangerouslySetInnerHTML={{
                                __html: t('services.transcription.openaiKeyHint'),
                              }}
                            />
                            <EnvKeyHint envKey={envOpenaiKey} userKey={settings.openaiKey} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                              {t('services.transcription.openaiEndpoint')}
                            </label>
                            <InputWithReset
                              value={settings.openaiEndpoint || ''}
                              onChange={(val) => updateSetting('openaiEndpoint', val)}
                              onReset={() => updateSetting('openaiEndpoint', undefined)}
                              placeholder={t('services.transcription.openaiEndpointPlaceholder')}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              {t('services.transcription.openaiEndpointHint')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          {t('services.transcription.openaiKey')}
                        </label>
                        <div className="relative">
                          <PasswordInput
                            value={settings.openaiKey}
                            onChange={(e) => updateSetting('openaiKey', e.target.value.trim())}
                            placeholder={t('services.transcription.openaiKeyPlaceholder')}
                          />
                        </div>
                        <p
                          className="text-xs text-slate-500 mt-1"
                          dangerouslySetInnerHTML={{
                            __html: t('services.transcription.openaiKeyHint'),
                          }}
                        />
                        <EnvKeyHint envKey={envOpenaiKey} userKey={settings.openaiKey} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          {t('services.transcription.openaiEndpoint')}
                        </label>
                        <InputWithReset
                          value={settings.openaiEndpoint || ''}
                          onChange={(val) => updateSetting('openaiEndpoint', val)}
                          onReset={() => updateSetting('openaiEndpoint', undefined)}
                          placeholder={t('services.transcription.openaiEndpointPlaceholder')}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          {t('services.transcription.openaiEndpointHint')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="space-y-3 animate-fade-in">
                {/* Local Whisper Performance Settings */}
                {settings.useLocalWhisper && (
                  <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 mr-2"></span>
                      本地 Whisper 设置
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          CPU 线程数
                        </label>
                        <NumberInput
                          value={settings.whisperThreads}
                          onChange={(v) => updateSetting('whisperThreads', v)}
                          min={1}
                          max={16}
                          defaultOnBlur={4}
                          placeholder="4"
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          每个转录任务使用的 CPU 线程数，范围 1-16
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          最大并发数
                        </label>
                        <NumberInput
                          value={settings.whisperConcurrency}
                          onChange={(v) => updateSetting('whisperConcurrency', v)}
                          min={1}
                          max={4}
                          defaultOnBlur={1}
                          placeholder="1"
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          同时处理的转录任务数，范围 1-4
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      润色翻译批次大小
                    </label>
                    <NumberInput
                      value={settings.proofreadBatchSize || undefined}
                      onChange={(v) => updateSetting('proofreadBatchSize', v ?? 0)}
                      min={0}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      每次润色翻译的字幕条数。数值越大上下文越完整、质量越高，但会消耗更多 Token。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      翻译批次大小
                    </label>
                    <NumberInput
                      value={settings.translationBatchSize || undefined}
                      onChange={(v) => updateSetting('translationBatchSize', v ?? 0)}
                      min={0}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      每次翻译的字幕条数。数值越大上下文越完整、质量越高，但会消耗更多 Token。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      分块时长 (秒)
                    </label>
                    <NumberInput
                      value={settings.chunkDuration || undefined}
                      onChange={(v) => updateSetting('chunkDuration', v ?? 0)}
                      min={0}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      音频分段的目标长度（秒），影响转录的并行处理效率。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      并发数 (Flash)
                    </label>
                    <NumberInput
                      value={settings.concurrencyFlash || undefined}
                      onChange={(v) => updateSetting('concurrencyFlash', v ?? 0)}
                      min={0}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      应用于 <strong>Gemini Flash 系列模型</strong> 翻译、优化和{' '}
                      <strong>Whisper API</strong> 转录。请根据账户限额调整。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      并发数 (Pro)
                    </label>
                    <NumberInput
                      value={settings.concurrencyPro || undefined}
                      onChange={(v) => updateSetting('concurrencyPro', v ?? 0)}
                      min={0}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      应用于 <strong>Gemini Pro 系列模型</strong>{' '}
                      术语提取和润色翻译。请根据账户限额调整。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      请求超时 (秒)
                    </label>
                    <NumberInput
                      value={settings.requestTimeout || undefined}
                      onChange={(v) => updateSetting('requestTimeout', v ?? 600)}
                      min={0}
                      placeholder="600"
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      单个 API 请求的最长等待时间。网络较慢或处理大批量时可适当增加。
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <SettingRow
                    label="智能分段"
                    description="使用 AI 语音检测在自然停顿处切分音频，提升转录准确度（推荐）"
                  >
                    <Toggle
                      checked={settings.useSmartSplit !== false}
                      onChange={(v) => updateSetting('useSmartSplit', v)}
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeTab === 'glossary' && (
              <div className="space-y-3 animate-fade-in">
                <SettingRow
                  label="启用自动术语表"
                  description="自动识别并提取专业术语，提升翻译准确性和一致性"
                >
                  <Toggle
                    checked={settings.enableAutoGlossary !== false}
                    onChange={(v) => updateSetting('enableAutoGlossary', v)}
                  />
                </SettingRow>

                {settings.enableAutoGlossary !== false && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        术语提取音频长度
                      </label>
                      <CustomSelect
                        value={
                          settings.glossarySampleMinutes === 'all'
                            ? 'all'
                            : settings.glossarySampleMinutes.toString()
                        }
                        onChange={(val) => {
                          if (val === 'all') updateSetting('glossarySampleMinutes', 'all');
                          else updateSetting('glossarySampleMinutes', parseInt(val));
                        }}
                        options={[
                          { value: '5', label: '前 5 分钟' },
                          { value: '15', label: '前 15 分钟' },
                          { value: '30', label: '前 30 分钟' },
                          { value: 'all', label: '完整音频 (较慢)' },
                        ]}
                        icon={<Clock className="w-4 h-4" />}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        使用音频的前 N
                        分钟提取术语。选择“完整音频”可获得更全面的术语，但处理时间更长。
                      </p>
                    </div>

                    <SettingRow
                      label="自动确认术语表"
                      description="提取术语后直接应用，无需人工确认。新术语将自动合并至当前激活的术语表（如当前无术语表，则自动新建）。"
                    >
                      <Toggle
                        checked={settings.glossaryAutoConfirm || false}
                        onChange={(v) => updateSetting('glossaryAutoConfirm', v)}
                      />
                    </SettingRow>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenGlossaryManager();
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center justify-center text-sm font-medium"
                  >
                    <Book className="w-4 h-4 mr-2" /> 管理术语表
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'debug' && (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-amber-300 mb-2 flex items-center">
                    <Bug className="w-4 h-4 mr-2" /> 调试模式
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    启用 Mock 模式可以跳过实际 API 请求，直接返回模拟数据。用于测试流程或节省 API
                    额度。
                  </p>

                  <div className="space-y-4">
                    <SettingRow label="Mock Gemini API" description="跳过术语提取、润色和翻译请求">
                      <Toggle
                        checked={settings.debug?.mockGemini || false}
                        onChange={(v) =>
                          updateSetting('debug', {
                            ...settings.debug,
                            mockGemini: v,
                          })
                        }
                        color="amber"
                      />
                    </SettingRow>

                    <SettingRow label="Mock OpenAI API" description="跳过 OpenAI Whisper 转录请求">
                      <Toggle
                        checked={settings.debug?.mockOpenAI || false}
                        onChange={(v) =>
                          updateSetting('debug', {
                            ...settings.debug,
                            mockOpenAI: v,
                          })
                        }
                        color="amber"
                      />
                    </SettingRow>

                    <SettingRow label="Mock Local Whisper" description="跳过本地 Whisper 转录">
                      <Toggle
                        checked={settings.debug?.mockLocalWhisper || false}
                        onChange={(v) =>
                          updateSetting('debug', {
                            ...settings.debug,
                            mockLocalWhisper: v,
                          })
                        }
                        color="amber"
                      />
                    </SettingRow>

                    <SettingRow
                      label="保存中间结果"
                      description="在日志目录下保存 Whisper 原始结果、润色结果、翻译结果等中间文件，用于调试分析"
                    >
                      <Toggle
                        checked={settings.debug?.saveIntermediateArtifacts || false}
                        onChange={(v) =>
                          updateSetting('debug', {
                            ...settings.debug,
                            saveIntermediateArtifacts: v,
                          })
                        }
                        color="amber"
                      />
                    </SettingRow>

                    <div className="pt-4 border-t border-slate-700">
                      <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                        Custom Paths
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Custom ffmpeg.exe Path
                          </label>
                          <input
                            type="text"
                            value={settings.debug?.ffmpegPath || ''}
                            onChange={(e) =>
                              updateSetting('debug', {
                                ...settings.debug,
                                ffmpegPath: e.target.value,
                              })
                            }
                            placeholder="Default (Auto-detected)"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Custom ffprobe.exe Path
                          </label>
                          <input
                            type="text"
                            value={settings.debug?.ffprobePath || ''}
                            onChange={(e) =>
                              updateSetting('debug', {
                                ...settings.debug,
                                ffprobePath: e.target.value,
                              })
                            }
                            placeholder="Default (Auto-detected)"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Custom whisper-cli.exe Path
                          </label>
                          <input
                            type="text"
                            value={settings.debug?.whisperPath || ''}
                            onChange={(e) =>
                              updateSetting('debug', {
                                ...settings.debug,
                                whisperPath: e.target.value,
                              })
                            }
                            placeholder="Default (Auto-detected)"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

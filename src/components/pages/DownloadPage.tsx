/**
 * Download Page - Main Component (Tailwind CSS Version)
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Settings,
  Download,
  Play,
  CheckCircle,
  FolderOpen,
  RefreshCw,
  X,
  Image,
} from 'lucide-react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DirectorySelector } from '@/components/ui/DirectorySelector';
import { useDownload } from '@/hooks/useDownload';
import { UrlInput } from '@/components/download/UrlInput';
import { VideoPreview } from '@/components/download/VideoPreview';
import { QualitySelector } from '@/components/download/QualitySelector';
import { DownloadProgress } from '@/components/download/DownloadProgress';
import { PageHeader, HeaderButton } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

interface DownloadPageProps {
  onDownloadComplete?: (videoPath: string) => void;
  onGoBack?: () => void;
  onShowLogs?: () => void;
  onShowSettings?: () => void;
}

export function DownloadPage({
  onDownloadComplete,
  onGoBack,
  onShowLogs,
  onShowSettings,
}: DownloadPageProps) {
  const {
    status,
    videoInfo,
    progress,
    outputDir,
    error,
    errorInfo,
    outputPath,
    thumbnailPath,
    parse,
    download,
    downloadThumbnail,
    cancel,
    selectDir,
    reset,
    retry,
  } = useDownload();

  const { t } = useTranslation('download');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [includeThumbnail, setIncludeThumbnail] = useState<boolean>(false);
  const [downloadingThumbnail, setDownloadingThumbnail] = useState<boolean>(false);

  // Auto-select first format when video info is available
  React.useEffect(() => {
    if (videoInfo?.formats?.length && !selectedFormat) {
      setSelectedFormat(videoInfo.formats[0].formatId);
    }
  }, [videoInfo, selectedFormat]);

  const handleDownload = async () => {
    if (selectedFormat) {
      const path = await download(selectedFormat);
      // Download thumbnail if option is enabled
      if (path && includeThumbnail) {
        await downloadThumbnail();
      }
    }
  };

  const handleDownloadAndContinue = async () => {
    if (selectedFormat) {
      const path = await download(selectedFormat);
      // Download thumbnail if option is enabled
      if (path && includeThumbnail) {
        await downloadThumbnail();
      }
      if (path && onDownloadComplete) {
        onDownloadComplete(path);
      }
    }
  };

  const handleDownloadThumbnailOnly = async () => {
    if (!videoInfo) return;
    setDownloadingThumbnail(true);
    try {
      await downloadThumbnail();
    } finally {
      setDownloadingThumbnail(false);
    }
  };

  const getErrorIcon = () => {
    const iconMap: Record<string, string> = {
      network: '🌐',
      rate_limit: '⏳',
      geo_blocked: '🌍',
      private: '🔒',
      paid: '💰',
      login_required: '🔐',
      age_restricted: '🔞',
      unavailable: '🚫',
      unsupported: '⚠️',
      format_unavailable: '📺',
      invalid_url: '🔗',
    };
    return iconMap[errorInfo?.type || ''] || '❌';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-4 md:p-8">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* Header */}
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          onBack={onGoBack}
          actions={
            <>
              {onShowLogs && (
                <HeaderButton
                  onClick={onShowLogs}
                  icon={<FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  label={t('logs')}
                  title={t('viewLogs')}
                  hoverColor="blue"
                />
              )}
              {onShowSettings && (
                <HeaderButton
                  onClick={onShowSettings}
                  icon={<Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  label={t('settings')}
                  hoverColor="emerald"
                />
              )}
            </>
          }
        />

        <div className="max-w-3xl mx-auto w-full mt-6">
          <UrlInput
            onParse={parse}
            disabled={status === 'downloading' || status === 'parsing'}
            loading={status === 'parsing'}
          />

          {/* Error Message */}
          {error && (
            <div
              className={cn(
                'flex flex-col gap-3 p-4 rounded-lg mb-4 border',
                errorInfo?.retryable
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{getErrorIcon()}</span>
                <span className="leading-relaxed">{error}</span>
              </div>
              <div className="flex gap-2 justify-end">
                {errorInfo?.retryable && (
                  <button
                    onClick={retry}
                    className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/50 rounded-md text-violet-300 text-sm transition-colors hover:bg-violet-500/30"
                  >
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> {t('retry')}
                    </span>
                  </button>
                )}
                <button
                  onClick={reset}
                  className="px-3 py-1.5 bg-white/5 border border-white/20 rounded-md text-white/70 text-sm transition-colors hover:bg-white/10"
                >
                  <span className="flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> {t('clear')}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Video Card */}
          {videoInfo && status !== 'downloading' && status !== 'completed' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <VideoPreview videoInfo={videoInfo} />

              <QualitySelector
                formats={videoInfo.formats}
                selectedFormat={selectedFormat}
                onSelect={setSelectedFormat}
              />

              {/* Output Directory */}
              <div className="pt-4 mb-4 border-t border-white/10">
                <label className="block text-sm text-white/60 mb-2">{t('outputDir')}</label>
                <DirectorySelector
                  value={outputDir}
                  placeholder={t('notSelected')}
                  onSelect={selectDir}
                  variant="accent"
                />
              </div>

              {/* Download Thumbnail Option (Custom Checkbox) */}
              <div className="mb-6">
                <div
                  className="flex items-center gap-2 cursor-pointer select-none group w-fit"
                  onClick={() => setIncludeThumbnail(!includeThumbnail)}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded flex items-center justify-center transition-all duration-200 border',
                      includeThumbnail
                        ? 'bg-violet-500 border-violet-500'
                        : 'bg-white/5 border-white/20 group-hover:border-white/30'
                    )}
                  >
                    {includeThumbnail && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span
                    className={cn(
                      'text-sm transition-colors',
                      includeThumbnail ? 'text-white' : 'text-white/70 group-hover:text-white/90'
                    )}
                  >
                    {t('downloadThumbnail')}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end pt-4 border-t border-white/10">
                {/* Standalone Thumbnail Download Button */}
                <button
                  onClick={handleDownloadThumbnailOnly}
                  disabled={downloadingThumbnail}
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white/70 font-medium transition-colors hover:bg-white/10 hover:text-white mr-auto"
                >
                  <span className="flex items-center gap-2">
                    {downloadingThumbnail ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Image className="w-4 h-4" />
                    )}
                    {t('thumbnailOnly')}
                  </span>
                </button>

                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-medium transition-colors hover:bg-white/15"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" /> {t('downloadVideo')}
                  </span>
                </button>
                <PrimaryButton
                  onClick={handleDownloadAndContinue}
                  icon={<Play className="w-4 h-4 fill-current" />}
                >
                  {t('downloadAndGenerate')}
                </PrimaryButton>
              </div>
            </div>
          )}

          {status === 'downloading' && <DownloadProgress progress={progress} onCancel={cancel} />}

          {/* Success Message */}
          {status === 'completed' && outputPath && (
            <div className="text-center p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-2">{t('downloadComplete')}</h3>
              <p className="text-white/60 text-sm mb-2 break-all">{outputPath}</p>
              {thumbnailPath && (
                <p className="text-white/50 text-xs mb-4 break-all">
                  {t('thumbnail')}: {thumbnailPath}
                </p>
              )}
              <div className="flex gap-4 justify-center flex-wrap mt-4">
                <button
                  onClick={() => window.electronAPI.showItemInFolder(outputPath)}
                  className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white transition-colors hover:bg-white/15"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" /> {t('openOutputDir')}
                  </span>
                </button>
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white transition-colors hover:bg-white/15"
                >
                  {t('downloadNewVideo')}
                </button>
                {onDownloadComplete && (
                  <PrimaryButton
                    onClick={() => onDownloadComplete(outputPath)}
                    variant="success"
                    icon={<Play className="w-4 h-4 fill-current" />}
                  >
                    {t('continueGenerating')}
                  </PrimaryButton>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

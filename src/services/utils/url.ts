import i18n from '@/i18n';

/** URL 验证辅助函数 */
export function isValidVideoUrl(url: string): {
  valid: boolean;
  platform?: string;
  error?: string;
} {
  if (!url || !url.trim()) {
    return { valid: false, error: i18n.t('services:utils.url.inputRequired') };
  }

  // Backend (yt-dlp) is responsible for actual validation and platform support.
  // We simply pass the non-empty string through.
  return { valid: true };
}

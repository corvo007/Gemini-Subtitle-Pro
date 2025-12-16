/** URL 验证辅助函数 */
export function isValidVideoUrl(url: string): {
  valid: boolean;
  platform?: string;
  error?: string;
} {
  if (!url || !url.trim()) {
    return { valid: false, error: '请输入视频链接' };
  }

  // Backend (yt-dlp) is responsible for actual validation and platform support.
  // We simply pass the non-empty string through.
  return { valid: true };
}

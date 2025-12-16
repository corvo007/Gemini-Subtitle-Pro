/**
 * URL Input Component - Tailwind CSS Version
 */
import React, { useState } from 'react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

import { isValidVideoUrl } from '@/services/utils/url';

interface UrlInputProps {
  onParse: (url: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function UrlInput({ onParse, disabled, loading }: UrlInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onParse(url.trim());
    }
  };

  const validation = isValidVideoUrl(url);
  const platform = validation.valid ? validation.platform : null;
  const isValidUrl = validation.valid;

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴 YouTube / Bilibili 视频链接..."
            disabled={disabled}
            className="flex-1 px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white text-base
                          placeholder:text-white/40 transition-all
                          focus:outline-none focus:border-violet-500/50 focus:ring-3 focus:ring-violet-500/15
                          disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <PrimaryButton
            type="submit"
            disabled={disabled || !isValidUrl}
            loading={loading}
            loadingText="解析中"
          >
            解析
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

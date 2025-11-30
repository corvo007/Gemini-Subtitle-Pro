import React, { useEffect, useState } from 'react';

interface LocalWhisperSettingsProps {
    useLocalWhisper: boolean;
    whisperModelPath?: string;
    onToggle: (enabled: boolean) => void;
    onModelPathChange: (path: string) => void;
}

export const LocalWhisperSettings: React.FC<LocalWhisperSettingsProps> = ({
    useLocalWhisper,
    whisperModelPath,
    onToggle,
    onModelPathChange
}) => {
    const [status, setStatus] = useState<'stopped' | 'running' | 'error'>('stopped');
    const [statusMessage, setStatusMessage] = useState('');

    // Check status periodically
    useEffect(() => {
        if (!window.electronAPI) return;

        const checkStatus = async () => {
            const result = await window.electronAPI!.getWhisperStatus();
            setStatus(result.status);
            if (result.message) setStatusMessage(result.message);
        };

        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    // Select model
    const handleSelect = async () => {
        if (!window.electronAPI) return;
        const path = await window.electronAPI.selectWhisperModel();
        if (path) onModelPathChange(path);
    };

    const statusConfig = {
        stopped: { color: 'text-slate-500', label: '未运行', icon: '○' },
        running: { color: 'text-emerald-400', label: '运行中', icon: '●' },
        error: { color: 'text-red-400', label: '错误', icon: '✕' }
    };

    const current = statusConfig[status];

    return (
        <div className="space-y-4 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-sm font-medium text-slate-200">本地 Whisper 模型</h3>
                    <p className="text-xs text-slate-500">使用本地运行的 Whisper 模型 (GGML .bin) 进行转录，无需联网，保护隐私。</p>
                </div>
                <span className={`text-sm flex items-center gap-1.5 ${current.color}`}>
                    {current.icon} {current.label}
                </span>
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={whisperModelPath || ''}
                    placeholder="选择模型文件..."
                    readOnly
                    className="flex-1 px-3 py-2 border border-slate-700 rounded bg-slate-900 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button onClick={handleSelect} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors">
                    📁 选择
                </button>
            </div>

            {status === 'error' && statusMessage && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-900/50 p-2 rounded">
                    ❌ {statusMessage}
                </div>
            )}
        </div>
    );
};

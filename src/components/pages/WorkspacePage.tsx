import React, { useRef, useEffect } from 'react';
import { FileVideo, Download, Play, AlertCircle, Loader2, X, FileText, RotateCcw, Upload, Plus, Clapperboard, Edit2, Book, GitCommit } from 'lucide-react';
import { SubtitleItem, SubtitleSnapshot, BatchOperationMode } from '@/types/subtitle';
import { AppSettings } from '@/types/settings';
import { GenerationStatus } from '@/types/api';
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader';
import { FileUploader } from '@/components/upload/FileUploader';
import { SubtitleEditor } from '@/components/editor/SubtitleEditor';
import { CustomSelect } from '@/components/settings';
import { StatusBadge } from '@/components/ui';

interface WorkspacePageProps {
    activeTab: 'new' | 'import';
    file: File | null;
    duration: number;
    subtitles: SubtitleItem[];
    status: GenerationStatus;
    error: string | null;
    settings: AppSettings;
    snapshots: SubtitleSnapshot[];
    showSnapshots: boolean;
    selectedBatches: Set<number>;
    batchComments: Record<number, string>;
    showSourceText: boolean;
    editingCommentId: number | null;

    // Handlers
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubtitleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onGenerate: () => void;
    onDownload: (format: 'srt' | 'ass') => void;
    onGoBack: () => void;
    onShowLogs: () => void;
    onShowGlossary: () => void;
    onShowSettings: () => void;
    onShowGenreSettings: () => void;
    onUpdateSetting: (key: keyof AppSettings, value: any) => void;
    onToggleSnapshots: () => void;
    onRestoreSnapshot: (snapshot: SubtitleSnapshot) => void;

    // Editor Handlers
    toggleAllBatches: (total: number) => void;
    selectBatchesWithComments: (chunks: SubtitleItem[][]) => void;
    setShowSourceText: (show: boolean) => void;
    handleBatchAction: (mode: BatchOperationMode, batchIndex: number, prompt?: string) => void;
    toggleBatch: (index: number) => void;
    updateBatchComment: (index: number, comment: string) => void;
    setEditingCommentId: (id: number | null) => void;
    updateLineComment: (index: number, comment: string) => void;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
    activeTab,
    file,
    duration,
    subtitles,
    status,
    error,
    settings,
    snapshots,
    showSnapshots,
    selectedBatches,
    batchComments,
    showSourceText,
    editingCommentId,
    onFileChange,
    onSubtitleImport,
    onGenerate,
    onDownload,
    onGoBack,
    onShowLogs,
    onShowGlossary,
    onShowSettings,
    onShowGenreSettings,
    onUpdateSetting,
    onToggleSnapshots,
    onRestoreSnapshot,
    toggleAllBatches,
    selectBatchesWithComments,
    setShowSourceText,
    handleBatchAction,
    toggleBatch,
    updateBatchComment,
    setEditingCommentId,
    updateLineComment
}) => {
    const subtitleListRef = useRef<HTMLDivElement>(null);
    const isProcessing = status === GenerationStatus.UPLOADING || status === GenerationStatus.PROCESSING || status === GenerationStatus.PROOFREADING;

    // Scroll to bottom on new subtitles
    useEffect(() => {
        if (status === GenerationStatus.PROCESSING && subtitleListRef.current) {
            subtitleListRef.current.scrollTop = subtitleListRef.current.scrollHeight;
        }
    }, [subtitles, status]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex flex-col">
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-6">
                <WorkspaceHeader
                    title={activeTab === 'new' ? '新建项目' : '字幕编辑器'}
                    modeLabel={activeTab === 'new' ? '生成模式' : '导入模式'}
                    subtitleInfo={file ? file.name : (subtitles.length > 0 ? `${subtitles.length} 行已加载` : '未选择文件')}
                    onBack={onGoBack}
                    showSnapshots={showSnapshots}
                    onToggleSnapshots={onToggleSnapshots}
                    hasSnapshots={snapshots.length > 0}
                    onShowLogs={onShowLogs}
                    onShowGlossary={onShowGlossary}
                    onShowSettings={onShowSettings}
                />
                <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
                    <div className="lg:col-span-3 lg:h-full overflow-y-auto custom-scrollbar space-y-4">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
                            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-300">项目文件</h3></div>
                            {file ? (
                                <FileUploader
                                    hasFile={true}
                                    fileName={file.name}
                                    fileInfo={`${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')} · ${(file.size / (1024 * 1024)).toFixed(1)}MB`}
                                    onFileSelect={onFileChange}
                                    disabled={isProcessing}
                                    accept="video/*,audio/*"
                                    icon={<FileVideo className="text-indigo-400" />}
                                    uploadTitle=""
                                />
                            ) : (
                                <FileUploader
                                    hasFile={false}
                                    onFileSelect={onFileChange}
                                    accept="video/*,audio/*"
                                    icon={activeTab === 'new' ? <Upload className="text-indigo-400" /> : <Plus className="text-slate-500 group-hover:text-indigo-400" />}
                                    uploadTitle={activeTab === 'new' ? "上传视频 / 音频" : "附加媒体 (可选)"}
                                    uploadDescription={activeTab === 'new' ? "开始转录" : undefined}
                                    heightClass={activeTab === 'new' ? 'h-32' : 'h-20'}
                                />
                            )}
                            {activeTab === 'import' && (
                                <div className="pt-2 border-t border-slate-800">
                                    <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-semibold text-slate-400">字幕文件</h3>{subtitles.length > 0 && (<span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{subtitles.length} 行</span>)}</div>
                                    {subtitles.length === 0 ? (
                                        <FileUploader
                                            hasFile={false}
                                            onFileSelect={onSubtitleImport}
                                            accept=".srt,.ass"
                                            icon={<FileText className="text-emerald-500 group-hover:text-emerald-400" />}
                                            uploadTitle="导入 .SRT / .ASS"
                                            heightClass="h-24"
                                        />
                                    ) : (
                                        <FileUploader
                                            hasFile={true}
                                            fileInfo="字幕已加载"
                                            onFileSelect={onSubtitleImport}
                                            accept=".srt,.ass"
                                            icon={<FileText className="text-emerald-500" />}
                                            uploadTitle=""
                                        />
                                    )}
                                </div>
                            )}
                            <div className="flex flex-col space-y-3 text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center text-slate-500"><Clapperboard className="w-3 h-3 mr-2" /> 类型</span>
                                    <button onClick={onShowGenreSettings} className="flex items-center space-x-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-300 hover:text-white transition-colors group" title="编辑类型 / 上下文">
                                        <span className="truncate max-w-[100px]">
                                            {settings.genre === 'general' ? '通用' :
                                                settings.genre === 'anime' ? '动漫' :
                                                    settings.genre === 'movie' ? '电影' :
                                                        settings.genre === 'news' ? '新闻' :
                                                            settings.genre === 'tech' ? '科技' : settings.genre}
                                        </span>
                                        <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                                    </button>
                                </div>

                                <div className="flex flex-col space-y-1 pt-2 border-t border-slate-700/50">
                                    <span className="flex items-center text-slate-500 mb-1"><Book className="w-3 h-3 mr-2" /> 术语表</span>
                                    <CustomSelect
                                        value={settings.activeGlossaryId || ''}
                                        onChange={(val) => onUpdateSetting('activeGlossaryId', val || null)}
                                        options={[
                                            { value: '', label: '(无)' },
                                            ...(settings.glossaries?.map(g => ({
                                                value: g.id,
                                                label: (
                                                    <div className="flex items-center justify-between w-full min-w-0">
                                                        <span className="truncate mr-2">{g.name}</span>
                                                        <span className="text-slate-500 text-xs flex-shrink-0">({g.terms?.length || 0})</span>
                                                    </div>
                                                )
                                            })) || [])
                                        ]}
                                        className="w-full"
                                        placeholder="(无)"
                                    />
                                </div>
                            </div>
                        </div>
                        {activeTab === 'new' && (
                            <button onClick={onGenerate} disabled={isProcessing || !file} className={`w-full py-3 px-4 rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${isProcessing || !file ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer'}`}>
                                {isProcessing ? (<Loader2 className="w-5 h-5 animate-spin" />) : (<Play className="w-5 h-5 fill-current" />)}
                                <span>{status === GenerationStatus.IDLE || status === GenerationStatus.COMPLETED || status === GenerationStatus.ERROR ? '开始处理' : '处理中...'}</span>
                            </button>
                        )}
                        {error && (<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start space-x-2 animate-fade-in"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span className="break-words w-full">{error}</span></div>)}
                        {(status === GenerationStatus.COMPLETED || status === GenerationStatus.PROOFREADING) && subtitles.length > 0 && (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-sm animate-fade-in">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center"><Download className="w-4 h-4 mr-2 text-emerald-400" /> 导出</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => onDownload('srt')} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"><span className="font-bold text-slate-200 text-sm">.SRT</span></button>
                                    <button onClick={() => onDownload('ass')} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"><span className="font-bold text-slate-200 text-sm">.ASS</span></button>
                                </div>
                                <div className="mt-3 text-[12px] text-center text-slate-500">模式: {settings.outputMode === 'bilingual' ? '双语' : '仅翻译'}</div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-9 flex flex-col h-[500px] lg:h-full min-h-0">
                        <div className="flex items-center justify-between mb-2 h-8 shrink-0">
                            <div className="flex items-center space-x-2">

                            </div>
                            <StatusBadge status={status} />
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative flex-1 min-h-0">
                            {showSnapshots ? (
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar w-full relative">
                                    <button onClick={onToggleSnapshots} className="absolute top-2 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                                    {snapshots.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50"><GitCommit className="w-12 h-12 mb-2" /><p>本次会话无可用版本</p></div>) : (snapshots.map((snap) => (<div key={snap.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex justify-between items-center"><div><h4 className="font-medium text-slate-200">{snap.description}</h4><p className="text-xs text-slate-500 mt-1">{snap.timestamp}</p></div><button onClick={() => onRestoreSnapshot(snap)} className="px-3 py-1.5 bg-slate-700 hover:bg-indigo-600 rounded text-xs text-white transition-colors flex items-center"><RotateCcw className="w-3 h-3 mr-1" /> 恢复</button></div>)))}
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto custom-scrollbar relative w-full h-full max-h-[calc(100vh-220px)]" ref={subtitleListRef}>
                                    <SubtitleEditor
                                        subtitles={subtitles}
                                        settings={settings}
                                        status={status}
                                        activeTab={activeTab}
                                        selectedBatches={selectedBatches}
                                        toggleAllBatches={toggleAllBatches}
                                        selectBatchesWithComments={selectBatchesWithComments}
                                        showSourceText={showSourceText}
                                        setShowSourceText={setShowSourceText}
                                        file={file}
                                        handleBatchAction={handleBatchAction}
                                        batchComments={batchComments}
                                        toggleBatch={toggleBatch}
                                        updateBatchComment={updateBatchComment}
                                        editingCommentId={editingCommentId}
                                        setEditingCommentId={setEditingCommentId}
                                        updateLineComment={updateLineComment}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

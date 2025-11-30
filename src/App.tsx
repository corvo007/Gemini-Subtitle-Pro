import React, { useState, useEffect, useRef } from 'react';
import { SubtitleItem, SubtitleSnapshot, BatchOperationMode } from '@/types/subtitle';
import { AppSettings, GENRE_PRESETS } from '@/types/settings';
import { GlossaryItem, GlossaryExtractionResult, GlossaryExtractionMetadata } from '@/types/glossary';
import { GenerationStatus, ChunkStatus } from '@/types/api';
import { generateSrtContent, generateAssContent } from '@/services/subtitle/generator';
import { downloadFile } from '@/services/subtitle/downloader';
import { parseSrt, parseAss } from '@/services/subtitle/parser';
import { logger, LogEntry } from '@/services/utils/logger';
import { mergeGlossaryResults } from '@/services/glossary/merger';

import { generateSubtitles } from '@/services/api/gemini/subtitle';
import { runBatchOperation } from '@/services/api/gemini/batch';
import { retryGlossaryExtraction } from '@/services/api/gemini/glossary';

import { TerminologyIssue } from './terminologyChecker';
import { GlossaryManager } from './GlossaryManager';
import { SettingsModal, GenreSettingsDialog } from '@/components/settings';
import { GlossaryExtractionFailedDialog, GlossaryConfirmationModal, SimpleConfirmationModal } from '@/components/modals';
import { ToastContainer, ProgressOverlay } from '@/components/ui';

// Custom Hooks
import { useSettings, useToast, useSnapshots, useGlossaryFlow } from '@/hooks';

// Page Components
import { LogViewerModal } from '@/components/layout/LogViewerModal';
import { HomePage } from '@/components/pages/HomePage';
import { WorkspacePage } from '@/components/pages/WorkspacePage';


const ENV_GEMINI_KEY = (window as any).env?.GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY || '';
const ENV_OPENAI_KEY = (window as any).env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
















export default function App() {
    // View State
    const [view, setView] = useState<'home' | 'workspace'>('home');

    // Logic State
    const [activeTab, setActiveTab] = useState<'new' | 'import'>('new');
    const [settingsTab, setSettingsTab] = useState('general');

    const [file, setFile] = useState<File | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
    const [progressMsg, setProgressMsg] = useState('');
    const [chunkProgress, setChunkProgress] = useState<Record<string, ChunkStatus>>({});
    const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);

    const [showSnapshots, setShowSnapshots] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showGenreSettings, setShowGenreSettings] = useState(false);
    const [showGlossaryManager, setShowGlossaryManager] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Custom Hooks
    const { settings, isSettingsLoaded, updateSetting } = useSettings();
    const { toasts, addToast, removeToast } = useToast();
    const { snapshots, createSnapshot, clearSnapshots, setSnapshots } = useSnapshots();
    const {
        showGlossaryConfirmation,
        setShowGlossaryConfirmation,
        showGlossaryFailure,
        setShowGlossaryFailure,
        pendingGlossaryResults,
        setPendingGlossaryResults,
        glossaryMetadata,
        setGlossaryMetadata,
        glossaryConfirmCallback,
        setGlossaryConfirmCallback,
        isGeneratingGlossary,
        setIsGeneratingGlossary
    } = useGlossaryFlow();

    // Batch Selection & Comment State
    const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set());
    const [batchComments, setBatchComments] = useState<Record<number, string>>({});

    // View State
    const [showSourceText, setShowSourceText] = useState(true);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);

    const handleProgress = (update: ChunkStatus) => {
        setChunkProgress(prev => ({ ...prev, [update.id]: update }));
        if (update.message) setProgressMsg(update.message);
        if (update.toast) {
            addToast(update.toast.message, update.toast.type);
        }
    };

    // Phase 4 State
    const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
    const [termIssues, setTermIssues] = useState<TerminologyIssue[]>([]);

    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'info' | 'warning' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' = 'warning') => {
        setConfirmation({ isOpen: true, title, message, onConfirm, type });
    };

    // Logs State
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        setLogs(logger.getLogs());
        const unsubscribe = logger.subscribe((log) => {
            setLogs(prev => [...prev, log]);
        });
        return unsubscribe;
    }, []);

    // Refs
    const subtitleListRef = useRef<HTMLDivElement>(null);
    const audioCacheRef = useRef<{ file: File, buffer: AudioBuffer } | null>(null);

    const isProcessing = status === GenerationStatus.UPLOADING || status === GenerationStatus.PROCESSING || status === GenerationStatus.PROOFREADING;

    const isCustomGenre = !GENRE_PRESETS.includes(settings.genre);

    // Scroll to bottom on new subtitles
    useEffect(() => {
        if (status === GenerationStatus.PROCESSING && subtitleListRef.current) {
            subtitleListRef.current.scrollTop = subtitleListRef.current.scrollHeight;
        }
    }, [subtitles, status]);

    useEffect(() => {
        if (status === GenerationStatus.PROCESSING && subtitleListRef.current) {
            subtitleListRef.current.scrollTop = subtitleListRef.current.scrollHeight;
        }
    }, [subtitles, status]);

    // --- Helpers ---
    const getFileDuration = (f: File): Promise<number> => {
        return new Promise((resolve) => {
            const element = f.type.startsWith('audio') ? new Audio() : document.createElement('video');
            element.preload = 'metadata';
            const url = URL.createObjectURL(f);
            element.src = url;
            element.onloadedmetadata = () => { resolve(element.duration); URL.revokeObjectURL(url); };
            element.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
        });
    };


    const restoreSnapshot = (snapshot: SubtitleSnapshot) => {
        showConfirm(
            "恢复快照",
            `确定要恢复到 ${snapshot.timestamp} 的版本吗？当前未保存的进度将丢失。`,
            () => {
                setSubtitles(JSON.parse(JSON.stringify(snapshot.subtitles)));
                setBatchComments({ ...snapshot.batchComments });
                setShowSnapshots(false);
            },
            'warning'
        );
    };

    const toggleBatch = (index: number) => {
        const newSet = new Set(selectedBatches);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        setSelectedBatches(newSet);
    };

    const toggleAllBatches = (totalBatches: number) => {
        if (selectedBatches.size === totalBatches) setSelectedBatches(new Set());
        else setSelectedBatches(new Set(Array.from({ length: totalBatches }, (_, i) => i)));
    };

    const selectBatchesWithComments = (chunks: SubtitleItem[][]) => {
        const newSet = new Set<number>();
        chunks.forEach((chunk, idx) => {
            const hasBatchComment = batchComments[idx] && batchComments[idx].trim().length > 0;
            const hasLineComments = chunk.some(s => s.comment && s.comment.trim().length > 0);
            if (hasBatchComment || hasLineComments) newSet.add(idx);
        });
        setSelectedBatches(newSet);
    };



    // --- Handlers ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            const processFile = async () => {
                logger.info("File selected", { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type });
                setFile(selectedFile);
                audioCacheRef.current = null;
                setError(null);
                try { const d = await getFileDuration(selectedFile); setDuration(d); } catch (e) { setDuration(0); }
            };

            if (activeTab === 'new' && subtitles.length > 0 && status === GenerationStatus.COMPLETED) {
                showConfirm(
                    "替换文件",
                    "这将替换当前文件，可能需要重新生成。继续吗？",
                    () => {
                        setSubtitles([]); setStatus(GenerationStatus.IDLE); setSnapshots([]); setBatchComments({});
                        processFile();
                    },
                    'warning'
                );
            } else {
                processFile();
            }
        }
    };

    const handleSubtitleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const subFile = e.target.files[0];
            logger.info("Subtitle file imported", { name: subFile.name });
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = ev.target?.result as string;
                let parsed: SubtitleItem[] = [];
                if (subFile.name.endsWith('.ass')) parsed = parseAss(content);
                else parsed = parseSrt(content);
                setSubtitles(parsed);
                setStatus(GenerationStatus.COMPLETED);
                if (subtitles.length === 0) { setSnapshots([]); setBatchComments({}); }
                else { setSnapshots([]); setBatchComments({}); }
                createSnapshot("初始导入", parsed, {});
            };
            reader.readAsText(subFile);
        }
    };

    const handleGenerate = async () => {
        if (!file) { setError("请先上传媒体文件。"); return; }
        if ((!settings.geminiKey && !ENV_GEMINI_KEY) || (!settings.openaiKey && !ENV_OPENAI_KEY)) {
            setError("缺少 API 密钥。请在设置中配置。"); setShowSettings(true); return;
        }
        setStatus(GenerationStatus.UPLOADING); setError(null); setSubtitles([]); setSnapshots([]); setBatchComments({}); setSelectedBatches(new Set()); setChunkProgress({}); setStartTime(Date.now());
        logger.info("Starting subtitle generation", { file: file.name, duration, settings: { ...settings, geminiKey: '***', openaiKey: '***' } });
        try {
            setStatus(GenerationStatus.PROCESSING);

            // Prepare runtime settings with active glossary terms
            const activeGlossary = settings.glossaries?.find(g => g.id === settings.activeGlossaryId);
            const runtimeSettings = {
                ...settings,
                glossary: activeGlossary?.terms || settings.glossary || []
            };

            const { subtitles: result, glossaryResults } = await generateSubtitles(
                file,
                duration,
                runtimeSettings,
                handleProgress,
                (newSubs) => setSubtitles(newSubs),
                // onGlossaryReady callback (Blocking)
                async (metadata: GlossaryExtractionMetadata) => {
                    logger.info("onGlossaryReady called with metadata:", metadata);

                    if (settings.glossaryAutoConfirm && !metadata.hasFailures) {
                        const { unique } = mergeGlossaryResults(metadata.results);

                        if (settings.activeGlossaryId && settings.glossaries) {
                            const activeG = settings.glossaries.find(g => g.id === settings.activeGlossaryId);
                            const activeTerms = activeG?.terms || (activeG as any)?.items || [];
                            const existingTerms = new Set(activeTerms.map(g => g.term.toLowerCase()));
                            const newTerms = unique.filter(t => !existingTerms.has(t.term.toLowerCase()));

                            if (newTerms.length > 0) {
                                const updatedGlossaries = settings.glossaries.map(g => {
                                    if (g.id === settings.activeGlossaryId) {
                                        const currentTerms = g.terms || (g as any).items || [];
                                        return { ...g, terms: [...currentTerms, ...newTerms] };
                                    }
                                    return g;
                                });
                                updateSetting('glossaries', updatedGlossaries);
                                logger.info(`Auto-added ${newTerms.length} terms to active glossary`);
                                const updatedActive = updatedGlossaries.find(g => g.id === settings.activeGlossaryId);
                                return updatedActive?.terms || [];
                            }
                            return activeTerms;
                        } else {
                            // Fallback for legacy
                            const existingTerms = new Set(settings.glossary?.map(g => g.term.toLowerCase()) || []);
                            const newTerms = unique.filter(t => !existingTerms.has(t.term.toLowerCase()));
                            if (newTerms.length > 0) {
                                const updatedGlossary = [...(settings.glossary || []), ...newTerms];
                                updateSetting('glossary', updatedGlossary);
                                logger.info(`Auto-added ${newTerms.length} terms to glossary`);
                                return updatedGlossary;
                            }
                            return settings.glossary || [];
                        }
                    }

                    // Manual confirmation required
                    return new Promise<GlossaryItem[]>((resolve) => {
                        logger.info("Setting up UI for manual glossary confirmation...");
                        setGlossaryMetadata(metadata);

                        // Store the resolve function
                        setGlossaryConfirmCallback(() => (confirmedItems: GlossaryItem[]) => {
                            logger.info("User confirmed glossary terms:", confirmedItems.length);
                            // Settings are already updated by GlossaryConfirmationModal

                            // Cleanup UI
                            setShowGlossaryConfirmation(false);
                            setShowGlossaryFailure(false);
                            setPendingGlossaryResults([]);
                            setGlossaryMetadata(null);
                            setGlossaryConfirmCallback(null);

                            resolve(confirmedItems);
                        });

                        if (metadata.totalTerms > 0) {
                            setPendingGlossaryResults(metadata.results);
                            setShowGlossaryConfirmation(true);
                        } else if (metadata.hasFailures) {
                            setShowGlossaryFailure(true);
                        } else {
                            // Should not happen if gemini.ts logic is correct, but safe fallback
                            if (settings.activeGlossaryId && settings.glossaries) {
                                const activeG = settings.glossaries.find(g => g.id === settings.activeGlossaryId);
                                resolve(activeG?.terms || []);
                            } else {
                                resolve(settings.glossary || []);
                            }
                        }
                    });
                }
            );

            // Then check subtitle results
            if (result.length === 0) throw new Error("No subtitles were generated.");

            setSubtitles(result);
            setStatus(GenerationStatus.COMPLETED);
            createSnapshot("初始生成", result, {});

            logger.info("Subtitle generation completed", { count: result.length });
            addToast("字幕生成成功！", "success");
        } catch (err: any) {
            setStatus(GenerationStatus.ERROR);
            setError(err.message);
            logger.error("Subtitle generation failed", err);
            addToast(`生成失败: ${err.message}`, "error");
        }
    };

    const handleBatchAction = async (mode: BatchOperationMode, singleIndex?: number) => {
        const indices: number[] = singleIndex !== undefined ? [singleIndex] : Array.from(selectedBatches) as number[];
        if (indices.length === 0) return;
        if (!settings.geminiKey && !ENV_GEMINI_KEY) { setError("缺少 API 密钥。"); return; }
        if (mode === 'fix_timestamps' && !file) { setError("没有源媒体文件无法修复时间轴。"); return; }
        setStatus(GenerationStatus.PROOFREADING); setError(null); setChunkProgress({}); setStartTime(Date.now());
        logger.info(`Starting batch action: ${mode}`, { indices, mode });
        try {
            const refined = await runBatchOperation(file, subtitles, indices, settings, mode, batchComments, handleProgress);
            setSubtitles(refined); setStatus(GenerationStatus.COMPLETED);
            setBatchComments(prev => { const next = { ...prev }; indices.forEach(idx => delete next[idx]); return next; });
            if (singleIndex === undefined) setSelectedBatches(new Set());
            const actionName = mode === 'fix_timestamps' ? '修复时间轴' : '校对';
            createSnapshot(`${actionName} (${indices.length} 个片段)`, refined);
            logger.info(`Batch action ${mode} completed`);
            addToast(`批量操作 '${actionName}' 成功完成！`, "success");
        } catch (err: any) {
            setStatus(GenerationStatus.ERROR);
            setError(`操作失败: ${err.message}`);
            logger.error(`Batch action ${mode} failed`, err);
            addToast(`批量操作失败: ${err.message}`, "error");
        }
    };





    const handleDownload = (format: 'srt' | 'ass') => {
        if (subtitles.length === 0) return;
        const isBilingual = settings.outputMode === 'bilingual';
        const content = format === 'srt'
            ? generateSrtContent(subtitles, isBilingual)
            : generateAssContent(subtitles, file ? file.name : "video", isBilingual);
        const filename = file ? file.name.replace(/\.[^/.]+$/, "") : "subtitles";
        logger.info(`Downloading subtitles: ${filename}.${format}`);
        downloadFile(`${filename}.${format}`, content, format);
    };

    const updateBatchComment = (index: number, comment: string) => {
        setBatchComments(prev => ({ ...prev, [index]: comment }));
    };

    const updateLineComment = (id: number, comment: string) => {
        setSubtitles(prev => prev.map(s => s.id === id ? { ...s, comment } : s));
    };

    const goBackHome = () => {
        const doGoBack = () => {
            setView('home'); setSubtitles([]); setFile(null); setDuration(0); setStatus(GenerationStatus.IDLE); setSnapshots([]); setBatchComments({}); setSelectedBatches(new Set()); setError(null);
        };

        if (subtitles.length > 0) {
            showConfirm(
                "返回主页",
                "返回主页？未保存的进度将丢失。",
                doGoBack,
                'warning'
            );
        } else {
            doGoBack();
        }
    };
    const startNewProject = () => { setActiveTab('new'); setView('workspace'); setSubtitles([]); setFile(null); setDuration(0); setStatus(GenerationStatus.IDLE); setSnapshots([]); setBatchComments({}); setSelectedBatches(new Set()); setError(null); };
    const startImportProject = () => { setActiveTab('import'); setView('workspace'); setSubtitles([]); setFile(null); setDuration(0); setStatus(GenerationStatus.IDLE); setSnapshots([]); setBatchComments({}); setSelectedBatches(new Set()); setError(null); };

    // --- Render Components ---













    const handleRetryGlossary = async () => {
        if (!glossaryMetadata?.glossaryChunks || !audioCacheRef.current) return;

        setIsGeneratingGlossary(true);
        try {
            const apiKey = settings.geminiKey || ENV_GEMINI_KEY;
            const newMetadata = await retryGlossaryExtraction(
                apiKey,
                audioCacheRef.current.buffer,
                glossaryMetadata.glossaryChunks,
                settings.genre,
                settings.concurrencyPro,
                settings.geminiEndpoint,
                (settings.requestTimeout || 600) * 1000
            );

            setGlossaryMetadata(newMetadata);
            if (newMetadata.totalTerms > 0 || newMetadata.hasFailures) {
                if (newMetadata.totalTerms > 0) {
                    setPendingGlossaryResults(newMetadata.results);
                    setShowGlossaryConfirmation(true);
                    setShowGlossaryFailure(false);
                } else {
                    setShowGlossaryFailure(true); // Still failed
                }
            } else {
                // Empty results, no failure
                if (glossaryConfirmCallback) {
                    glossaryConfirmCallback(settings.glossary || []);
                    setGlossaryConfirmCallback(null);
                }
                setShowGlossaryFailure(false);
                setGlossaryMetadata(null);
            }

        } catch (e) {
            logger.error("Retry failed", e);
            setError("Retry failed: " + (e as Error).message);
        } finally {
            setIsGeneratingGlossary(false);
        }
    };



    return (
        <>
            <GlossaryConfirmationModal
                isOpen={showGlossaryConfirmation}
                pendingResults={pendingGlossaryResults}
                settings={settings}
                onConfirm={(items) => glossaryConfirmCallback?.(items)}
                onUpdateSetting={updateSetting}
            />
            <GlossaryExtractionFailedDialog
                isOpen={showGlossaryFailure}
                isGeneratingGlossary={isGeneratingGlossary}
                glossaryConfirmCallback={glossaryConfirmCallback}
                settings={settings}
                onRetry={handleRetryGlossary}
                onContinue={() => {
                    setShowGlossaryFailure(false);
                    if (glossaryConfirmCallback) {
                        glossaryConfirmCallback(settings.glossary || []);
                        setGlossaryConfirmCallback(null);
                    }
                }}
            />
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                activeTab={settingsTab}
                setActiveTab={setSettingsTab}
                settings={settings}
                updateSetting={updateSetting}
                envGeminiKey={ENV_GEMINI_KEY}
                envOpenaiKey={ENV_OPENAI_KEY}
                onOpenGlossaryManager={() => {
                    setShowSettings(false);
                    setShowGlossaryManager(true);
                }}
            />
            {showGlossaryManager && (
                <GlossaryManager
                    glossaries={settings.glossaries || []}
                    activeGlossaryId={settings.activeGlossaryId || null}
                    onUpdateGlossaries={(updated) => updateSetting('glossaries', updated)}
                    onSetActiveGlossary={(id) => updateSetting('activeGlossaryId', id)}
                    onClose={() => setShowGlossaryManager(false)}
                />
            )}
            <LogViewerModal
                isOpen={showLogs}
                logs={logs}
                onClose={() => setShowLogs(false)}
            />
            {view === 'home' && (
                <HomePage
                    onStartNew={() => {
                        setActiveTab('new');
                        setView('workspace');
                    }}
                    onStartImport={() => {
                        setActiveTab('import');
                        setView('workspace');
                    }}
                    onShowLogs={() => setShowLogs(true)}
                    onShowGlossary={() => setShowGlossaryManager(true)}
                    onShowSettings={() => setShowSettings(true)}
                />
            )}
            {view === 'workspace' && (
                <WorkspacePage
                    activeTab={activeTab}
                    file={file}
                    duration={duration}
                    subtitles={subtitles}
                    status={status}
                    error={error}
                    settings={settings}
                    snapshots={snapshots}
                    showSnapshots={showSnapshots}
                    selectedBatches={selectedBatches}
                    batchComments={batchComments}
                    showSourceText={showSourceText}
                    editingCommentId={editingCommentId}
                    onFileChange={handleFileChange}
                    onSubtitleImport={handleSubtitleImport}
                    onGenerate={handleGenerate}
                    onDownload={handleDownload}
                    onGoBack={goBackHome}
                    onShowLogs={() => setShowLogs(true)}
                    onShowGlossary={() => setShowGlossaryManager(true)}
                    onShowSettings={() => setShowSettings(true)}
                    onShowGenreSettings={() => setShowGenreSettings(true)}
                    onUpdateSetting={updateSetting}
                    onToggleSnapshots={() => setShowSnapshots(!showSnapshots)}
                    onRestoreSnapshot={restoreSnapshot}
                    toggleAllBatches={toggleAllBatches}
                    selectBatchesWithComments={selectBatchesWithComments}
                    setShowSourceText={setShowSourceText}
                    handleBatchAction={handleBatchAction}
                    toggleBatch={toggleBatch}
                    updateBatchComment={updateBatchComment}
                    setEditingCommentId={setEditingCommentId}
                    updateLineComment={updateLineComment}
                />
            )}
            <GenreSettingsDialog
                isOpen={showGenreSettings}
                onClose={() => setShowGenreSettings(false)}
                currentGenre={settings.genre}
                onSave={(genre) => updateSetting('genre', genre)}
            />
            <ProgressOverlay
                isProcessing={isProcessing}
                chunkProgress={chunkProgress}
                status={status}
                startTime={startTime || 0}
            />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <SimpleConfirmationModal
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
                type={confirmation.type}
            />
        </>
    );
}

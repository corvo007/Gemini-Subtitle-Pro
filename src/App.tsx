import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { GenerationStatus } from '@/types/api';
import { logger, type LogEntry } from '@/services/utils/logger';
import { type SpeakerUIProfile } from '@/types/speaker';

import { GlossaryManager } from '@/components/glossary/GlossaryManager';
import { SettingsModal, GenreSettingsDialog } from '@/components/settings';
import {
  GlossaryExtractionFailedDialog,
  GlossaryConfirmationModal,
  SimpleConfirmationModal,
  SpeakerManagerModal,
} from '@/components/modals';
import { ToastContainer, ProgressOverlay } from '@/components/ui';

// Custom Hooks
import { useSnapshots, useGlossaryFlow, useWorkspaceLogic } from '@/hooks';
import { getActiveGlossaryTerms } from '@/services/glossary/utils';
import { useEndToEndSubtitleGeneration } from '@/hooks/useEndToEndSubtitleGeneration';

// Global Store
import { useAppStore, initializeSettings } from '@/store/useAppStore';

// Page Components
import { LogViewerModal } from '@/components/layout/LogViewerModal';
import { HomePage } from '@/components/pages/HomePage';
import { WorkspacePage } from '@/components/pages/WorkspacePage';
import { DownloadPage } from '@/components/pages';
import { CompressionPage } from '@/components/pages/CompressionPage';
import { EndToEndWizard } from '@/components/endToEnd';

import { ENV } from '@/config';

export default function App() {
  const { t } = useTranslation('app');
  // View State
  // View State
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  const [activeTab, setActiveTab] = useState<'new' | 'import'>('new');

  // Downloaded video path - for passing to compression page
  const [downloadedVideoPath, setDownloadedVideoPath] = useState<string | null>(null);

  // Global Store (Zustand)
  const settings = useAppStore((s) => s.settings);
  const isSettingsLoaded = useAppStore((s) => s.isSettingsLoaded);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const toasts = useAppStore((s) => s.toasts);
  const addToast = useAppStore((s) => s.addToast);
  const removeToast = useAppStore((s) => s.removeToast);
  const showSettings = useAppStore((s) => s.showSettings);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const showLogs = useAppStore((s) => s.showLogs);
  const setShowLogs = useAppStore((s) => s.setShowLogs);
  const showGlossaryManager = useAppStore((s) => s.showGlossaryManager);
  const setShowGlossaryManager = useAppStore((s) => s.setShowGlossaryManager);
  const showSpeakerManager = useAppStore((s) => s.showSpeakerManager);
  const setShowSpeakerManager = useAppStore((s) => s.setShowSpeakerManager);
  const showSnapshots = useAppStore((s) => s.showSnapshots);
  const setShowSnapshots = useAppStore((s) => s.setShowSnapshots);
  const showGenreSettings = useAppStore((s) => s.showGenreSettings);
  const setShowGenreSettings = useAppStore((s) => s.setShowGenreSettings);
  const settingsTab = useAppStore((s) => s.settingsTab);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);

  // Custom Hooks
  const snapshotsValues = useSnapshots();
  const glossaryFlow = useGlossaryFlow();

  // End-to-End Subtitle Generation Handler
  // This hook listens for IPC requests from main process and executes generation
  useEndToEndSubtitleGeneration({ settings, updateSetting });

  // Initialize language from settings on app startup
  useEffect(() => {
    if (isSettingsLoaded && settings.language) {
      if (i18n.language !== settings.language) {
        void i18n.changeLanguage(settings.language);
      }
    }
  }, [isSettingsLoaded, settings.language]);

  // Analytics: Track Page Views
  useEffect(() => {
    if (window.electronAPI?.analytics) {
      void window.electronAPI.analytics.track('page_view', { name: view }, 'page_view');
    }
  }, [view]);

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
    onConfirm: () => {},
    type: 'warning',
  });

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      type: 'info' | 'warning' | 'danger' = 'warning'
    ) => {
      setConfirmation({ isOpen: true, title, message, onConfirm, type });
    },
    []
  );

  // Workspace Logic
  const workspace = useWorkspaceLogic({
    addToast,
    showConfirm,
    glossaryFlow,
    snapshotsValues,
    setShowSettings,
  });

  // Memoize speakerCounts to avoid recomputing on every render (Audit fix)
  const speakerCounts = useMemo(() => {
    return workspace.subtitles.reduce(
      (acc, sub) => {
        if (sub.speaker) {
          acc[sub.speaker] = (acc[sub.speaker] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  }, [workspace.subtitles]);

  // Logs State (logs array is local, showLogs comes from store)
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Initialize settings from storage on mount
  useEffect(() => {
    void initializeSettings();
  }, []);

  useEffect(() => {
    // Initial load of frontend logs
    setLogs(logger.getLogs());

    // Subscribe to new frontend logs
    const unsubscribe = logger.subscribe((log) => {
      setLogs((prev) => [...prev, log]);

      // Auto-toast for errors or explicit toast request
      if (log.level === 'ERROR') {
        addToast(log.message, 'error', 5000);
      } else if (log.data?.toast) {
        const type = log.data.toastType || (log.level === 'WARN' ? 'warning' : 'info');
        addToast(log.message, type, 5000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addToast]);

  // Backend logs handling - Global subscription
  const initRef = React.useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let unsubscribeBackend: (() => void) | undefined;

    const initBackendLogs = async () => {
      if (window.electronAPI && window.electronAPI.getMainLogs) {
        try {
          // historyLogs can be string[] (legacy) or LogEntry[] (new)
          const historyLogs = await window.electronAPI.getMainLogs();
          logger.info(`[App] Loaded ${historyLogs.length} historical logs from backend`);

          const { parseBackendLog } = await import('@/services/utils/logParser');

          const parsedHistory = historyLogs
            .map((logItem) => {
              // If it's already a structured log object from new backend
              if (typeof logItem === 'object' && logItem !== null && 'level' in logItem) {
                return logItem as LogEntry;
              }
              // Fallback for legacy string logs
              if (typeof logItem === 'string') {
                try {
                  return parseBackendLog(logItem);
                } catch {
                  return null;
                }
              }
              return null;
            })
            .filter((l) => l !== null) as LogEntry[];

          setLogs((prev) => {
            // Merge avoiding duplicates
            const newLogs = [...prev];
            parsedHistory.forEach((pl) => {
              // Deduplicate based on timestamp + message to avoid exact dupes
              // or raw string match if available
              if (
                !newLogs.some(
                  (existing) =>
                    existing.timestamp === pl.timestamp &&
                    existing.message === pl.message &&
                    JSON.stringify(existing.data) === JSON.stringify(pl.data) // Rough deep eq
                )
              ) {
                newLogs.push(pl);
              }
            });
            // Preserve insertion order - logs are already chronological
            return newLogs;
          });
        } catch (err) {
          logger.error('Failed to load backend log history', err);
        }
      }
    };

    if (window.electronAPI && window.electronAPI.onNewLog) {
      // Initialize history first
      initBackendLogs().catch((err) => logger.error('[App] Failed to init backend logs', err));

      unsubscribeBackend = window.electronAPI.onNewLog(async (newLog) => {
        // Print to DevTools console for visibility
        // logger.debug(`[Main]`, newLog);

        try {
          let parsed: LogEntry;

          if (typeof newLog === 'object' && newLog !== null) {
            parsed = newLog as LogEntry;
          } else {
            const { parseBackendLog } = await import('@/services/utils/logParser');
            parsed = parseBackendLog(String(newLog));
          }

          setLogs((prev) => {
            // Deduplication Logic
            const isDuplicate = prev.some((l) => {
              // 1. Exact match (already covered)
              if (
                l.timestamp === parsed.timestamp &&
                l.message === parsed.message &&
                JSON.stringify(l.data) === JSON.stringify(parsed.data)
              )
                return true;

              // 2. Renderer Echo Match
              // Backend prepends "[Renderer] " to logs originating from frontend
              if (parsed.message.startsWith('[Renderer] ')) {
                const cleanMessage = parsed.message.replace('[Renderer] ', '');
                // Check if we have a local log with same message and data
                // Timestamp check: backend timestamp might differ slightly if generated there?
                // But in our current impl, backend just passes through.
                // However, logger.ts generates simple timestamp.
                // Let's rely on message + data content strict match.
                if (
                  l.message === cleanMessage &&
                  JSON.stringify(l.data) === JSON.stringify(parsed.data)
                ) {
                  return true;
                }
              }
              return false;
            });

            if (isDuplicate) return prev;
            return [...prev, parsed];
          });
        } catch (err) {
          logger.error('Error parsing real-time log', err);
        }
      });
    }

    return () => {
      if (unsubscribeBackend) unsubscribeBackend();
    };
  }, []);

  // Navigation Handlers
  const goBackHome = () => {
    // Preserve workspace state when navigating back
    setView('home');
  };

  return (
    <>
      <GlossaryConfirmationModal
        isOpen={glossaryFlow.showGlossaryConfirmation}
        pendingResults={glossaryFlow.pendingGlossaryResults}
        settings={settings}
        onConfirm={(items) => glossaryFlow.glossaryConfirmCallback?.(items)}
        onUpdateSetting={updateSetting}
      />
      <GlossaryExtractionFailedDialog
        isOpen={glossaryFlow.showGlossaryFailure}
        isGeneratingGlossary={glossaryFlow.isGeneratingGlossary}
        glossaryConfirmCallback={glossaryFlow.glossaryConfirmCallback}
        onRetry={workspace.handleRetryGlossary}
        onContinue={() => {
          glossaryFlow.setShowGlossaryFailure(false);
          if (glossaryFlow.glossaryConfirmCallback) {
            glossaryFlow.glossaryConfirmCallback(getActiveGlossaryTerms(settings));
            glossaryFlow.setGlossaryConfirmCallback(null);
          }
        }}
      />
      <SettingsModal
        envGeminiKey={ENV.GEMINI_API_KEY}
        envOpenaiKey={ENV.OPENAI_API_KEY}
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
      <LogViewerModal isOpen={showLogs} logs={logs} onClose={() => setShowLogs(false)} />
      {view === 'home' && (
        <HomePage
          onStartNew={() => {
            // If there are existing subtitles, ask user before clearing
            if (workspace.subtitles.length > 0) {
              showConfirm(
                t('confirmations.switchToNew.title'),
                t('confirmations.switchToNew.message'),
                () => {
                  workspace.resetWorkspace();
                  setActiveTab('new');
                  setView('workspace');
                },
                'warning'
              );
            } else {
              setActiveTab('new');
              setView('workspace');
            }
          }}
          onStartImport={() => {
            setActiveTab('import');
            setView('workspace');
          }}
          onStartDownload={() => setView('download')}
          onStartCompression={() => setView('compression')}
          onStartEndToEnd={() => setView('endToEnd')}
        />
      )}
      {view === 'download' && (
        <DownloadPage
          onGoBack={() => setView('home')}
          onDownloadComplete={(videoPath) => {
            setDownloadedVideoPath(videoPath);
            setActiveTab('new');
            setView('workspace');
            workspace.resetWorkspace();
            void workspace.loadFileFromPath(videoPath);
          }}
        />
      )}
      {view === 'compression' && (
        <CompressionPage
          onGoBack={() => setView('home')}
          workspaceSubtitles={workspace.subtitles}
          workspaceVideoFile={workspace.file}
          workspaceSpeakerProfiles={workspace.speakerProfiles}
          downloadedVideoPath={downloadedVideoPath}
        />
      )}
      {view === 'endToEnd' && (
        <EndToEndWizard
          settings={settings}
          onComplete={() => setView('home')}
          onCancel={() => setView('home')}
        />
      )}
      {view === 'workspace' && (
        <WorkspacePage
          activeTab={activeTab}
          snapshots={snapshotsValues.snapshots}
          onGoBack={goBackHome}
          onToggleSnapshots={() => setShowSnapshots(!showSnapshots)}
          onRestoreSnapshot={(snap) => {
            // Detect cross-file restore
            const currentFileId = workspace.file
              ? window.electronAPI?.getFilePath?.(workspace.file) || workspace.file.name
              : '';
            const isCrossFile = currentFileId && currentFileId !== snap.fileId;

            const message = isCrossFile
              ? t('confirmations.restoreSnapshot.messageWithFile', {
                  fileName: snap.fileName,
                  timestamp: snap.timestamp,
                })
              : t('confirmations.restoreSnapshot.messageGeneric', { timestamp: snap.timestamp });

            showConfirm(
              t('confirmations.restoreSnapshot.title'),
              message,
              () => {
                // 1. Backup current state (if there are subtitles)
                if (workspace.subtitles.length > 0) {
                  snapshotsValues.createSnapshot(
                    t('confirmations.restoreSnapshot.backupLabel'),
                    workspace.subtitles,
                    workspace.batchComments,
                    currentFileId || 'unknown',
                    workspace.file?.name || t('confirmations.restoreSnapshot.unknownFile'),
                    workspace.speakerProfiles
                  );
                }

                // 2. Restore subtitles and batch comments (use structuredClone for perf)
                workspace.setSubtitles(structuredClone(snap.subtitles));
                workspace.setBatchComments({ ...snap.batchComments });

                // 3. Sync speakerProfiles (use saved profiles if available, otherwise extract from subtitles)
                if (snap.speakerProfiles && snap.speakerProfiles.length > 0) {
                  workspace.setSpeakerProfiles(structuredClone(snap.speakerProfiles));
                } else {
                  const uniqueSpeakers = Array.from(
                    new Set(snap.subtitles.map((s) => s.speaker).filter(Boolean))
                  ) as string[];
                  const profiles: SpeakerUIProfile[] = uniqueSpeakers.map((name) => ({
                    id: name,
                    name: name,
                  }));
                  workspace.setSpeakerProfiles(profiles);
                }

                // 4. Sync subtitle file name
                workspace.setSubtitleFileName(snap.fileName || null);

                // 5. Clear selection state
                workspace.setSelectedBatches(new Set());
                workspace.setEditingCommentId(null);

                // 6. Close snapshot panel
                setShowSnapshots(false);
              },
              'info'
            );
          }}
          onStartCompression={() => setView('compression')}
          onDeleteSnapshot={snapshotsValues.deleteSnapshot}
        />
      )}
      <GenreSettingsDialog
        isOpen={showGenreSettings}
        onClose={() => setShowGenreSettings(false)}
        currentGenre={settings.genre}
        onSave={(genre) => updateSetting('genre', genre)}
      />
      <ProgressOverlay
        isProcessing={
          workspace.status === GenerationStatus.UPLOADING ||
          workspace.status === GenerationStatus.PROCESSING ||
          workspace.status === GenerationStatus.PROOFREADING
        }
        chunkProgress={workspace.chunkProgress}
        status={workspace.status}
        startTime={workspace.startTime || 0}
        onShowLogs={() => setShowLogs(true)}
        onCancel={workspace.cancelOperation}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <SpeakerManagerModal
        isOpen={showSpeakerManager}
        onClose={() => setShowSpeakerManager(false)}
        speakerProfiles={workspace.speakerProfiles}
        speakerCounts={speakerCounts}
        onRename={workspace.renameSpeaker}
        onDelete={workspace.deleteSpeaker}
        onMerge={workspace.mergeSpeakers}
        onCreate={workspace.addSpeaker}
        onUpdateColor={workspace.updateSpeakerColor}
      />
      <SimpleConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={() => setConfirmation((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        type={confirmation.type}
      />
    </>
  );
}

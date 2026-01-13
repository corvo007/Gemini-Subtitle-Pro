import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle,
  Pencil,
  Clock,
  Type,
  AlertTriangle,
  Trash2,
  CheckSquare,
  Square,
  Plus,
  MoreVertical,
  ChevronRight,
  Rewind,
  AlertOctagon,
} from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { type SubtitleItem } from '@/types';
import { type SpeakerUIProfile } from '@/types/speaker';
import { SpeakerSelect } from '@/components/editor/SpeakerSelect';
import { cn } from '@/lib/cn';
import { countCJKCharacters } from '@/lib/text';
import { useDropdownDirection } from '@/hooks/useDropdownDirection';
import { timeToSeconds, formatTime, calculateDuration } from '@/services/subtitle/time';

// Validation thresholds (from prompts.ts rules)
const MAX_DURATION_SECONDS = 10;
const MAX_CHINESE_CHARACTERS = 25;

/**
 * Validate and normalize time input to HH:MM:SS,mmm format.
 * Uses timeToSeconds + formatTime from time.ts for conversion.
 */
const validateAndNormalizeTime = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try parsing with timeToSeconds (handles HH:MM:SS,mmm and MM:SS formats)
  const seconds = timeToSeconds(trimmed);

  // Accept if: non-zero result, OR input looks like a valid zero timestamp
  // Zero timestamps: "00:00:00", "0:00", "00:00", "00:00:00,000", etc.
  const isValidZero = seconds === 0 && /^\d{1,2}:\d{2}(:\d{2})?(,\d+)?$/.test(trimmed);

  if (seconds > 0 || isValidZero) {
    return formatTime(seconds);
  }

  return null;
};

// Overlap threshold in seconds (only show warning if overlap > this value)
const OVERLAP_THRESHOLD_SECONDS = 2;

// Validation result type
export interface ValidationResult {
  hasDurationIssue: boolean;
  hasLengthIssue: boolean;
  hasOverlapIssue: boolean;
  hasConfidenceIssue: boolean;
  hasRegressionIssue: boolean;
  hasCorruptedRangeIssue: boolean;
  duration: number;
  charCount: number;
  overlapAmount: number; // How many seconds of overlap (negative means gap)
}

// Validate a subtitle item
export const validateSubtitle = (sub: SubtitleItem, prevEndTime?: string): ValidationResult => {
  const duration = calculateDuration(sub.startTime, sub.endTime);
  const charCount = countCJKCharacters(sub.translated);

  // Check overlap: current start time < previous end time
  let overlapAmount = 0;
  if (prevEndTime) {
    const prevEnd = timeToSeconds(prevEndTime);
    const currentStart = timeToSeconds(sub.startTime);
    overlapAmount = prevEnd - currentStart; // Positive means overlap
  }

  // Only flag as issue if overlap exceeds threshold
  const hasOverlapIssue = overlapAmount > OVERLAP_THRESHOLD_SECONDS;

  return {
    hasDurationIssue: duration > MAX_DURATION_SECONDS,
    hasLengthIssue: charCount > MAX_CHINESE_CHARACTERS,
    hasOverlapIssue,
    hasConfidenceIssue: !!sub.lowConfidence,
    hasRegressionIssue: !!sub.hasRegressionIssue,
    hasCorruptedRangeIssue: !!sub.hasCorruptedRangeIssue,
    duration,
    charCount,
    overlapAmount,
  };
};

interface SubtitleRowProps {
  sub: SubtitleItem;
  showSourceText: boolean;
  editingCommentId: string | null;
  setEditingCommentId: (id: string | null) => void;
  updateLineComment: (id: string, comment: string) => void;
  updateSubtitleText: (id: string, translated: string) => void;
  updateSubtitleOriginal: (id: string, original: string) => void;
  updateSpeaker?: (id: string, speaker: string, applyToAll?: boolean) => void;
  updateSubtitleTime?: (id: string, startTime: string, endTime: string) => void;
  prevEndTime?: string; // For overlap detection
  speakerProfiles?: SpeakerUIProfile[];
  onManageSpeakers?: () => void;
  deleteSubtitle?: (id: string) => void;
  // Delete mode
  isDeleteMode?: boolean;
  isSelectedForDelete?: boolean;
  onToggleDeleteSelection?: (id: string) => void;
  // Add subtitle
  addSubtitle?: (referenceId: string, position: 'before' | 'after', defaultTime: string) => void;
  // Video sync
  currentPlayTime?: number;
  onRowClick?: (startTime: string) => void;
}

export const SubtitleRow: React.FC<SubtitleRowProps> = React.memo(
  ({
    sub,
    showSourceText,
    editingCommentId,
    setEditingCommentId,
    updateLineComment,
    updateSubtitleText,
    updateSubtitleOriginal,
    updateSpeaker,
    updateSubtitleTime,
    prevEndTime,
    speakerProfiles,
    onManageSpeakers,
    deleteSubtitle,
    // Delete mode
    isDeleteMode,
    isSelectedForDelete,
    onToggleDeleteSelection,
    // Add subtitle
    addSubtitle,
    // Playback
    currentPlayTime,
    onRowClick,
  }) => {
    const { t } = useTranslation('editor');
    const [editing, setEditing] = React.useState(false);
    const [tempText, setTempText] = React.useState('');
    const [tempOriginal, setTempOriginal] = React.useState('');
    const [tempStartTime, setTempStartTime] = React.useState('');
    const [tempEndTime, setTempEndTime] = React.useState('');
    const [validationError, setValidationError] = React.useState<string | null>(null);

    const [showAddMenu, setShowAddMenu] = React.useState(false);
    const [showAddSubmenu, setShowAddSubmenu] = React.useState(false);
    const [menuDropUp, setMenuDropUp] = React.useState(false);
    const [submenuDropLeft, setSubmenuDropLeft] = React.useState(false);
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
    const { ref: addMenuRef, getDirection } = useDropdownDirection<HTMLDivElement>();
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Check if this row is currently active based on play time
    const isActive = React.useMemo(() => {
      if (currentPlayTime === undefined) return false;
      // Parse current start/end times
      const start = timeToSeconds(sub.startTime);
      const end = timeToSeconds(sub.endTime);
      return currentPlayTime >= start && currentPlayTime <= end;
    }, [currentPlayTime, sub.startTime, sub.endTime]);

    // Close add menu when clicking outside
    React.useEffect(() => {
      if (!showAddMenu) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (
          addMenuRef.current &&
          !addMenuRef.current.contains(e.target as Node) &&
          menuRef.current &&
          !menuRef.current.contains(e.target as Node)
        ) {
          setShowAddMenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAddMenu, addMenuRef]);
    React.useEffect(() => {
      if (!showAddMenu) setShowAddSubmenu(false);
    }, [showAddMenu]);

    // Clear validation error after 3 seconds
    React.useEffect(() => {
      if (!validationError) return;
      const timer = setTimeout(() => setValidationError(null), 3000);
      return () => clearTimeout(timer);
    }, [validationError]);

    // Toggle menu with smart direction detection
    const toggleMenu = () => {
      if (!showAddMenu) {
        const { dropUp, dropLeft } = getDirection();
        setMenuDropUp(dropUp);
        setSubmenuDropLeft(dropLeft);

        // Calculate fixed position
        if (addMenuRef.current) {
          const rect = addMenuRef.current.getBoundingClientRect();
          const style: React.CSSProperties = {
            position: 'fixed',
            zIndex: 9999, // Ensure it's above everything
            minWidth: '130px',
          };

          // Vertical positioning
          if (dropUp) {
            style.bottom = window.innerHeight - rect.top + 4;
            style.top = 'auto';
          } else {
            style.top = rect.bottom + 4;
            style.bottom = 'auto';
          }

          // Horizontal positioning (Align Right)
          style.right = window.innerWidth - rect.right;
          style.left = 'auto';

          setMenuStyle(style);
        }
      }
      setShowAddMenu(!showAddMenu);
    };

    // Calculate submenu direction on hover
    const handleSubmenuEnter = () => {
      if (addMenuRef.current) {
        const rect = addMenuRef.current.getBoundingClientRect();
        // If less than 130px to the left, open to the right
        setSubmenuDropLeft(rect.left > 130);
      }
      setShowAddSubmenu(true);
    };

    // Validate this subtitle
    const validation = React.useMemo(() => validateSubtitle(sub, prevEndTime), [sub, prevEndTime]);

    // Count total issues for background color
    const issueCount = [
      validation.hasDurationIssue,
      validation.hasLengthIssue,
      validation.hasOverlapIssue,
      validation.hasConfidenceIssue,
      validation.hasRegressionIssue,
      validation.hasCorruptedRangeIssue,
    ].filter(Boolean).length;

    // Determine background color based on validation issues
    const getRowBackgroundClass = (): string => {
      // Timeline corruption takes highest priority (red)
      if (sub.hasCorruptedRangeIssue) {
        return 'bg-red-900/30 border-l-2 border-red-500';
      }
      // Timeline regression (pink)
      if (sub.hasRegressionIssue) {
        return 'bg-pink-900/30 border-l-2 border-pink-500';
      }
      if (issueCount >= 2) {
        // Multiple issues: purple/violet background
        return 'bg-violet-900/30 border-l-2 border-violet-500';
      } else if (validation.hasOverlapIssue) {
        // Overlap issue: orange background
        return 'bg-orange-900/30 border-l-2 border-orange-500';
      } else if (validation.hasDurationIssue) {
        // Duration issue only: yellow background
        return 'bg-yellow-900/30 border-l-2 border-yellow-500';
      } else if (validation.hasLengthIssue) {
        // Length issue only: rose/red background
        return 'bg-rose-900/30 border-l-2 border-rose-500';
      } else if (sub.lowConfidence) {
        // Low confidence alignment: amber/orange background
        return 'bg-amber-900/30 border-l-2 border-amber-500';
      }
      return '';
    };

    const handleStartEdit = () => {
      setTempText(sub.translated);
      setTempOriginal(sub.original);
      setTempStartTime(sub.startTime || ''); // Show full time with ms for precise editing
      setTempEndTime(sub.endTime || '');
      setEditing(true);
    };

    const handleSave = () => {
      // 1. Validation: Empty content
      if (!tempText.trim()) {
        const msg = t('subtitleRow.errors.emptyContent');
        setValidationError(msg);
        handleCancel();
        return; // Block save
      }

      // 2. Validation: Time format and logic
      let normalizedStart = sub.startTime;
      let normalizedEnd = sub.endTime;
      let timeChanged = false;

      if (updateSubtitleTime) {
        const ns = validateAndNormalizeTime(tempStartTime);
        const ne = validateAndNormalizeTime(tempEndTime);

        if (ns && ne) {
          const startSec = timeToSeconds(ns);
          const endSec = timeToSeconds(ne);
          const duration = endSec - startSec;

          // Check 2.1: End time < Start time
          if (endSec < startSec) {
            const msg = t('subtitleRow.errors.startTimeAfterEndTime');
            setValidationError(msg);
            handleCancel();
            return; // Block save
          }

          // Check 2.2: Duration too short (< 0.2s)
          if (duration < 0.2) {
            const msg = t('subtitleRow.errors.durationTooShort');
            setValidationError(msg);
            handleCancel();
            return; // Block save
          }

          if (ns !== sub.startTime || ne !== sub.endTime) {
            normalizedStart = ns;
            normalizedEnd = ne;
            timeChanged = true;
          }
        }
      }

      // If we got here, inputs are valid. Proceed to save.
      if (tempText.trim() !== sub.translated) {
        updateSubtitleText(sub.id, tempText.trim());
      }
      if (showSourceText && tempOriginal.trim() !== sub.original) {
        updateSubtitleOriginal(sub.id, tempOriginal.trim());
      }

      if (timeChanged && updateSubtitleTime) {
        updateSubtitleTime(sub.id, normalizedStart, normalizedEnd);
      }

      setEditing(false);
    };

    const handleCancel = () => {
      setEditing(false);
      setTempText('');
      setTempOriginal('');
      setTempStartTime('');
      setTempEndTime('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    // Handle blur for the entire editing row
    const handleRowBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      if (!editing) return;
      // Check if the new focus target is still within this row
      const rowElement = e.currentTarget;
      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget && rowElement.contains(relatedTarget)) {
        // Focus is still within the row, don't save
        return;
      }
      // Focus left the row, save changes
      handleSave();
    };

    return (
      <div
        className={cn(
          'p-2 sm:p-3 md:p-4 hover:bg-slate-800/30 transition-colors flex items-start space-x-2 sm:space-x-4 group/row',
          getRowBackgroundClass(),
          isDeleteMode && isSelectedForDelete && 'bg-red-900/20',
          // Active state styling
          isActive &&
            !isDeleteMode &&
            'bg-indigo-500/10 border-l-4 border-indigo-500 pl-[calc(0.75rem-4px)] sm:pl-[calc(0.75rem-4px)] md:pl-[calc(1rem-4px)]'
        )}
        onBlur={editing ? handleRowBlur : undefined}
        onClick={(e) => {
          // Only trigger if not editing and not clicking interactive elements
          if (editing || isDeleteMode) return;

          // Check if click target is interactive (button, input, etc)
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('input')) return;

          onRowClick?.(sub.startTime);
        }}
        // Add ID for auto-scrolling
        id={`subtitle-row-${sub.id}`}
      >
        {/* Delete mode checkbox */}
        {isDeleteMode && (
          <button onClick={() => onToggleDeleteSelection?.(sub.id)} className="mt-1 flex-shrink-0">
            {isSelectedForDelete ? (
              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            ) : (
              <Square className="w-4 h-4 sm:w-5 sm:h-5 text-red-400/50 hover:text-red-400" />
            )}
          </button>
        )}
        <div className="flex flex-col text-[11px] sm:text-sm font-mono text-slate-400 min-w-[75px] sm:min-w-[95px] pt-1 relative">
          {validationError && (
            <div className="absolute bottom-full left-0 mb-2 z-50 animate-fade-in-up">
              <div className="bg-red-500 text-white text-[11px] sm:text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap relative font-sans font-medium">
                {validationError}
                {/* Tooltip arrow */}
                <div className="absolute top-full left-4 -translate-y-px border-8 border-transparent border-t-red-500" />
              </div>
            </div>
          )}
          {editing ? (
            // Editable time inputs - compact style matching display
            <>
              <input
                type="text"
                value={tempStartTime}
                onChange={(e) => setTempStartTime(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="00:00:00"
                className="bg-transparent border-b border-slate-600 focus:border-indigo-500 px-0 py-0 text-[11px] sm:text-sm text-white placeholder-slate-600 focus:outline-none leading-tight w-full"
              />
              <input
                type="text"
                value={tempEndTime}
                onChange={(e) => setTempEndTime(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="00:00:00"
                className="bg-transparent border-b border-slate-600 focus:border-indigo-500 px-0 py-0 text-[11px] sm:text-sm text-white/70 placeholder-slate-600 focus:outline-none leading-tight w-full"
              />
            </>
          ) : (
            <>
              <span className={cn('leading-tight', isActive && 'text-indigo-300 font-bold')}>
                {(sub.startTime || '').split(',')[0]}
              </span>
              <span className="leading-tight opacity-70">{(sub.endTime || '').split(',')[0]}</span>
            </>
          )}
          {/* Validation indicators */}
          {!editing &&
            (validation.hasDurationIssue ||
              validation.hasLengthIssue ||
              validation.hasOverlapIssue ||
              sub.hasRegressionIssue ||
              sub.hasCorruptedRangeIssue ||
              sub.lowConfidence) && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {sub.hasCorruptedRangeIssue && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-red-400"
                    title={t('subtitleRow.corruptedTimeline')}
                  >
                    <AlertOctagon className="w-3 h-3" />
                    <span>{t('subtitleRow.corrupted')}</span>
                  </span>
                )}
                {sub.hasRegressionIssue && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-pink-400"
                    title={t('subtitleRow.timeReverse')}
                  >
                    <Rewind className="w-3 h-3" />
                    <span>{t('subtitleRow.reverse')}</span>
                  </span>
                )}
                {validation.hasOverlapIssue && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-orange-400"
                    title={t('subtitleRow.overlapWith', {
                      amount: validation.overlapAmount.toFixed(1),
                    })}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{validation.overlapAmount.toFixed(1)}s</span>
                  </span>
                )}
                {validation.hasDurationIssue && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-yellow-400"
                    title={t('subtitleRow.durationExceeds', {
                      duration: validation.duration.toFixed(1),
                      max: MAX_DURATION_SECONDS,
                    })}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{validation.duration.toFixed(1)}s</span>
                  </span>
                )}
                {validation.hasLengthIssue && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-rose-400"
                    title={t('subtitleRow.charCountExceeds', {
                      count: validation.charCount,
                      max: MAX_CHINESE_CHARACTERS,
                    })}
                  >
                    <Type className="w-3 h-3" />
                    <span>{t('subtitleRow.charCount', { count: validation.charCount })}</span>
                  </span>
                )}
                {sub.lowConfidence && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-amber-400"
                    title={t('subtitleRow.lowConfidence', {
                      score: sub.alignmentScore ? (sub.alignmentScore * 100).toFixed(0) : '?',
                    })}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>
                      {sub.alignmentScore ? `${(sub.alignmentScore * 100).toFixed(0)}%` : '?'}
                    </span>
                  </span>
                )}
              </div>
            )}
        </div>
        <div className="flex-1 space-y-1">
          {/* Speaker Select */}
          {sub.speaker && updateSpeaker && speakerProfiles && (
            <div className="mb-2">
              <SpeakerSelect
                currentSpeaker={sub.speaker}
                speakerProfiles={speakerProfiles}
                onSelect={(speaker) => updateSpeaker(sub.id, speaker)}
                onManageSpeakers={onManageSpeakers}
              />
            </div>
          )}
          {editing ? (
            <div className="space-y-1 relative">
              {showSourceText && (
                <input
                  type="text"
                  value={tempOriginal}
                  onChange={(e) => {
                    setTempOriginal(e.target.value);
                    setValidationError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('subtitleRow.sourcePlaceholder')}
                  className="w-full bg-slate-600/10 border border-slate-500/30 rounded px-2 py-1 text-xs sm:text-sm text-slate-300 placeholder-slate-500/50 focus:outline-none focus:border-slate-400/50 leading-relaxed"
                />
              )}
              <input
                type="text"
                value={tempText}
                onChange={(e) => {
                  setTempText(e.target.value);
                  setValidationError(null);
                }}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder={t('subtitleRow.translationPlaceholder')}
                className="w-full bg-indigo-500/10 border border-indigo-500/30 rounded px-2 py-1 text-base sm:text-lg text-indigo-200 placeholder-indigo-500/50 focus:outline-none focus:border-indigo-500/50 leading-relaxed font-medium"
              />
            </div>
          ) : (
            <>
              {showSourceText && (
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed opacity-70 mb-1">
                  {sub.original}
                </p>
              )}
              <p
                className={cn(
                  'text-base sm:text-lg leading-relaxed font-medium transition-colors',
                  isActive ? 'text-white' : 'text-indigo-300'
                )}
              >
                {sub.translated}
              </p>
            </>
          )}
          {(editingCommentId === sub.id || sub.comment) && (
            <div className="mt-2 flex items-start animate-fade-in">
              <MessageCircle className="w-3 h-3 text-amber-500 mt-1 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={sub.comment || ''}
                onChange={(e) => updateLineComment(sub.id, e.target.value)}
                placeholder={t('subtitleRow.commentPlaceholder')}
                autoFocus={editingCommentId === sub.id}
                onBlur={() => setEditingCommentId(null)}
                className="w-full bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-sm text-amber-200 placeholder-amber-500/50 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          )}
        </div>
        <div className="flex items-center">
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click
                toggleMenu();
              }}
              className={cn(
                'p-1.5 rounded hover:bg-slate-700 transition-colors',
                showAddMenu
                  ? 'text-slate-300'
                  : 'text-slate-600 opacity-0 group-hover/row:opacity-100'
              )}
              title={t('subtitleRow.moreActions')}
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            {showAddMenu && (
              <Portal>
                <div
                  ref={menuRef}
                  style={menuStyle}
                  className={cn(
                    'bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 animate-fade-in',
                    menuDropUp ? 'origin-bottom-right' : 'origin-top-right'
                  )}
                  onClick={(e) => e.stopPropagation()} // Prevent row click
                >
                  {/* 1. Edit Row */}
                  <button
                    onClick={() => {
                      handleStartEdit();
                      setShowAddMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-indigo-400 transition-colors flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t('subtitleRow.editRow')}
                  </button>
                  {/* 2. Add New Row (submenu) */}
                  {addSubtitle && (
                    <div
                      className="relative"
                      onMouseEnter={handleSubmenuEnter}
                      onMouseLeave={() => setShowAddSubmenu(false)}
                    >
                      <button className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5" />
                          {t('subtitleRow.addNewRow')}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      {showAddSubmenu && (
                        <div
                          className={cn(
                            'absolute top-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[110px]',
                            submenuDropLeft ? 'right-full mr-1' : 'left-full ml-1'
                          )}
                        >
                          <button
                            onClick={() => {
                              addSubtitle(sub.id, 'before', sub.startTime);
                              setShowAddMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                          >
                            {t('subtitleRow.addBefore')}
                          </button>
                          <button
                            onClick={() => {
                              addSubtitle(sub.id, 'after', sub.endTime);
                              setShowAddMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                          >
                            {t('subtitleRow.addAfter')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* 3. Add Comment */}
                  <button
                    onClick={() => {
                      setEditingCommentId(sub.id);
                      setShowAddMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-amber-400 transition-colors flex items-center gap-2"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {t('subtitleRow.addComment')}
                  </button>
                  {/* 4. Delete Row (red) */}
                  {deleteSubtitle && (
                    <>
                      <div className="border-t border-slate-700 my-1" />
                      <button
                        onClick={() => {
                          deleteSubtitle(sub.id);
                          setShowAddMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('subtitleRow.deleteRow')}
                      </button>
                    </>
                  )}
                </div>
              </Portal>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.sub === next.sub &&
      prev.showSourceText === next.showSourceText &&
      prev.editingCommentId === next.editingCommentId &&
      prev.speakerProfiles === next.speakerProfiles &&
      prev.deleteSubtitle === next.deleteSubtitle &&
      prev.addSubtitle === next.addSubtitle &&
      prev.isDeleteMode === next.isDeleteMode &&
      prev.isSelectedForDelete === next.isSelectedForDelete &&
      // Check if current play time affects this row's active state
      // This is a bit complex, but crucial for performance.
      // We only need to re-render if:
      // 1. The previous time made this row active/inactive AND the new time flips that state.
      // OR
      // 2. We just always re-render on time update? No, that's too heavy.
      // Better: Check if prevTime was in range AND currTime is NOT in range (or vice versa).
      // Or just simply:
      (prev.sub.startTime === next.sub.startTime && prev.sub.endTime === next.sub.endTime // Time didn't change (usually)
        ? // Did active state change?
          (!prev.currentPlayTime || !isTimeInRange(prev.currentPlayTime, prev.sub)) ===
          (!next.currentPlayTime || !isTimeInRange(next.currentPlayTime, next.sub))
        : true) &&
      (prev.editingCommentId === prev.sub.id) === (next.editingCommentId === next.sub.id)
    );
  }
);

// Helper for memo
function isTimeInRange(time: number, sub: SubtitleItem): boolean {
  return time >= timeToSeconds(sub.startTime) && time <= timeToSeconds(sub.endTime);
}

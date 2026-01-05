/**
 * CTC Forced Alignment Strategy
 *
 * Uses external align.exe CLI tool with MMS model for precise timestamp alignment.
 * Includes language detection and smart text splitting with language-specific tokenizers.
 *
 * NOTE: This module uses child_process which only works in Node.js/Electron.
 * The spawn function is dynamically imported to avoid browser bundling issues.
 */

import { type SubtitleItem } from '@/types/subtitle';
import {
  type AlignmentStrategy,
  type CTCAlignmentConfig,
  CONFIDENCE_THRESHOLD,
  MAX_SEGMENT_CHARS,
  MIN_SEGMENT_CHARS,
  requiresRomanization,
} from '../types';
import { formatTime, timeToSeconds } from '@/services/subtitle/time';
import { logger } from '@/services/utils/logger';
import { toLocaleCode } from '@/services/utils/language';
import { cut } from 'jieba-wasm';
// Kuromoji import removed - using IPC instead

/**
 * Interface for language-specific tokenizers.
 * Each tokenizer provides methods to split text into sentences and words.
 */
export interface Tokenizer {
  /** Split text into sentences */
  splitSentences: (text: string) => Promise<string[]>;
  /** Split text into words/tokens */
  splitWords: (text: string) => Promise<string[]>;
}

// ============================================================================
// Punctuation constants for CJK Languages
// ============================================================================

/** Chinese sentence-ending punctuation (full-width and half-width) */
const CHINESE_SENTENCE_END = /(?<=[。！？；…‥，、.!?;,])/g;

/** Japanese sentence-ending punctuation (includes 、tōten for clause breaks) */
const JAPANESE_SENTENCE_END = /(?<=[。！？…‥．♪♫～、，])/g;

/** General sentence-ending punctuation for fallback */
const GENERAL_SENTENCE_END = /(?<=[.!?;。！？；])/g;

// ============================================================================
// Tokenizers
// ============================================================================

/**
 * Tokenizer using Intl.Segmenter for English and other languages.
 * Uses built-in browser/Node.js API for sentence and word segmentation.
 */
class IntlTokenizer implements Tokenizer {
  private locale: string;

  constructor(locale: string) {
    this.locale = locale;
  }

  async splitSentences(text: string): Promise<string[]> {
    try {
      const segmenter = new Intl.Segmenter(this.locale, { granularity: 'sentence' });
      return [...segmenter.segment(text)].map((s) => s.segment.trim()).filter(Boolean);
    } catch {
      // Fallback: split by general punctuation
      return text.split(GENERAL_SENTENCE_END).filter((s) => s.trim());
    }
  }

  async splitWords(text: string): Promise<string[]> {
    try {
      const segmenter = new Intl.Segmenter(this.locale, { granularity: 'word' });
      return [...segmenter.segment(text)].map((s) => s.segment);
    } catch {
      // Fallback: split by whitespace
      return text.split(/\s+/).filter(Boolean);
    }
  }
}

/**
 * Tokenizer for Chinese using jieba-wasm.
 * Supports sentence splitting and word segmentation.
 */
class JiebaTokenizer implements Tokenizer {
  async splitSentences(text: string): Promise<string[]> {
    // Split by Chinese sentence-ending punctuation
    const parts = text.split(CHINESE_SENTENCE_END);
    const filtered = parts.map((s) => s.trim()).filter(Boolean);
    // If no punctuation found, return original text as single sentence
    return filtered.length > 0 ? filtered : [text.trim()].filter(Boolean);
  }

  async splitWords(text: string): Promise<string[]> {
    try {
      // Use HMM mode for better accuracy with unknown words
      return cut(text, true);
    } catch {
      logger.warn('JiebaTokenizer: cut() failed, using fallback');
      // Fallback: use Intl.Segmenter for Chinese
      return new IntlTokenizer('zh-CN').splitWords(text);
    }
  }
}

/**
 * Tokenizer for Japanese using IPC to Main process (kuromoji).
 */
class KuromojiTokenizer implements Tokenizer {
  async splitSentences(text: string): Promise<string[]> {
    // Split by Japanese sentence-ending punctuation
    const parts = text.split(JAPANESE_SENTENCE_END);
    const filtered = parts.map((s) => s.trim()).filter(Boolean);
    // If no punctuation found, return original text as single sentence
    return filtered.length > 0 ? filtered : [text.trim()].filter(Boolean);
  }

  async splitWords(text: string): Promise<string[]> {
    try {
      if (!window.electronAPI?.tokenizer) {
        throw new Error('Tokenizer IPC not available');
      }

      const result = await window.electronAPI.tokenizer.tokenize(text);
      if (result.success && result.tokens) {
        return result.tokens.map((t: any) => t.surface_form);
      }
      logger.warn('KuromojiTokenizer: IPC failed', result.error);
    } catch (error) {
      logger.warn('KuromojiTokenizer: tokenize() failed', error);
    }
    // Fallback: use Intl.Segmenter for Japanese
    return new IntlTokenizer('ja').splitWords(text);
  }
}

// ============================================================================
// Language Detection and Tokenizer Factory
// ============================================================================

/** Cached tokenizer instances to avoid re-initialization */
const tokenizerCache: Map<string, Tokenizer> = new Map();

/**
 * Get appropriate tokenizer for the given language.
 * Uses caching to avoid repeated initialization.
 *
 * @param lang - ISO 639-1 or ISO 639-3 language code
 * @returns Tokenizer instance
 */
export async function getTokenizer(lang: string): Promise<Tokenizer> {
  const normalizedLang = lang.toLowerCase();

  // Check cache first
  if (tokenizerCache.has(normalizedLang)) {
    return tokenizerCache.get(normalizedLang)!;
  }

  let tokenizer: Tokenizer;

  // Select tokenizer based on language
  switch (normalizedLang) {
    case 'zh':
    case 'cmn':
    case 'zho':
    case 'zh-cn':
    case 'zh-tw':
    case 'yue': // Cantonese
      tokenizer = new JiebaTokenizer();
      break;

    case 'ja':
    case 'jpn':
      // Kuromoji via IPC
      tokenizer = new KuromojiTokenizer();
      break;

    default:
      // Use IntlTokenizer with appropriate locale
      tokenizer = new IntlTokenizer(toLocaleCode(normalizedLang));
  }

  // Cache the tokenizer
  tokenizerCache.set(normalizedLang, tokenizer);
  return tokenizer;
}

// Re-export language utilities for backward compatibility
export { detectLanguage, iso639_1To3 } from '@/services/utils/language';

// ============================================================================
// Smart Text Splitting
// ============================================================================

/**
 * Smart text splitting for long segments.
 * Splits by sentence first, then by word boundaries if still too long.
 * Merges segments shorter than MIN_SEGMENT_CHARS with adjacent segments.
 *
 * @param text - Text to split
 * @param tokenizer - Tokenizer instance to use
 * @param maxChars - Maximum characters per segment
 * @param minChars - Minimum characters per segment (shorter ones get merged)
 * @returns Array of text segments
 */
export async function smartSplit(
  text: string,
  tokenizer: Tokenizer,
  maxChars: number = MAX_SEGMENT_CHARS,
  minChars: number = MIN_SEGMENT_CHARS
): Promise<string[]> {
  // If text is short enough, return as-is
  if (text.length <= maxChars) {
    return [text.trim()].filter(Boolean);
  }

  // First, split into sentences
  const sentences = await tokenizer.splitSentences(text);

  // Then, process each sentence
  const rawResult: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      rawResult.push(sentence);
    } else {
      // Split long sentences at word boundaries
      const chunks = await splitAtWordBoundary(sentence, tokenizer, maxChars);
      rawResult.push(...chunks);
    }
  }

  // Merge short segments with adjacent ones
  const result = mergeShortSegments(rawResult, minChars, maxChars);

  return result.filter((s) => s.trim().length > 0);
}

/**
 * Merge segments shorter than minChars with adjacent segments.
 * Respects maxChars limit when merging.
 */
function mergeShortSegments(segments: string[], minChars: number, maxChars: number): string[] {
  if (segments.length <= 1) {
    return segments;
  }

  const result: string[] = [];
  let current = '';

  for (const segment of segments) {
    if (current === '') {
      current = segment;
    } else if (current.length < minChars && (current + segment).length <= maxChars) {
      // Current segment is too short, merge with next
      current = current + segment;
    } else if (segment.length < minChars && (current + segment).length <= maxChars) {
      // Next segment is too short, merge with current
      current = current + segment;
    } else {
      // Both are long enough or can't merge, push current and start new
      result.push(current.trim());
      current = segment;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Split text at word boundaries using the tokenizer.
 */
async function splitAtWordBoundary(
  text: string,
  tokenizer: Tokenizer,
  maxChars: number
): Promise<string[]> {
  const words = await tokenizer.splitWords(text);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + word).length > maxChars && current.trim()) {
      chunks.push(current.trim());
      current = word;
    } else {
      current += word;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ============================================================================
// Legacy Functions (for backward compatibility)
// ============================================================================

/**
 * Smart text splitting for long segments.
 * @deprecated Use smartSplit() with a Tokenizer instead
 */
export async function smartSplitText(
  text: string,
  language: string,
  maxChars: number = MAX_SEGMENT_CHARS
): Promise<string[]> {
  const tokenizer = await getTokenizer(language);
  return smartSplit(text, tokenizer, maxChars);
}

// ============================================================================
// CTC Aligner Strategy
// ============================================================================

/**
 * CTC Forced Aligner Strategy
 *
 * Calls main process via IPC to execute align.exe.
 * Tokenizer and smart splitting remain in renderer for pre-processing.
 */
export class CTCAligner implements AlignmentStrategy {
  readonly name = 'ctc' as const;

  constructor(private config: CTCAlignmentConfig) {}

  async align(
    segments: SubtitleItem[],
    audioPath: string,
    language: string,
    context?: any,
    _audioBase64?: string
  ): Promise<SubtitleItem[]> {
    // Skip if no segments
    if (segments.length === 0) {
      return segments;
    }

    // Check if electronAPI is available
    if (!window.electronAPI?.alignment) {
      logger.error('CTC Aligner: electronAPI.alignment not available');
      throw new Error('CTC alignment requires Electron environment');
    }

    // Check for abort before starting
    if (context?.signal?.aborted) {
      throw new Error('Alignment cancelled');
    }

    // Prepare input for align.exe
    const inputSegments = segments.map((seg, idx) => ({
      index: idx,
      text: seg.original,
      start: timeToSeconds(seg.startTime),
      end: timeToSeconds(seg.endTime),
    }));

    try {
      logger.info(`CTC Aligner: Starting alignment for ${segments.length} segments`);

      // Set up abort handling
      let abortPromise: Promise<never> | null = null;
      if (context?.signal) {
        abortPromise = new Promise<never>((_, reject) => {
          const onAbort = () => {
            void window.electronAPI.alignment.ctcAbort();
            reject(new Error('Alignment cancelled'));
          };
          if (context.signal.aborted) {
            onAbort();
          } else {
            context.signal.addEventListener('abort', onAbort, { once: true });
          }
        });
      }

      // Call main process via IPC
      const ipcPromise = window.electronAPI.alignment.ctc({
        segments: inputSegments,
        audioPath,
        language,
        config: {
          alignerPath: this.config.alignerPath,
          modelPath: this.config.modelPath,
          batchSize: this.config.batchSize,
          romanize: requiresRomanization(language),
        },
      });

      // Race between alignment and abort
      const result =
        abortPromise !== null ? await Promise.race([ipcPromise, abortPromise]) : await ipcPromise;

      if (!result.success) {
        throw new Error(result.error || 'Alignment failed');
      }

      logger.info(
        `CTC Aligner: Aligned ${result.metadata?.count || result.segments?.length} segments` +
          (result.metadata?.processing_time
            ? ` in ${result.metadata.processing_time.toFixed(2)}s`
            : '')
      );

      // Map aligned segments back to SubtitleItem format
      return this.mapAlignedSegments(segments, result.segments || []);
    } catch (error: any) {
      logger.error(`CTC Aligner failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map aligned output segments back to SubtitleItem format.
   * Preserves original fields while updating timestamps and adding confidence scores.
   */
  private mapAlignedSegments(
    originalSegments: SubtitleItem[],
    alignedSegments: { index: number; start: number; end: number; text: string; score: number }[]
  ): SubtitleItem[] {
    return alignedSegments.map((aligned, idx) => {
      const original = originalSegments[idx];

      return {
        ...original,
        startTime: formatTime(aligned.start),
        endTime: formatTime(aligned.end),
        alignmentScore: aligned.score,
        lowConfidence: aligned.score < CONFIDENCE_THRESHOLD,
      };
    });
  }
}

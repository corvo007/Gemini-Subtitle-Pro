/**
 * Alignment Utils
 *
 * Contains constants and helper functions for the timestamp alignment pipeline.
 */

/**
 * Confidence threshold for marking segments as low-confidence
 */
export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Maximum characters per segment before smart splitting
 */
export const MAX_SEGMENT_CHARS = 25;

/**
 * Minimum characters per segment - shorter segments will be merged with adjacent ones
 */
export const MIN_SEGMENT_CHARS = 8;

/**
 * Languages that require romanization for CTC alignment
 */
export const ROMANIZE_LANGUAGES = ['cmn', 'jpn', 'kor', 'ara', 'rus', 'zho', 'yue'];

/**
 * Check if a language code requires romanization
 */
export function requiresRomanization(language: string): boolean {
  return ROMANIZE_LANGUAGES.includes(language.toLowerCase());
}

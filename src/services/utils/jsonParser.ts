/**
 * Unified JSON Parser Module
 *
 * Provides safe JSON parsing with automatic repair using the jsonrepair library.
 * Handles common issues in AI-generated JSON responses:
 * - Markdown code blocks (```json ... ```)
 * - Missing quotes, commas, brackets
 * - Truncated JSON
 * - Trailing commas and comments
 * - Python constants (None, True, False)
 */

import { jsonrepair } from 'jsonrepair';
import { logger } from '@/services/utils/logger';

/**
 * Safely parse JSON with automatic repair.
 * Uses jsonrepair to fix common JSON issues before parsing.
 *
 * @param text - Raw text that may contain JSON (possibly malformed)
 * @returns Parsed JSON value
 * @throws Error if JSON cannot be repaired or parsed
 */
export function safeParseJson<T = unknown>(text: string): T {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  try {
    const repaired = jsonrepair(text);
    return JSON.parse(repaired) as T;
  } catch (error) {
    logger.warn('JSON repair/parse failed', {
      error,
      textPreview: text.slice(0, 500),
    });
    throw error;
  }
}

/**
 * Parse JSON array from AI response text.
 * Handles various response formats:
 * - Direct array: [...]
 * - Wrapped: { items: [...] }, { subtitles: [...] }, { segments: [...] }
 *
 * @param text - Raw text containing JSON array
 * @returns Parsed array (empty array if extraction fails)
 */
export function safeParseJsonArray<T = unknown>(text: string): T[] {
  try {
    const parsed = safeParseJson<unknown>(text);

    if (Array.isArray(parsed)) {
      return parsed as T[];
    }

    // Handle wrapped responses
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.items)) return obj.items as T[];
      if (Array.isArray(obj.subtitles)) return obj.subtitles as T[];
      if (Array.isArray(obj.segments)) return obj.segments as T[];
    }

    logger.warn('safeParseJsonArray: parsed result is not an array', {
      type: typeof parsed,
      preview: JSON.stringify(parsed)?.slice(0, 200),
    });
    return [];
  } catch (error) {
    logger.warn('safeParseJsonArray failed', { error });
    return [];
  }
}

/**
 * Parse JSON object from AI response text.
 *
 * @param text - Raw text containing JSON object
 * @returns Parsed object
 * @throws Error if parsing fails
 */
export function safeParseJsonObject<T = object>(text: string): T {
  return safeParseJson<T>(text);
}

/**
 * Try to parse JSON, returning null on failure instead of throwing.
 * Useful for optional parsing scenarios.
 *
 * @param text - Raw text that may contain JSON
 * @returns Parsed value or null if parsing fails
 */
export function tryParseJson<T = unknown>(text: string): T | null {
  try {
    return safeParseJson<T>(text);
  } catch {
    return null;
  }
}

/**
 * Validate that text contains valid JSON.
 * Uses jsonrepair to attempt fixing before validation.
 *
 * @param text - Text to validate
 * @returns true if text can be parsed as valid JSON
 */
export function isValidJson(text: string): boolean {
  try {
    safeParseJson(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Content Validator
 *
 * Provides utility functions to check subtitle content integrity,
 * specifically targeting "Dropped Content" issues where the model hallucinates
 * or loses significant portions of the source text.
 */

import { logger } from '@/services/utils/logger';

export interface ContentValidationResult {
  isValid: boolean;
  score: number; // 0.0 to 1.0 (Coverage Ratio)
  details?: string;
}

/**
 * Calculates the Bigram Coverage of the source text by the target text.
 * Formula: (Source Bigrams ∩ Target Bigrams) / Source Bigrams
 *
 * This is an ASYMMETRIC metric.
 * It checks "Does the output contain the key information from the input?"
 * It allows the output to be shorter or have extra formatting, but punishes dropped keywords.
 *
 * @param source - The original text (e.g. from Whisper or previous step)
 * @param target - The generated text (e.g. Refined result)
 * @returns Coverage score between 0 and 1
 */
export function calculateBigramCoverage(source: string, target: string): number {
  const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();

  const cleanSource = normalize(source);
  const cleanTarget = normalize(target);

  if (cleanSource.length === 0) return 1.0; // Empty source, nothing to cover
  if (cleanTarget.length === 0) return 0.0; // Empty target, missed everything

  // Helper to generate bigrams set
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const sourceSet = getBigrams(cleanSource);

  // Optimization: If source is very short (< 5 chars), fallback to character set coverage
  if (sourceSet.size < 4) {
    const sSet = new Set(cleanSource.split(''));
    const tSet = new Set(cleanTarget.split(''));
    let hit = 0;
    sSet.forEach((char) => {
      if (tSet.has(char)) hit++;
    });
    return hit / sSet.size;
  }

  const targetSet = getBigrams(cleanTarget);

  let hit = 0;
  sourceSet.forEach((gram) => {
    if (targetSet.has(gram)) hit++;
  });

  return hit / sourceSet.size;
}

/**
 * Validates if the target text sufficiently covers the source text.
 * Threshold: 60% (0.6) based on statistical DLT (Q1 - 1.5*IQR).
 * - Normal Refinement: > 70-80%
 * - True Drops: < 25-30%
 */
export function validateContentIntegrity(
  source: string,
  target: string,
  threshold = 0.6
): ContentValidationResult {
  // Exemption: Very short text (e.g. "Hello" -> "Hi") is prone to false positives.
  // We implicitly trust the model for segments shorter than 10 characters (normalized).
  // For CJK languages, characters are more dense, so we use a stricter threshold (4).
  const cleanSource = source.replace(/\s+/g, '');

  // Check for CJK characters (Common RegeEx range for partial CJK coverage)
  const hasCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(
    cleanSource
  );
  const minLen = hasCJK ? 5 : 10;

  if (cleanSource.length < minLen) {
    return {
      isValid: true,
      score: 1.0,
      details: `Short text exempted (Len ${cleanSource.length} < ${minLen})`,
    };
  }

  const score = calculateBigramCoverage(source, target);

  if (score < threshold) {
    logger.warn(`Content Integrity Fail: Coverage ${score.toFixed(2)} < ${threshold}`);
    return {
      isValid: false,
      score,
      details: `Low content coverage (${(score * 100).toFixed(1)}%). Length: ${source.length} -> ${target.length}. Possible hallucination or missing text.`,
    };
  }

  return { isValid: true, score };
}

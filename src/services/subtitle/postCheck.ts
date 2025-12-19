/**
 * PostCheck Module - Post-processing pipeline for subtitle generation
 *
 * Provides a unified pipeline for:
 * 1. Cleaning output (remove non-speech annotations, filter empty)
 * 2. Validating quality (timeline integrity)
 * 3. Marking issues for frontend display
 * 4. Retry logic for recoverable errors
 */

import { SubtitleItem } from '@/types/subtitle';
import { cleanNonSpeechAnnotations } from '@/services/subtitle/parser';
import {
  validateTimeline,
  markRegressionIssues,
  markCorruptedRange,
  TimelineValidationResult,
} from '@/services/subtitle/timelineValidator';
import { logger } from '@/services/utils/logger';

// ===== Interfaces =====

export interface PostCheckIssue {
  type: 'corrupted_range' | 'regression' | 'excessive_duration';
  affectedIds: string[];
  details: string;
  retryable: boolean;
}

export interface PostCheckResult {
  isValid: boolean;
  issues: PostCheckIssue[];
  retryable: boolean; // true if at least one issue is retryable
}

export interface PostProcessOutput<T> {
  result: T;
  checkResult: PostCheckResult;
}

export interface WithPostCheckOptions {
  maxRetries: number;
  stepName?: string; // For logging (e.g., "Chunk 3")
}

// ===== Refinement Post-Processing =====

/**
 * Post-process refinement output:
 * 1. Clean non-speech annotations
 * 2. Filter empty segments
 * 3. Validate timeline
 */
export function postProcessRefinement(segments: SubtitleItem[]): PostProcessOutput<SubtitleItem[]> {
  // Step 1: Clean non-speech annotations
  let processed = segments.map((seg) => ({
    ...seg,
    original: cleanNonSpeechAnnotations(seg.original),
  }));

  // Step 2: Filter empty segments
  processed = processed.filter((seg) => seg.original.length > 0);

  // Step 3: Validate timeline
  const validation = validateTimeline(processed);

  // Step 4: Convert validation result to PostCheckResult
  const checkResult = mapValidationToCheckResult(validation);

  return { result: processed, checkResult };
}

/**
 * Apply issue markers to segments based on check result
 */
export function applyIssueMarkers(
  segments: SubtitleItem[],
  checkResult: PostCheckResult,
  validation: TimelineValidationResult
): SubtitleItem[] {
  let result = segments;

  // Mark regression issues
  if (validation.independentAnomalies.length > 0) {
    result = markRegressionIssues(result, validation.independentAnomalies);
  }

  // Mark corrupted ranges
  if (validation.corruptedRanges.length > 0) {
    result = markCorruptedRange(result, validation.corruptedRanges);
  }

  return result;
}

// ===== Retry Wrapper =====

/**
 * Execute a generator function with post-check and retry logic
 *
 * @param generate - Async function that produces the result
 * @param postProcess - Function to post-process and validate the result
 * @param options - Retry configuration
 * @returns Final result with check status
 */
export async function withPostCheck<T>(
  generate: () => Promise<T>,
  postProcess: (result: T) => PostProcessOutput<T>,
  options: WithPostCheckOptions
): Promise<PostProcessOutput<T>> {
  const { maxRetries, stepName = '' } = options;
  let lastOutput: PostProcessOutput<T> | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Generate
    const rawResult = await generate();

    // Post-process and validate
    const output = postProcess(rawResult);
    lastOutput = output;

    // Check if valid or not retryable
    if (output.checkResult.isValid || !output.checkResult.retryable) {
      if (attempt > 0 && output.checkResult.isValid) {
        logger.info(`${stepName} PostCheck: Succeeded on retry ${attempt}`);
      }
      return output;
    }

    // Log and retry if attempts remain
    if (attempt < maxRetries) {
      logger.warn(
        `${stepName} PostCheck: Retryable issues detected, retrying (${attempt + 1}/${maxRetries})`,
        { issues: output.checkResult.issues.map((i) => i.type) }
      );
    }
  }

  // All retries exhausted
  logger.error(`${stepName} PostCheck: Issues persisted after ${maxRetries} retries`);
  return lastOutput!;
}

// ===== Internal Helpers =====

function mapValidationToCheckResult(validation: TimelineValidationResult): PostCheckResult {
  const issues: PostCheckIssue[] = [];

  // Map corrupted ranges (retryable)
  for (const range of validation.corruptedRanges) {
    issues.push({
      type: 'corrupted_range',
      affectedIds: [], // Could populate with actual IDs if needed
      details: `Range ${range.startId} → ${range.endId} (${range.affectedCount} segments)`,
      retryable: true,
    });
  }

  // Map independent anomalies (not retryable)
  for (const anomaly of validation.independentAnomalies) {
    issues.push({
      type: anomaly.type === 'time_regression' ? 'regression' : 'excessive_duration',
      affectedIds: [anomaly.id],
      details: anomaly.details,
      retryable: false,
    });
  }

  return {
    isValid: validation.isValid,
    issues,
    retryable: validation.corruptedRanges.length > 0,
  };
}

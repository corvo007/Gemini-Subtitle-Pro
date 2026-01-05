/**
 * LLM Alignment Strategy
 *
 * Uses Gemini to split long segments and align timestamps.
 * This is used when CTC alignment is not available or when simple
 * timestamp correction is sufficient.
 */

import { type SubtitleItem } from '@/types/subtitle';
import { type AlignmentStrategy, type AlignmentContext } from '../types';
import { logger } from '@/services/utils/logger';
import { toLanguageName } from '@/services/utils/language';
import { getLLMAlignerPrompt } from '@/services/api/gemini/core/prompts';
import { generateContentWithRetry } from '@/services/api/gemini/core/client';
import { STEP_MODELS, buildStepConfig } from '@/config';
import { REFINEMENT_SCHEMA, SAFETY_SETTINGS } from '@/services/api/gemini/core/schemas';
import { parseJsonArrayStrict } from '@/services/subtitle/parser';

export class LLMAligner implements AlignmentStrategy {
  readonly name = 'llm' as const;

  async align(
    segments: SubtitleItem[],
    _audioPath: string,
    language: string,
    context?: AlignmentContext,
    audioBase64?: string
  ): Promise<SubtitleItem[]> {
    logger.info(`LLM Aligner: Processing ${segments.length} segments`);

    if (!context || !context.ai) {
      logger.error('LLM Aligner: Missing AI client in context');
      return segments; // Fallback to original
    }

    if (!audioBase64) {
      logger.warn('LLM Aligner: No audio data provided, skipping alignment');
      return segments;
    }

    try {
      // Get language name for prompt
      const targetLangName = toLanguageName(language);
      const videoGenre = context.genre || 'General';

      const prompt = getLLMAlignerPrompt(videoGenre, targetLangName);

      // 3. Call Gemini
      const response = await generateContentWithRetry(
        context.ai,
        {
          model: STEP_MODELS.llmAlignment,
          contents: {
            parts: [
              { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
              { text: `\n\nINPUT SUBTITLES For Alignment:\n${JSON.stringify(segments, null, 2)}` },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: REFINEMENT_SCHEMA, // Reuse refinement schema as it matches SubtitleItem[]
            safetySettings: SAFETY_SETTINGS,
            ...buildStepConfig('llmAlignment'),
          },
        },
        2, // retries
        context.signal,
        context.trackUsage
      );

      // 4. Parse Response
      let alignedSegments: SubtitleItem[] = [];
      if (typeof response === 'string') {
        alignedSegments = parseJsonArrayStrict(response);
      } else if (response.text) {
        alignedSegments = parseJsonArrayStrict(response.text);
      } else {
        // Handle case where response might be the object itself if generated with parsedJson=true
        // But generateContentWithRetry returns specific structural types.
        // Let's assume response.text is the standard way.
        logger.warn('LLM Aligner: Unexpected response format', response);
        return segments;
      }

      logger.info(`LLM Aligner: Successfully aligned. Output: ${alignedSegments.length} segments`);

      // Basic validation
      if (alignedSegments.length === 0 && segments.length > 0) {
        logger.warn('LLM Aligner returned empty segments, reverting to original');
        return segments;
      }

      return alignedSegments;
    } catch (e) {
      logger.error('LLM Aligner failed', e);
      return segments; // Fallback
    }
  }
}

/**
 * Alignment Service Types
 *
 * Defines interfaces and types for the timestamp alignment pipeline.
 */

import { type SubtitleItem } from '@/types/subtitle';
import { type GoogleGenAI } from '@google/genai';
import { type TokenUsage } from '@/types/api';

/**
 * Context passed to alignment strategies
 */
export interface AlignmentContext {
  ai: GoogleGenAI;
  signal?: AbortSignal;
  trackUsage?: (usage: TokenUsage) => void;
  openaiKey?: string;
  genre?: string;
  enableDiarization?: boolean;
  speakerProfiles?: any[]; // Using any[] to avoid circular dependency, or import SpeakerProfile if possible
}

/**
 * Strategy interface for alignment implementations.
 * Each strategy takes refined segments and produces aligned segments with precise timestamps.
 */
export interface AlignmentStrategy {
  /**
   * Unique identifier for this strategy
   */
  readonly name: 'ctc' | 'none';

  /**
   * Align subtitle segments with precise timestamps.
   *
   * @param segments - Refined subtitle segments from Gemini (Step 1)
   * @param audioPath - Path to the audio chunk file (or empty if not needed)
   * @param language - ISO 639-3 language code (e.g., 'eng', 'cmn', 'jpn')
   * @param context - Execution context (AI client, signals, etc.)
   * @param audioBase64 - Optional base64 audio data (useful for LLM alignment)
   * @returns Aligned segments with updated timestamps
   */
  align(
    segments: SubtitleItem[],
    audioPath: string,
    language: string,
    context?: AlignmentContext,
    audioBase64?: string
  ): Promise<SubtitleItem[]>;
}

/**
 * Configuration for the CTC aligner strategy
 */
export interface CTCAlignmentConfig {
  alignerPath: string; // Path to align.exe
  modelPath: string; // Path to MMS model directory
  batchSize?: number; // Inference batch size (default: 4)
  romanize?: boolean; // Romanize CJK text (default: true for CJK languages)
}

/**
 * Input segment format for align.exe JSON input
 */
export interface AlignerInputSegment {
  index: number;
  text: string;
  start?: number;
  end?: number;
}

/**
 * Output segment format from align.exe JSON output
 */
export interface AlignerOutputSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  score: number; // Confidence score 0.0 - 1.0
}

/**
 * Full JSON input structure for align.exe
 */
export interface AlignerInput {
  segments: AlignerInputSegment[];
}

/**
 * Full JSON output structure from align.exe
 */
export interface AlignerOutput {
  segments: AlignerOutputSegment[];
  metadata: {
    count: number;
    processing_time: number;
  };
}

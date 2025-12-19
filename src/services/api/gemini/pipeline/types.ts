import { GoogleGenAI } from '@google/genai';
import { TokenUsage } from '@/types/api';
import { SubtitleItem } from '@/types/subtitle';
import { AppSettings } from '@/types/settings';
import { GlossaryItem, GlossaryExtractionResult } from '@/types/glossary';
import { SpeakerProfile } from '@/services/api/gemini/speakerProfile';
import { ChunkStatus } from '@/types/api';

// Re-export common types for convenience
export type {
  GlossaryItem,
  GlossaryExtractionResult,
  SpeakerProfile,
  SubtitleItem,
  AppSettings,
  ChunkStatus,
};

// Shared Context for Pipeline Stages
export interface PipelineContext {
  ai: GoogleGenAI;
  settings: AppSettings;
  signal?: AbortSignal;
  trackUsage: (usage: TokenUsage) => void;
  onProgress?: (update: ChunkStatus) => void;
  isDebug: boolean;
  geminiKey: string;
  openaiKey?: string;
}

// Context for Chunk Processing
export interface ChunkContext extends PipelineContext {
  chunkIndex: number;
  totalChunks: number;
  start: number;
  end: number;
  audioBuffer: AudioBuffer;
}

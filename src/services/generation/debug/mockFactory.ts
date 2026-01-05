import { type SubtitleItem } from '@/types/subtitle';
import { type GlossaryExtractionResult } from '@/types/glossary';
import { type SpeakerProfile } from '@/services/generation/extractors/speakerProfile';
import { logger } from '@/services/utils/logger';
import { generateSubtitleId } from '@/services/utils/id';
import { formatTime } from '@/services/subtitle/time';
import { loadSegmentsFromFile } from '@/services/subtitle/parser';

/**
 * Centralized factory for generating mock data during debug mode
 * Supports loading custom data from files if path is provided
 */
export class MockFactory {
  /**
   * Load segments from custom file or return preset mock data
   */
  private static async loadOrPreset(
    customDataPath: string | undefined,
    presetFn: () => SubtitleItem[]
  ): Promise<SubtitleItem[]> {
    if (customDataPath) {
      try {
        const loaded = await loadSegmentsFromFile(customDataPath);
        logger.info(`⚠️ [MOCK] Loaded ${loaded.length} segments from file: ${customDataPath}`);
        return loaded;
      } catch (e: any) {
        logger.error(`⚠️ [MOCK] Failed to load from file, using preset:`, e.message);
        return presetFn();
      }
    }
    return presetFn();
  }

  static async getMockGlossary(chunkIndex: number = 0): Promise<GlossaryExtractionResult[]> {
    const mockGlossary = [
      {
        chunkIndex,
        terms: [
          {
            term: 'Mock Term',
            translation: 'Mock Term Translation',
            notes: 'Mock notes for validation',
          } as any,
        ],
        confidence: 'high' as const,
        source: 'chunk' as const,
      },
    ];
    logger.info('⚠️ [MOCK] Glossary Extraction ENABLED. Returning mock data:', mockGlossary);
    return mockGlossary;
  }

  static async getMockSpeakerProfiles(): Promise<SpeakerProfile[]> {
    logger.info('⚠️ [MOCK] Speaker Profile Analysis ENABLED. Returning mock profiles.');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return [
      {
        id: 'Mock Speaker 1',
        characteristics: {
          name: 'Mock Speaker 1',
          gender: 'male',
          pitch: 'medium',
          speed: 'normal',
          accent: 'standard',
          tone: 'neutral',
        },
        sampleQuotes: ['This is a mock quote for speaker 1.'],
        confidence: 0.95,
      },
      {
        id: 'Mock Speaker 2',
        characteristics: {
          name: 'Mock Speaker 2',
          gender: 'female',
          pitch: 'high',
          speed: 'fast',
          accent: 'standard',
          tone: 'energetic',
        },
        sampleQuotes: ['This is a mock quote for speaker 2.'],
        confidence: 0.88,
      },
    ];
  }

  static async getMockTranscription(
    chunkIndex: number,
    start: number,
    end: number,
    customDataPath?: string
  ): Promise<SubtitleItem[]> {
    const result = await this.loadOrPreset(customDataPath, () => [
      {
        id: generateSubtitleId(),
        startTime: '00:00:00,000',
        endTime: formatTime(end - start),
        original: `[Mock] Transcription for Chunk ${chunkIndex}`,
        translated: '',
      },
    ]);
    logger.info(
      `⚠️ [MOCK] Transcription ENABLED for Chunk ${chunkIndex}. Returning ${result.length} segments.`
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    return result;
  }

  static async getMockRefinement(
    chunkIndex: number,
    rawSegments: SubtitleItem[],
    customDataPath?: string
  ): Promise<SubtitleItem[]> {
    const result = await this.loadOrPreset(customDataPath, () => [...rawSegments]);
    logger.info(
      `⚠️ [MOCK] Refinement ENABLED for Chunk ${chunkIndex}. Returning ${result.length} segments.`
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    return result;
  }

  static async getMockAlignment(
    chunkIndex: number,
    refinedSegments: SubtitleItem[],
    customDataPath?: string
  ): Promise<SubtitleItem[]> {
    const result = await this.loadOrPreset(customDataPath, () => [...refinedSegments]);
    logger.info(
      `⚠️ [MOCK] Alignment ENABLED for Chunk ${chunkIndex}. Returning ${result.length} segments.`
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    return result;
  }

  static async getMockTranslation(
    chunkIndex: number,
    toTranslate: any[],
    customDataPath?: string
  ): Promise<SubtitleItem[]> {
    if (customDataPath) {
      const loaded = await this.loadOrPreset(customDataPath, () => []);
      if (loaded.length > 0) {
        logger.info(
          `⚠️ [MOCK] Translation ENABLED for Chunk ${chunkIndex}. Loaded ${loaded.length} segments from file.`
        );
        return loaded;
      }
    }

    logger.info(
      `⚠️ [MOCK] Translation ENABLED for Chunk ${chunkIndex}. Generating mock translations.`
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const translatedItems = toTranslate.map((t) => ({
      ...t,
      translated: `[Mock] Translated: ${t.original}`,
    }));
    return translatedItems as any;
  }
}

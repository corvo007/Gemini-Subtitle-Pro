/**
 * BaseStep - Abstract base class implementing Template Method pattern
 *
 * Handles cross-cutting concerns:
 * - Semaphore management
 * - Progress reporting
 * - Abort signal checking
 * - Mock stage/API logic
 * - Artifact saving
 * - Error handling with fallback
 */

import { type Semaphore } from '@/services/utils/concurrency';
import { type StepName, type StepContext, type StepResult, type PostCheckResult } from './types';
import { logger } from '@/services/utils/logger';
import i18n from '@/i18n';

const STEP_ORDER: StepName[] = [
  'transcribe',
  'refinement',
  'alignment',
  'translation',
  'proofread',
];

export type StageKey =
  | 'transcribing'
  | 'waiting_glossary'
  | 'waiting_speakers'
  | 'refining'
  | 'aligning'
  | 'translating'
  | 'proofing';

export abstract class BaseStep<TInput, TOutput> {
  abstract name: StepName;
  abstract stageKey: StageKey;

  // ===== Core execution (subclass must implement) =====
  protected abstract execute(input: TInput, ctx: StepContext): Promise<TOutput>;

  // ===== Optional hooks (subclass can override) =====
  protected preCheck?(input: TInput, ctx: StepContext): boolean | Promise<boolean>;
  protected preProcess?(input: TInput, ctx: StepContext): TInput | Promise<TInput>;
  protected postProcess?(output: TOutput, ctx: StepContext): TOutput | Promise<TOutput>;
  protected postCheck?(
    output: TOutput,
    isFinalAttempt: boolean,
    ctx: StepContext
  ): PostCheckResult | Promise<PostCheckResult>;
  protected loadMockData?(ctx: StepContext): TOutput | Promise<TOutput>;
  protected saveArtifact?(result: TOutput, ctx: StepContext): void | Promise<void>;
  protected getFallback?(input: TInput, error: Error, ctx: StepContext): TOutput;
  protected getSemaphore?(ctx: StepContext): Semaphore | null;

  // ===== Template Method =====
  async run(input: TInput, ctx: StepContext): Promise<StepResult<TOutput>> {
    return this.runInternal(input, ctx, true);
  }

  /**
   * Run without acquiring semaphore (for when semaphore is managed externally)
   */
  async runWithoutSemaphore(input: TInput, ctx: StepContext): Promise<StepResult<TOutput>> {
    return this.runInternal(input, ctx, false);
  }

  private async runInternal(
    input: TInput,
    ctx: StepContext,
    useSemaphore: boolean
  ): Promise<StepResult<TOutput>> {
    const { pipelineContext } = ctx;
    const { signal, onProgress } = pipelineContext;
    const startTime = Date.now();
    let status: 'success' | 'failed' | 'skipped' | 'mocked' | 'fallback' = 'failed'; // Default to failed until proven otherwise
    let errorType: string | undefined;

    // Helper to send analytics
    const trackCompletion = () => {
      // Only track if running in renderer with analytics available
      if (typeof window !== 'undefined' && window.electronAPI?.analytics) {
        void window.electronAPI.analytics.track(
          'chunk_stage_completed',
          {
            chunk_index: ctx.chunk.index,
            stage: this.stageKey, // Use stageKey as stable identifier
            step_name: this.name, // Also include raw step name for debug
            status,
            duration_ms: Date.now() - startTime,
            chunk_duration_sec: ctx.chunkDuration,
            error_type: errorType,
          },
          'interaction'
        );
      }
    };

    try {
      // 1. Check abort signal
      if (signal?.aborted) {
        // Don't track analytics for cancellation (noise)
        throw new Error(i18n.t('services:pipeline.errors.cancelled'));
      }

      // 2. Check if should skip by mockStage
      if (this.shouldSkipByMockStage(ctx)) {
        logger.info(`[Chunk ${ctx.chunk.index}] Skipping ${this.name} (mockStage)`);
        status = 'skipped';
        return { output: ctx.mockInputSegments as unknown as TOutput, skipped: true };
      }

      // 3. Report progress: waiting
      onProgress?.({
        id: ctx.chunk.index,
        total: ctx.totalChunks,
        status: 'processing',
        stage: this.stageKey,
        message: i18n.t(`services:pipeline.status.waiting${this.capitalizedName}`),
      });

      // 4. Acquire semaphore if defined and useSemaphore is true
      const semaphore = useSemaphore ? (this.getSemaphore?.(ctx) ?? null) : null;
      if (semaphore) await semaphore.acquire();

      try {
        // 5. Check abort again after acquiring semaphore
        if (signal?.aborted) {
          throw new Error(i18n.t('services:pipeline.errors.cancelled'));
        }

        // 6. Report progress: processing
        onProgress?.({
          id: ctx.chunk.index,
          total: ctx.totalChunks,
          status: 'processing',
          stage: this.stageKey,
          message: i18n.t(`services:pipeline.status.${this.stageKey}`),
        });

        // 7. PreCheck - can skip execution
        if (this.preCheck) {
          const shouldProceed = await this.preCheck(input, ctx);
          if (!shouldProceed) {
            logger.info(
              `[Chunk ${ctx.chunk.index}] ${this.name} preCheck returned false, skipping`
            );
            status = 'skipped';
            return { output: input as unknown as TOutput, skipped: true };
          }
        }

        // 8. Check mockApi flag
        if (this.shouldUseMockApi(ctx) && this.loadMockData) {
          logger.info(`[Chunk ${ctx.chunk.index}] Mocking ${this.name} (mockApi enabled)`);
          const mockResult = await this.loadMockData(ctx);
          await this.saveArtifact?.(mockResult, ctx);
          status = 'mocked';
          return { output: mockResult, mocked: true };
        }

        // 9. PreProcess
        const processedInput = this.preProcess ? await this.preProcess(input, ctx) : input;

        // 10. Execute with optional retry (if postCheck defined)
        let result: TOutput;
        if (this.postCheck) {
          result = await this.executeWithRetry(processedInput, ctx);
        } else {
          result = await this.execute(processedInput, ctx);
        }

        // 11. PostProcess
        const finalResult = this.postProcess ? await this.postProcess(result, ctx) : result;

        // 12. Save artifact
        await this.saveArtifact?.(finalResult, ctx);

        status = 'success';
        return { output: finalResult };
      } catch (e: any) {
        // 13. Error handling with fallback
        // Check for cancellation first
        if (signal?.aborted || e.message === i18n.t('services:pipeline.errors.cancelled')) {
          logger.info(`[Chunk ${ctx.chunk.index}] ${this.name} cancelled`);
          // Don't track cancellation
          throw e;
        }

        logger.error(`[Chunk ${ctx.chunk.index}] ${this.name} failed`, e);
        errorType = e.name || 'UnknownError';
        status = 'failed';

        if (this.getFallback) {
          const fallback = this.getFallback(input, e as Error, ctx);
          await this.saveArtifact?.(fallback, ctx);

          // Analytics: Track step fallback with context (using Analytics for larger quota)
          // Note: keeping existing step_fallback event as it might have specific dashboards relying on it,
          // but our new event will also fire with status='fallback'
          if (typeof window !== 'undefined' && window.electronAPI?.analytics) {
            void window.electronAPI.analytics.track(
              'step_fallback',
              {
                step_name: this.name,
                chunk_index: ctx.chunk.index,
                total_chunks: ctx.totalChunks,
                // Error details
                error_name: (e as Error).name,
                error_message: (e as Error).message?.substring(0, 300),
                error_stack: (e as Error).stack?.split('\n').slice(0, 3).join(' | '),
              },
              'interaction'
            );
          }

          status = 'fallback'; // Update status to fallback since we recovered
          return { output: fallback, error: e as Error };
        }
        throw e;
      } finally {
        // 14. Release semaphore
        if (semaphore) semaphore.release();
      }
    } finally {
      // Send analytics event (unless cancelled which throws before this or inside logic)
      // Note: If cancelled inside try block, it throws. We might want to NOT track those.
      // The catch block re-throws cancellations, so this finally block runs.
      // We check signal again to be sure we don't track cancelled items as failures if possible,
      // though 'status' will be 'failed' if exception was thrown.
      // Simplest is: if signal.aborted, don't send anything.
      if (!signal?.aborted) {
        trackCompletion();
      }
    }
  }

  // ===== Helper Methods =====
  protected shouldSkipByMockStage(ctx: StepContext): boolean {
    const myIndex = this.getStepIndex();
    // mockStageIndex > myIndex means we should skip this step
    return ctx.mockStageIndex >= 0 && ctx.mockStageIndex > myIndex;
  }

  protected shouldUseMockApi(ctx: StepContext): boolean {
    const mockApi = ctx.pipelineContext.settings.debug?.mockApi;
    if (!mockApi) return false;
    // Map step name to mockApi key
    const keyMap: Record<StepName, keyof typeof mockApi> = {
      transcribe: 'transcribe',
      waitDeps: 'transcribe', // No mock for waitDeps
      refinement: 'refinement',
      alignment: 'alignment',
      translation: 'translation',
      proofread: 'refinement', // Proofread uses same mock as refinement
    };
    return mockApi[keyMap[this.name]] === true;
  }

  protected getStepIndex(): number {
    return STEP_ORDER.indexOf(this.name);
  }

  private get capitalizedName(): string {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }

  private async executeWithRetry(
    input: TInput,
    ctx: StepContext,
    maxRetries = 1
  ): Promise<TOutput> {
    let lastResult: TOutput | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const isFinalAttempt = attempt === maxRetries;
      const result = await this.execute(input, ctx);
      lastResult = result;

      if (!this.postCheck) return result;

      const checkResult = await this.postCheck(result, isFinalAttempt, ctx);
      if (checkResult.isValid || !checkResult.retryable) {
        return result;
      }

      if (attempt < maxRetries) {
        logger.warn(
          `[Chunk ${ctx.chunk.index}] ${this.name} postCheck failed, retrying (${attempt + 1}/${maxRetries})`
        );
      }
    }

    return lastResult!;
  }
}

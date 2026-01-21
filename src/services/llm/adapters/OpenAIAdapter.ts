/**
 * OpenAI Adapter
 * Implements ILLMAdapter for OpenAI and OpenAI-compatible providers
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type {
  AdapterCapabilities,
  GenerateOptions,
  JsonModeCapability,
  ProviderConfig,
} from '@/types/llm';
import { isOfficialOpenAIModel } from '@/types/llm';
import { BaseAdapter } from './BaseAdapter';
import { logger } from '@/services/utils/logger';
import { safeParseJsonObject } from '@/services/utils/jsonParser';
import { STEP_CONFIGS, type StepName as ConfigStepName } from '@/config/models';
import i18n from '@/i18n';

/**
 * Get max output tokens based on model name
 * o-series and gpt-5: 100,000
 * gpt-4o: 16,384
 * Fallback: 16,384
 */
function getMaxOutputTokens(model: string): number {
  // O-series reasoning models: 100K
  if (/^o[1-9]/.test(model)) {
    return 100000;
  }
  // GPT-5 series: 128K
  if (model.startsWith('gpt-5')) {
    return 128000;
  }
  // GPT-4o default: 16K
  return 16384;
}

/**
 * OpenAI Adapter
 * Supports official OpenAI models and OpenAI-compatible providers
 */
export class OpenAIAdapter extends BaseAdapter {
  readonly type = 'openai' as const;
  readonly model: string;

  private client: OpenAI;
  private isOfficial: boolean;
  private cachedJsonMode: JsonModeCapability | null = null;

  constructor(config: ProviderConfig) {
    super(config);
    this.model = config.model;
    this.isOfficial = isOfficialOpenAIModel(config.model);

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true, // For Electron renderer
    });

    // Load cached capability if available
    this.loadCachedCapability();
  }

  /**
   * Get capabilities - official models have fixed capabilities,
   * compatible models may have cached or default capabilities
   */
  get capabilities(): AdapterCapabilities {
    if (this.isOfficial) {
      return {
        jsonMode: 'full_schema',
        audio: true,
        search: true,
      };
    }

    // For compatible models, use cached or default
    return {
      jsonMode: this.cachedJsonMode || 'full_schema', // Optimistic default
      audio: true,
      search: true,
    };
  }

  /**
   * Generate structured object response
   * Implements automatic degradation for non-official models
   */
  async generateObject<T>(options: GenerateOptions): Promise<T> {
    if (!options.schema) {
      throw new Error('Schema is required for generateObject');
    }

    // Determine which JSON mode to try
    const jsonMode = this.capabilities.jsonMode;

    logger.debug(`OpenAI generateObject started`, {
      model: this.model,
      jsonMode,
      isOfficial: this.isOfficial,
      useWebSearch: options.useWebSearch,
      promptLength: options.prompt.length,
    });

    try {
      if (jsonMode === 'full_schema') {
        return await this.generateWithFullSchema<T>(options);
      } else if (jsonMode === 'json_only') {
        return await this.generateWithJsonOnly<T>(options);
      } else {
        return await this.generateWithTextParsing<T>(options);
      }
    } catch (error: any) {
      // Check if error is due to unsupported schema
      if (this.isSchemaUnsupportedError(error) && !this.isOfficial) {
        logger.warn('Full schema not supported, falling back to json_only', {
          model: this.model,
          error: error.message,
        });
        this.cacheCapability('json_only');

        // Retry with json_only
        try {
          return await this.generateWithJsonOnly<T>(options);
        } catch (retryError: any) {
          if (this.isJsonUnsupportedError(retryError)) {
            logger.warn('JSON mode not supported, falling back to text parsing', {
              model: this.model,
            });
            this.cacheCapability('none');
            return await this.generateWithTextParsing<T>(options);
          }
          throw retryError;
        }
      }

      // OpenAI-specific error handling
      const actionableMessage = this.extractActionableError(error);
      if (actionableMessage) {
        throw new Error(actionableMessage);
      }
      throw error;
    }
  }

  /**
   * Extract actionable error message from OpenAI API error
   */
  private extractActionableError(error: any): string | undefined {
    const msg = (error.message || '').toLowerCase();
    const status = error.status;

    if (status === 401 || msg.includes('invalid api key') || msg.includes('unauthorized')) {
      return i18n.t('services:api.openai.errors.invalidKey');
    }
    if (status === 429 || msg.includes('rate limit') || msg.includes('quota')) {
      return i18n.t('services:api.openai.errors.rateLimited');
    }
    if (status === 403) {
      return i18n.t('services:api.openai.errors.permissionDenied');
    }
    if (msg.includes('model') && msg.includes('not found')) {
      return i18n.t('services:api.openai.errors.modelNotFound', { model: this.model });
    }

    return undefined;
  }

  /**
   * Generate with full JSON schema support (response_format)
   */
  private async generateWithFullSchema<T>(options: GenerateOptions): Promise<T> {
    const messages = this.buildMessages(options);
    const zodSchema = this.convertToZodSchema(options.schema!);

    // Build request params (without messages, they're passed to executeWithContinuation)
    const requestParams: any = {
      model: this.model,
      // Only pass max_tokens for official OpenAI models
      ...(this.isOfficial && { max_tokens: getMaxOutputTokens(this.model) }),
      response_format: zodResponseFormat(zodSchema, 'response'),
    };

    // Add web search if enabled
    if (this.shouldUseWebSearch(options)) {
      requestParams.web_search_options = {};
    }

    // Add reasoning effort if configured (for o1/o3/gpt-5 models)
    const reasoningEffort = this.getReasoningEffort(options);
    if (reasoningEffort) {
      requestParams.reasoning_effort = reasoningEffort;
    }

    const content = await this.executeWithContinuation(messages, requestParams, options);
    return safeParseJsonObject<T>(content);
  }

  /**
   * Generate with JSON mode only (no schema enforcement)
   */
  private async generateWithJsonOnly<T>(options: GenerateOptions): Promise<T> {
    const messages = this.buildMessages(options);

    // Embed schema description in the prompt
    const schemaPrompt = this.buildSchemaPrompt(options.schema!);
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastMessage = messages[messages.length - 1];
      if (typeof lastMessage.content === 'string') {
        lastMessage.content = `${lastMessage.content}\n\n${schemaPrompt}`;
      }
    }

    // Build request params (without messages)
    const requestParams: any = {
      model: this.model,
      // Only pass max_tokens for official OpenAI models
      ...(this.isOfficial && { max_tokens: getMaxOutputTokens(this.model) }),
      response_format: { type: 'json_object' },
    };

    // Add web search if enabled
    if (this.shouldUseWebSearch(options)) {
      requestParams.web_search_options = {};
    }

    // Add reasoning effort if configured (for o1/o3/gpt-5 models)
    const reasoningEffort = this.getReasoningEffort(options);
    if (reasoningEffort) {
      requestParams.reasoning_effort = reasoningEffort;
    }

    const content = await this.executeWithContinuation(messages, requestParams, options);
    return safeParseJsonObject<T>(content);
  }

  /**
   * Generate with text parsing (no JSON mode)
   */
  private async generateWithTextParsing<T>(options: GenerateOptions): Promise<T> {
    const messages = this.buildMessages(options);

    // Embed schema and JSON instruction
    const schemaPrompt = this.buildSchemaPrompt(options.schema!);
    const jsonInstruction = '\n\nIMPORTANT: Respond ONLY with valid JSON, no other text.';

    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastMessage = messages[messages.length - 1];
      if (typeof lastMessage.content === 'string') {
        lastMessage.content = `${lastMessage.content}\n\n${schemaPrompt}${jsonInstruction}`;
      }
    }

    // Build request params (without messages)
    const requestParams: any = {
      model: this.model,
      // Only pass max_tokens for official OpenAI models
      ...(this.isOfficial && { max_tokens: getMaxOutputTokens(this.model) }),
    };

    // Add web search if enabled
    if (this.shouldUseWebSearch(options)) {
      requestParams.web_search_options = {};
    }

    // Add reasoning effort if configured (for o1/o3/gpt-5 models)
    const reasoningEffort = this.getReasoningEffort(options);
    if (reasoningEffort) {
      requestParams.reasoning_effort = reasoningEffort;
    }

    const content = await this.executeWithContinuation(messages, requestParams, options);
    return safeParseJsonObject<T>(content);
  }

  /**
   * Build OpenAI messages from options
   */
  private buildMessages(options: GenerateOptions): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // System instruction
    if (options.systemInstruction) {
      messages.push({
        role: 'system',
        content: options.systemInstruction,
      });
    }

    // User message with optional audio
    if (options.audio) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: options.prompt },
          {
            type: 'input_audio',
            input_audio: {
              data: options.audio.data,
              format: this.getAudioFormat(options.audio.mimeType),
            },
          },
        ],
      } as any);
    } else {
      messages.push({
        role: 'user',
        content: options.prompt,
      });
    }

    return messages;
  }

  /**
   * Convert mimeType to OpenAI audio format
   */
  private getAudioFormat(mimeType: string): 'wav' | 'mp3' {
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3')) return 'mp3';
    return 'wav';
  }

  /**
   * Convert Gemini schema format to Zod schema
   * Handles ARRAY, OBJECT, STRING, INTEGER, NUMBER, BOOLEAN types
   * with properties, required, items, enum, nullable support
   */
  private convertToZodSchema(schema: any): z.ZodType {
    if (!schema || !schema.type) {
      return z.any();
    }

    return this.convertType(schema);
  }

  /**
   * Recursively convert a Gemini type to Zod
   */
  private convertType(schema: any): z.ZodType {
    const typeStr = typeof schema.type === 'string' ? schema.type.toUpperCase() : schema.type;

    switch (typeStr) {
      case 'ARRAY': {
        const itemSchema = schema.items ? this.convertType(schema.items) : z.any();
        let arraySchema: z.ZodType = z.array(itemSchema);
        if (schema.nullable) {
          arraySchema = arraySchema.nullable();
        }
        return arraySchema;
      }

      case 'OBJECT': {
        const shape: Record<string, z.ZodType> = {};
        const required = schema.required || [];

        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            let propType = this.convertType(propSchema);
            // Make optional if not in required array
            if (!required.includes(key)) {
              propType = propType.optional();
            }
            shape[key] = propType;
          }
        }

        let objectSchema: z.ZodType = z.object(shape);
        if (schema.nullable) {
          objectSchema = objectSchema.nullable();
        }
        return objectSchema;
      }

      case 'STRING': {
        let strSchema: z.ZodType = schema.enum
          ? z.enum(schema.enum as [string, ...string[]])
          : z.string();
        if (schema.nullable) {
          strSchema = strSchema.nullable();
        }
        return strSchema;
      }

      case 'INTEGER': {
        let intSchema: z.ZodType = z.number().int();
        if (schema.nullable) {
          intSchema = intSchema.nullable();
        }
        return intSchema;
      }

      case 'NUMBER': {
        let numSchema: z.ZodType = z.number();
        if (schema.nullable) {
          numSchema = numSchema.nullable();
        }
        return numSchema;
      }

      case 'BOOLEAN': {
        let boolSchema: z.ZodType = z.boolean();
        if (schema.nullable) {
          boolSchema = boolSchema.nullable();
        }
        return boolSchema;
      }

      default:
        logger.warn(`Unknown schema type: ${typeStr}, falling back to z.any()`);
        return z.any();
    }
  }

  /**
   * Build a prompt describing the expected JSON schema
   */
  private buildSchemaPrompt(schema: any): string {
    return `Please respond with JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
  }

  /**
   * Check if error indicates schema is not supported
   */
  private isSchemaUnsupportedError(error: any): boolean {
    const msg = error.message?.toLowerCase() || '';
    return (
      msg.includes('response_format') ||
      msg.includes('json_schema') ||
      msg.includes('not supported') ||
      msg.includes('unsupported')
    );
  }

  /**
   * Check if error indicates JSON mode is not supported
   */
  private isJsonUnsupportedError(error: any): boolean {
    const msg = error.message?.toLowerCase() || '';
    return msg.includes('json_object') || msg.includes('response_format');
  }

  /**
   * Load cached capability from settings
   */
  private loadCachedCapability(): void {
    // TODO: Load from settings.providerCapabilities
  }

  /**
   * Cache capability to settings
   */
  private cacheCapability(jsonMode: JsonModeCapability): void {
    this.cachedJsonMode = jsonMode;
    logger.info('Cached OpenAI provider capability', {
      model: this.model,
      baseUrl: this.config.baseUrl,
      jsonMode,
    });
  }

  /**
   * Execute request with automatic continuation for truncated responses
   * Detects finish_reason='length' and requests continuation
   */
  private async executeWithContinuation(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    requestParams: any,
    options: GenerateOptions,
    maxContinuations: number = 3
  ): Promise<string> {
    let fullText = '';
    let currentMessages = [...messages];
    let attempts = 0;

    while (attempts <= maxContinuations) {
      this.checkAborted(options.signal);

      const response = await this.executeWithRetry(
        () =>
          this.client.chat.completions.create({
            ...requestParams,
            messages: currentMessages,
          }),
        {
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          retries: 3,
        }
      );

      // Track usage
      if (options.onUsage && response.usage) {
        options.onUsage({
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        });
      }

      const choice = response.choices[0];
      const content = choice?.message?.content || '';
      fullText += content;

      // Check if response was truncated
      if (choice?.finish_reason === 'length') {
        logger.warn(
          `OpenAI response truncated (attempt ${attempts + 1}). Requesting continuation...`,
          {
            model: this.model,
            contentLength: fullText.length,
          }
        );

        // Add assistant's partial response and continuation request
        currentMessages.push({
          role: 'assistant',
          content: content,
        });
        currentMessages.push({
          role: 'user',
          content: 'The response was truncated. Please continue exactly where you left off.',
        });

        attempts++;
      } else {
        // Response complete
        break;
      }
    }

    if (!fullText) {
      throw new Error('Empty response from OpenAI');
    }

    return fullText;
  }

  /**
   * Determine if web search should be enabled based on stepName
   * Reads from STEP_CONFIGS if stepName is provided
   * Only applies to official OpenAI models
   */
  private shouldUseWebSearch(options: GenerateOptions): boolean {
    // Only official OpenAI models support web search
    if (!this.isOfficial) {
      return false;
    }

    // Explicit option takes precedence
    if (options.useWebSearch !== undefined) {
      return options.useWebSearch;
    }

    // Check STEP_CONFIGS based on stepName
    if (options.stepName) {
      const stepMapping: Record<string, ConfigStepName> = {
        refinement: 'refinement',
        translation: 'translation',
        proofread: 'batchProofread',
        speakerExtraction: 'speakerProfile',
        glossaryExtraction: 'glossaryExtraction',
      };
      const configStepName = stepMapping[options.stepName];
      if (configStepName && STEP_CONFIGS[configStepName]) {
        return STEP_CONFIGS[configStepName].useSearch ?? false;
      }
    }

    return false;
  }

  /**
   * Get reasoning effort based on stepName's thinkingLevel
   * Maps thinkingLevel to OpenAI's reasoning_effort parameter
   * Only works with o-series and gpt-5+ models
   */
  private getReasoningEffort(options: GenerateOptions): 'low' | 'medium' | 'high' | undefined {
    // Only official OpenAI models support reasoning_effort
    if (!this.isOfficial) {
      return undefined;
    }

    // Check model compatibility - only o-series and gpt-5+ support reasoning
    const supportsReasoning =
      this.model.startsWith('o1') ||
      this.model.startsWith('o3') ||
      this.model.startsWith('o4') ||
      this.model.startsWith('gpt-5');

    if (!supportsReasoning) {
      return undefined;
    }

    if (!options.stepName) {
      return undefined;
    }

    const stepMapping: Record<string, ConfigStepName> = {
      refinement: 'refinement',
      translation: 'translation',
      proofread: 'batchProofread',
      speakerExtraction: 'speakerProfile',
      glossaryExtraction: 'glossaryExtraction',
    };

    const configStepName = stepMapping[options.stepName];
    if (configStepName && STEP_CONFIGS[configStepName]) {
      const thinkingLevel = STEP_CONFIGS[configStepName].thinkingLevel;
      if (thinkingLevel && thinkingLevel !== 'none') {
        return thinkingLevel as 'low' | 'medium' | 'high';
      }
    }

    return undefined;
  }
}

export const MODELS = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-3-pro-preview',
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

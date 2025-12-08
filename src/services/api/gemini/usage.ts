import { TokenUsage } from '@/types/api';

export interface UsageReport {
  [model: string]: {
    prompt: number;
    output: number;
    total: number;
    textInput: number;
    audioInput: number;
    thoughts: number;
  };
}

export function createUsageReport(): UsageReport {
  return {};
}

export function createUsageTracker(report: UsageReport) {
  return (usage: TokenUsage) => {
    const model = usage.modelName;
    if (!report[model]) {
      report[model] = {
        prompt: 0,
        output: 0,
        total: 0,
        textInput: 0,
        audioInput: 0,
        thoughts: 0,
      };
    }
    report[model].prompt += usage.promptTokens;
    report[model].output += usage.candidatesTokens;
    report[model].total += usage.totalTokens;
    report[model].textInput += usage.textInputTokens || 0;
    report[model].audioInput += usage.audioInputTokens || 0;
    report[model].thoughts += usage.thoughtsTokens || 0;
  };
}

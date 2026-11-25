import type { ProviderPreset } from './runtime';

export declare const LLM_PROVIDER_PRESETS: Record<string, ProviderPreset>;
export declare function generateCoordinatorSummary(params: {
  llmConfig: any;
  userRequest: string;
  observations: any;
  actionOutcomes: any[];
}): Promise<{ text: string; usedProvider: string; model: string }>;
export declare function buildDeterministicSummary(
  userRequest: string,
  observations: any,
  actionOutcomes: any[]
): { text: string; usedProvider: string; model: string };

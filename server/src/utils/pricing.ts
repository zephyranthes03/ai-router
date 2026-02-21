export type TierName = "budget" | "standard" | "premium";

/**
 * Max output tokens per tier — sized so that even worst-case output cost
 * stays within the x402 fixed price (with margin for input cost).
 *
 *   Budget  ($0.001): 512 tokens  → worst output ≈ $0.0025 (Haiku)
 *   Standard($0.01):  2048 tokens → worst output ≈ $0.030  (Sonnet)
 *   Premium ($0.02+):  4096 tokens → worst output ≈ $0.102  (Opus)
 */
export const TIER_MAX_OUTPUT_TOKENS: Record<TierName, number> = {
  budget: 512,
  standard: 2048,
  premium: 4096,
};

export interface ProviderInfo {
  model: string;
  provider: string;
  tier: TierName;
  name: string;
  x402_price: string;
  max_output_tokens: number;
  pricing: { input_per_1k_tokens: number; output_per_1k_tokens: number };
  capabilities: {
    domains: string[];
    extended_thinking: boolean;
    web_search: boolean;
    max_context: number;
  };
  scores: { speed: number; quality: number };
}

export const PROVIDERS: Record<string, ProviderInfo> = {
  haiku: {
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    tier: "budget",
    name: "Claude Haiku 4.5",
    x402_price: "$0.001",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.budget,
    pricing: { input_per_1k_tokens: 0.001, output_per_1k_tokens: 0.005 },
    capabilities: { domains: ["simple_qa", "writing"], extended_thinking: false, web_search: false, max_context: 200000 },
    scores: { speed: 95, quality: 35 },
  },
  deepseek_v3: {
    model: "deepseek-chat",
    provider: "deepseek",
    tier: "budget",
    name: "DeepSeek V3.2",
    x402_price: "$0.001",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.budget,
    pricing: { input_per_1k_tokens: 0.001, output_per_1k_tokens: 0.002 },
    capabilities: { domains: ["code"], extended_thinking: false, web_search: false, max_context: 128000 },
    scores: { speed: 85, quality: 50 },
  },
  gemini_flash: {
    model: "gemini-2.0-flash",
    provider: "gemini",
    tier: "budget",
    name: "Gemini 3 Flash",
    x402_price: "$0.001",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.budget,
    pricing: { input_per_1k_tokens: 0.0005, output_per_1k_tokens: 0.003 },
    capabilities: { domains: ["code", "analysis", "writing"], extended_thinking: false, web_search: true, max_context: 1000000 },
    scores: { speed: 90, quality: 55 },
  },
  claude_sonnet: {
    model: "claude-sonnet-4-5-20250929",
    provider: "anthropic",
    tier: "standard",
    name: "Claude Sonnet 4.5",
    x402_price: "$0.01",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.standard,
    pricing: { input_per_1k_tokens: 0.003, output_per_1k_tokens: 0.015 },
    capabilities: { domains: ["code", "analysis", "writing"], extended_thinking: true, web_search: false, max_context: 200000 },
    scores: { speed: 60, quality: 80 },
  },
  gpt5: {
    model: "gpt-5.2",
    provider: "openai",
    tier: "standard",
    name: "GPT-5.2",
    x402_price: "$0.01",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.standard,
    pricing: { input_per_1k_tokens: 0.00175, output_per_1k_tokens: 0.014 },
    capabilities: { domains: ["code", "analysis", "writing", "math"], extended_thinking: false, web_search: true, max_context: 128000 },
    scores: { speed: 65, quality: 78 },
  },
  gemini_pro: {
    model: "gemini-2.5-pro",
    provider: "gemini",
    tier: "standard",
    name: "Gemini 3 Pro",
    x402_price: "$0.01",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.standard,
    pricing: { input_per_1k_tokens: 0.002, output_per_1k_tokens: 0.012 },
    capabilities: { domains: ["code", "analysis", "writing", "math"], extended_thinking: true, web_search: true, max_context: 1000000 },
    scores: { speed: 55, quality: 82 },
  },
  deepseek_r1: {
    model: "deepseek-reasoner",
    provider: "deepseek",
    tier: "premium",
    name: "DeepSeek R1",
    x402_price: "$0.02",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.premium,
    pricing: { input_per_1k_tokens: 0.00055, output_per_1k_tokens: 0.00219 },
    capabilities: { domains: ["code", "math", "reasoning"], extended_thinking: true, web_search: false, max_context: 128000 },
    scores: { speed: 30, quality: 90 },
  },
  claude_opus: {
    model: "claude-opus-4-5-20251101",
    provider: "anthropic",
    tier: "premium",
    name: "Claude Opus 4.5",
    x402_price: "$0.03",
    max_output_tokens: TIER_MAX_OUTPUT_TOKENS.premium,
    pricing: { input_per_1k_tokens: 0.005, output_per_1k_tokens: 0.025 },
    capabilities: { domains: ["code", "analysis", "writing", "math", "reasoning"], extended_thinking: true, web_search: false, max_context: 200000 },
    scores: { speed: 25, quality: 95 },
  },
};

/**
 * Get provider information by ID
 */
export function getProviderInfo(providerId: string): ProviderInfo | undefined {
  return PROVIDERS[providerId];
}

/**
 * Get all provider IDs for a given tier
 */
export function getProvidersForTier(tier: TierName): string[] {
  return Object.entries(PROVIDERS)
    .filter(([_, info]) => info.tier === tier)
    .map(([id, _]) => id);
}

/**
 * Estimate cost for a request
 */
export function estimateCost(
  providerId: string,
  inputTokens: number,
  outputTokens: number
): { input_cost: number; output_cost: number; actual_total: number } {
  const providerInfo = getProviderInfo(providerId);
  if (!providerInfo) {
    return { input_cost: 0, output_cost: 0, actual_total: 0 };
  }

  const input_cost = (inputTokens / 1000) * providerInfo.pricing.input_per_1k_tokens;
  const output_cost = (outputTokens / 1000) * providerInfo.pricing.output_per_1k_tokens;
  const actual_total = input_cost + output_cost;

  return { input_cost, output_cost, actual_total };
}

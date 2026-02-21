import { createAnthropicAdapter } from "./anthropic.js";
import { createOpenAIAdapter } from "./openai.js";
import { createDeepSeekAdapter } from "./deepseek.js";
import { createGeminiAdapter } from "./gemini.js";
import { createDemoAdapter } from "./demo.js";
import type { ProviderAdapter, AIRequest, AIResponse } from "./types.js";
import { PROVIDERS, type TierName } from "../utils/pricing.js";
import { config, getConfiguredProviders } from "../config/env.js";
import { logger } from "../utils/logger.js";

class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();
  private demoProviders: Set<string> = new Set();

  async init(): Promise<void> {
    const configured = getConfiguredProviders();

    if (configured.anthropic) {
      this.adapters.set("anthropic", createAnthropicAdapter());
    } else {
      this.adapters.set("anthropic", createDemoAdapter("anthropic"));
      this.demoProviders.add("anthropic");
      logger.warn("ANTHROPIC_API_KEY not set — using demo mode for Anthropic models");
    }

    if (configured.openai) {
      this.adapters.set("openai", createOpenAIAdapter());
    } else {
      this.adapters.set("openai", createDemoAdapter("openai"));
      this.demoProviders.add("openai");
      logger.warn("OPENAI_API_KEY not set — using demo mode for OpenAI models");
    }

    if (configured.deepseek) {
      this.adapters.set("deepseek", createDeepSeekAdapter());
    } else {
      this.adapters.set("deepseek", createDemoAdapter("deepseek"));
      this.demoProviders.add("deepseek");
      logger.warn("DEEPSEEK_API_KEY not set — using demo mode for DeepSeek models");
    }

    if (configured.gemini) {
      this.adapters.set("gemini", createGeminiAdapter());
    } else {
      this.adapters.set("gemini", createDemoAdapter("gemini"));
      this.demoProviders.add("gemini");
      logger.warn("GEMINI_API_KEY not set — using demo mode for Gemini models");
    }

    const liveCount = 4 - this.demoProviders.size;
    if (this.demoProviders.size > 0) {
      logger.info(
        `Provider registry initialized: ${liveCount} live, ${this.demoProviders.size} demo`
      );
    }
  }

  getAdapter(providerId: string): ProviderAdapter {
    const provider = PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown provider_id: ${providerId}`);
    }

    const adapter = this.adapters.get(provider.provider);
    if (!adapter) {
      throw new Error(`Provider adapter not initialized: ${provider.provider}`);
    }

    return adapter;
  }

  isDemo(providerId: string): boolean {
    const provider = PROVIDERS[providerId];
    if (!provider) return false;
    return this.demoProviders.has(provider.provider);
  }

  getDemoProviders(): string[] {
    return [...this.demoProviders];
  }

  async executeRequest(
    providerId: string,
    request: Omit<AIRequest, "model">
  ): Promise<AIResponse> {
    const provider = PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown provider_id: ${providerId}`);
    }

    const adapter = this.getAdapter(providerId);

    const fullRequest: AIRequest = {
      ...request,
      model: provider.model,
    };

    return adapter.execute(fullRequest);
  }

  async healthCheck(): Promise<Record<string, { healthy: boolean; demo: boolean }>> {
    const results: Record<string, { healthy: boolean; demo: boolean }> = {};

    for (const [name, adapter] of this.adapters.entries()) {
      const isDemo = this.demoProviders.has(name);
      try {
        const healthy = await adapter.healthCheck();
        results[name] = { healthy, demo: isDemo };
      } catch (error) {
        results[name] = { healthy: false, demo: isDemo };
      }
    }

    return results;
  }
}

export const registry = new ProviderRegistry();

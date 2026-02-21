import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/env.js";
import type { AIRequest, AIResponse, ProviderAdapter } from "./types.js";

export function createAnthropicAdapter(): ProviderAdapter {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  return {
    name: "anthropic",

    async execute(request: AIRequest): Promise<AIResponse> {
      const startTime = Date.now();

      try {
        // Extract system messages
        const systemMessages = request.messages
          .filter((msg) => msg.role === "system")
          .map((msg) => msg.content)
          .join("\n");

        const userMessages = request.messages.filter((msg) => msg.role !== "system");

        // Default max_tokens
        let maxTokens = request.max_tokens || 4096;

        // Thinking parameters
        const thinkingParams: any = {};
        let timeout = 30000; // 30s default

        if (request.thinking) {
          const thinkingBudget = request.thinking_budget || 10000;
          thinkingParams.thinking = {
            type: "enabled",
            budget_tokens: thinkingBudget,
          };
          // CRITICAL: max_tokens MUST be greater than budget_tokens
          maxTokens = Math.max(maxTokens, thinkingBudget + 4096);
          thinkingParams.temperature = 1; // Required by Anthropic when thinking enabled
          timeout = 120000; // 120s for thinking
        } else if (request.temperature !== undefined) {
          thinkingParams.temperature = request.temperature;
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await client.messages.create(
            {
              model: request.model,
              system: systemMessages || undefined,
              messages: userMessages.map((msg) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              })),
              max_tokens: maxTokens,
              ...thinkingParams,
            },
            { signal: controller.signal as any }
          );

          clearTimeout(timeoutId);

          // Extract content and thinking
          const contentBlock = response.content.find((block) => block.type === "text");
          const thinkingBlock = response.content.find((block) => block.type === "thinking");

          const content = contentBlock && "text" in contentBlock ? contentBlock.text : "";
          const thinking =
            thinkingBlock && "thinking" in thinkingBlock ? thinkingBlock.thinking : undefined;

          return {
            content,
            model: response.model,
            usage: {
              input_tokens: response.usage.input_tokens,
              output_tokens: response.usage.output_tokens,
            },
            thinking,
            provider: "anthropic",
            latency_ms: Date.now() - startTime,
          };
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === "AbortError") {
            throw new Error("Provider timed out");
          }
          throw error;
        }
      } catch (error: any) {
        // Sanitize error messages to avoid exposing API keys
        const message = error.message?.replace(config.ANTHROPIC_API_KEY, "[REDACTED]") || "Unknown error";
        throw new Error(`Anthropic API error: ${message}`);
      }
    },

    async healthCheck(): Promise<boolean> {
      try {
        await client.messages.create({
          model: "claude-3-5-haiku-20241022",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

import OpenAI from "openai";
import { config } from "../config/env.js";
import type { AIRequest, AIResponse, ProviderAdapter } from "./types.js";

export function createOpenAIAdapter(): ProviderAdapter {
  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  return {
    name: "openai",

    async execute(request: AIRequest): Promise<AIResponse> {
      const startTime = Date.now();

      try {
        // Default max_completion_tokens
        const maxCompletionTokens = request.max_tokens || 4096;

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
          const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
            model: request.model,
            messages: request.messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            max_completion_tokens: maxCompletionTokens,
          };

          if (request.temperature !== undefined) {
            params.temperature = request.temperature;
          }

          const response = await client.chat.completions.create(params, {
            signal: controller.signal as any,
          });

          clearTimeout(timeoutId);

          const content = response.choices[0]?.message?.content || "";

          return {
            content,
            model: response.model,
            usage: {
              input_tokens: response.usage?.prompt_tokens || 0,
              output_tokens: response.usage?.completion_tokens || 0,
            },
            provider: "openai",
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
        const message = error.message?.replace(config.OPENAI_API_KEY, "[REDACTED]") || "Unknown error";
        throw new Error(`OpenAI API error: ${message}`);
      }
    },

    async healthCheck(): Promise<boolean> {
      try {
        await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "ping" }],
          max_completion_tokens: 10,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

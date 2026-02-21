import OpenAI from "openai";
import { config } from "../config/env.js";
import type { AIRequest, AIResponse, ProviderAdapter } from "./types.js";

export function createDeepSeekAdapter(): ProviderAdapter {
  const client = new OpenAI({
    apiKey: config.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  return {
    name: "deepseek",

    async execute(request: AIRequest): Promise<AIResponse> {
      const startTime = Date.now();

      try {
        // Higher default for deepseek-reasoner since it includes reasoning tokens
        const isReasoner = request.model === "deepseek-reasoner";
        const maxTokens = request.max_tokens || (isReasoner ? 16384 : 4096);

        // Create abort controller for timeout
        const timeout = isReasoner ? 120000 : 30000; // 120s for reasoner, 30s for chat
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
            model: request.model,
            messages: request.messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            max_tokens: maxTokens,
          };

          if (request.temperature !== undefined) {
            params.temperature = request.temperature;
          }

          const response = await client.chat.completions.create(params, {
            signal: controller.signal as any,
          });

          clearTimeout(timeoutId);

          const content = response.choices[0]?.message?.content || "";

          // Extract reasoning content if present (deepseek-reasoner)
          const reasoning = (response.choices[0]?.message as any)?.reasoning_content;

          return {
            content,
            model: response.model,
            usage: {
              input_tokens: response.usage?.prompt_tokens || 0,
              output_tokens: response.usage?.completion_tokens || 0,
            },
            thinking: reasoning,
            provider: "deepseek",
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
        const message = error.message?.replace(config.DEEPSEEK_API_KEY, "[REDACTED]") || "Unknown error";
        throw new Error(`DeepSeek API error: ${message}`);
      }
    },

    async healthCheck(): Promise<boolean> {
      try {
        await client.chat.completions.create({
          model: "deepseek-chat",
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

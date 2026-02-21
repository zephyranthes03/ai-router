import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env.js";
import type { AIRequest, AIResponse, ProviderAdapter } from "./types.js";

export function createGeminiAdapter(): ProviderAdapter {
  const client = new GoogleGenerativeAI(config.GEMINI_API_KEY);

  return {
    name: "gemini",

    async execute(request: AIRequest): Promise<AIResponse> {
      const startTime = Date.now();

      try {
        // Extract system messages for systemInstruction
        const systemMessages = request.messages
          .filter((msg) => msg.role === "system")
          .map((msg) => msg.content)
          .join("\n");

        // Convert messages to Gemini format
        const history = request.messages
          .filter((msg) => msg.role !== "system")
          .map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));

        // Get the model
        const model = client.getGenerativeModel({
          model: request.model,
          systemInstruction: systemMessages || undefined,
        });

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeout = 30000; // 30s default
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          // Build request (enable Google Search grounding for real-time queries)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const generateRequest: any = {
            contents: history,
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.max_tokens,
            },
          };
          if (request.web_search) {
            generateRequest.tools = [{ googleSearch: {} }];
          }

          const result = await model.generateContent(generateRequest);

          clearTimeout(timeoutId);

          const response = result.response;
          const content = response.text();

          // Extract token usage
          const usageMetadata = response.usageMetadata;
          const inputTokens = usageMetadata?.promptTokenCount || 0;
          const outputTokens = usageMetadata?.candidatesTokenCount || 0;

          return {
            content,
            model: request.model,
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
            },
            provider: "gemini",
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
        const message = error.message?.replace(config.GEMINI_API_KEY, "[REDACTED]") || "Unknown error";
        throw new Error(`Gemini API error: ${message}`);
      }
    },

    async healthCheck(): Promise<boolean> {
      try {
        const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
        await model.generateContent({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

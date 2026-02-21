import type { AIRequest, AIResponse, ProviderAdapter } from "./types.js";

type DemoDomain = "general" | "code" | "analysis" | "math";

const DEMO_RESPONSES: Record<DemoDomain, string[]> = {
  general: [
    "This is a demo response from ProofRoute AI. The routing logic selected this provider based on your request metadata (domain, priority, capabilities). In production, this would be a real AI response powered by the selected model.",
    "ProofRoute AI demo mode active. Your request was successfully routed through the smart routing pipeline. The system evaluated 8 providers across 3 tiers (budget/standard/premium) to select the optimal model for your query.",
  ],
  code: [
    "```python\n# Demo response - ProofRoute AI successfully routed your code request\ndef fibonacci(n: int) -> int:\n    \"\"\"Calculate the nth Fibonacci number.\"\"\"\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b\n```\n\n*This is a demo response. The routing engine selected this provider for code tasks. Configure API keys in `.env` for real AI responses.*",
  ],
  analysis: [
    "**Demo Analysis Response**\n\nProofRoute AI successfully processed your analysis request through the following pipeline:\n1. **PII Detection** - Local Llama scanned for sensitive data\n2. **Smart Routing** - Selected optimal provider based on domain + priority\n3. **x402 Payment** - USDC micropayment on Base Sepolia\n4. **ZK Proof** - Usage recorded for accountability proof\n\n*Configure API keys in `.env` for real AI-powered analysis.*",
  ],
  math: [
    "**Demo Math Response**\n\nProofRoute AI routed your math query to a reasoning-capable model.\n\nExample calculation: The integral of x² from 0 to 1 = [x³/3]₀¹ = 1/3 ≈ 0.333\n\n*This is a demo. The routing system correctly identified this as a math domain query and selected a provider with reasoning capabilities. Set up API keys for real responses.*",
  ],
};

function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new Error("pickRandom called with an empty array");
  }
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function simulateTokenCount(messages: AIRequest["messages"]): {
  input: number;
  output: number;
} {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const input = Math.max(10, Math.floor(totalChars / 4));
  const output = Math.floor(50 + Math.random() * 150);
  return { input, output };
}

export function createDemoAdapter(providerName: string): ProviderAdapter {
  return {
    name: `${providerName} (demo)`,

    async execute(request: AIRequest): Promise<AIResponse> {
      const startTime = Date.now();

      // Simulate realistic latency (100-500ms)
      const simulatedLatency = 100 + Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, simulatedLatency));

      // Pick domain-appropriate response
      const lastMessage = request.messages[request.messages.length - 1]?.content.toLowerCase() ?? "";
      let domain: DemoDomain = "general";
      if (lastMessage.includes("code") || lastMessage.includes("function") || lastMessage.includes("program")) {
        domain = "code";
      } else if (lastMessage.includes("analy") || lastMessage.includes("explain") || lastMessage.includes("compare")) {
        domain = "analysis";
      } else if (lastMessage.includes("math") || lastMessage.includes("calcul") || lastMessage.includes("equation")) {
        domain = "math";
      }

      const responses = DEMO_RESPONSES[domain];
      const content = pickRandom(responses);

      const tokens = simulateTokenCount(request.messages);

      const result: AIResponse = {
        content,
        model: `${request.model} (demo)`,
        usage: {
          input_tokens: tokens.input,
          output_tokens: tokens.output,
        },
        provider: providerName,
        latency_ms: Date.now() - startTime,
      };

      // Simulate thinking for models that support it
      if (request.thinking) {
        result.thinking =
          "Demo thinking trace: The routing engine correctly identified this request requires extended thinking. " +
          "In production, the selected model would perform multi-step reasoning here. " +
          "The ZK proof system will record this usage for on-chain accountability verification.";
      }

      return result;
    },

    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

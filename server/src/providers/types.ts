export interface AIRequest {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  max_tokens?: number;
  temperature?: number;
  thinking?: boolean;
  thinking_budget?: number;
  web_search?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  thinking?: string;
  provider: string;
  latency_ms: number;
}

export interface ProviderAdapter {
  name: string;
  execute(request: AIRequest): Promise<AIResponse>;
  healthCheck(): Promise<boolean>;
}

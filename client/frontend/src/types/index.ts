// ========================
// Server Gateway Types
// ========================

/** Health status from local FastAPI */
export interface HealthStatus {
  status: "ok" | "error";
  ollama_available: boolean;
  ollama_model: string;
  gateway_server: string;
  gateway_reachable: boolean;
}

/** User settings stored locally */
export interface UserSettings {
  tier: "budget" | "standard" | "premium";
  speed_quality_weight: number;
  pii_mode: "none" | "permissive" | "strict" | "user_select";
  max_budget_per_request: number;
  monthly_max_budget: number;
  preferred_providers: string[];
  ollama_enabled: boolean;
  extended_thinking: boolean;
  web_search: boolean;
}

/** Partial settings for update */
export interface UserSettingsUpdate {
  tier?: "budget" | "standard" | "premium";
  speed_quality_weight?: number;
  pii_mode?: "none" | "permissive" | "strict" | "user_select";
  max_budget_per_request?: number;
  monthly_max_budget?: number;
  preferred_providers?: string[];
  ollama_enabled?: boolean;
  extended_thinking?: boolean;
  web_search?: boolean;
}

/** Provider from server's GET /providers */
export interface Provider {
  id: string;
  name: string;
  tier: "budget" | "standard" | "premium";
  x402_price: string;
  max_output_tokens: number;
  pricing: {
    input_per_1k_tokens: number;
    output_per_1k_tokens: number;
  };
  capabilities: {
    domains: string[];
    extended_thinking: boolean;
    web_search: boolean;
    max_context: number;
  };
  scores: {
    speed: number;
    quality: number;
  };
}

// ========================
// PII Types
// ========================

export interface PiiDetection {
  type: string;
  value: string;
  start: number;
  end: number;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  source: "regex" | "presidio";
  action: "mask" | "pass";
  placeholder?: string;  // replacement token e.g. "[ETH_ADDRESS]", undefined for presidio-only detections
}

export interface PiiReport {
  detections: PiiDetection[];
  count: number;
  masked_count: number;
  has_critical: boolean;
}

// ========================
// Routing Types
// ========================

/** Response from server's POST /route endpoint */
export interface RouteResponse {
  recommended_provider: string;
  provider_name: string;
  x402_price: string;
  endpoint: string;
  reasoning: string;
}

/** Routing metadata sent to server's POST /route */
export interface RoutingMetadata {
  context_length: number;
  domain: string;
  tier: "budget" | "standard" | "premium";
  speed_quality_weight: number;
  requires_thinking: boolean;
  requires_web_search: boolean;
}

export interface ProviderSelection {
  provider_id: string;
  provider_name: string;
  tier: "budget" | "standard" | "premium";
  x402_price: string;
  endpoint: string;
  reasoning: string;
  source: "server" | "fallback";
}

/** Flattened routing result from POST /analyze response */
export interface RoutingResult {
  provider_id: string;
  provider_name: string;
  tier: string;
  x402_price: string;
  endpoint: string;
  reasoning: string;
  source: string;
  requires_web_search: boolean;
}

// ========================
// Analysis Response (from local FastAPI)
// ========================

export interface AnalyzeResponse {
  masked_text: string;
  pii_report: PiiReport;
  routing: RoutingResult;
  mask_map: Record<string, string>;       // "[PLACEHOLDER]" -> original value, for unmasking AI responses
  strict_masked_text: string;             // text with ALL detections masked, for strict-mode preview in dialog
}

// ========================
// Estimate Response (from server POST /estimate)
// ========================

export interface EstimateResponse {
  provider_id: string;
  estimated_cost_usd: number;
  breakdown: {
    input_cost: number;
    output_cost: number;
    total: number;
  };
  tier: string;
  x402_price: string;
}

// ========================
// Chat Types
// ========================

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  pii_report?: PiiReport;
  provider?: string;
  provider_name?: string;
  tier?: string;
  cost?: CostInfo;
  thinking?: string;
  tokens?: { input: number; output: number };
  mask_map?: Record<string, string>;      // stored per-message for unmasking AI response that follows
}

export interface CostInfo {
  input_cost: number;
  output_cost: number;
  actual_total: number;
  charged: number;
}

// ========================
// Server AI Response (from POST /request/:provider_id)
// ========================

export interface AIResponse {
  provider_id: string;
  response: {
    content: string;
    model: string;
    usage: { input_tokens: number; output_tokens: number };
    thinking?: string;
  };
  cost: CostInfo;
  limits?: {
    tier: string;
    max_output_tokens: number;
    requested_max_tokens: number;
    applied_max_tokens: number;
  };
}

// ========================
// Conversation Types
// ========================

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  isFavorite: boolean;
}

// ========================
// x402 Request Params
// ========================

export interface X402RequestParams {
  provider_id: string;
  messages: Array<{ role: string; content: string }>;
  options: {
    max_tokens?: number;
    extended_thinking?: boolean;
    thinking_budget?: number;
    requires_web_search?: boolean;
  };
}

// ========================
// Usage & Billing Types
// ========================

export type UsagePeriod = "daily" | "weekly" | "monthly";

export interface UsageFilter {
  period: UsagePeriod;
  dateRange?: { start: number; end: number };
  providerIds?: string[];
}

export interface UsageRecord {
  id: string;
  timestamp: number;
  provider_id: string;
  provider_name: string;
  tier: string;
  cost: CostInfo;
  tokens: { input: number; output: number };
  conversation_id?: string;
}

export interface ProviderUsageSummary {
  provider_name: string;
  tier: string;
  totalCost: number;
  totalCharged: number;
  requestCount: number;
  tokenCount: { input: number; output: number };
}

export interface DateBucket {
  date: string;
  cost: number;
  charged: number;
  requestCount: number;
  byProvider: Record<string, number>;
}

export interface UsageSummary {
  totalCost: number;
  totalCharged: number;
  requestCount: number;
  tokenCount: { input: number; output: number };
  byProvider: Record<string, ProviderUsageSummary>;
  byDate: DateBucket[];
}

export interface UsdcTransfer {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  estimatedTimestamp: number;
  blockNumber: bigint;
}

// ========================
// Embedded Wallet Types
// ========================

export type WalletMode = "injected" | "embedded";

export type EmbeddedWalletState =
  | "no-wallet"    // No keystore found — needs setup
  | "locked"       // Keystore exists but not yet unlocked
  | "unlocked"     // Private key decrypted, walletClient ready
  | "loading";     // Checking keystore status

export interface EncryptedKeystore {
  version: 1;
  address: string;
  iv: string;        // base64
  salt: string;      // base64
  ciphertext: string; // base64
  createdAt: number;
}

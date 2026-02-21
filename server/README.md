# AI Gateway Server

A privacy-first AI gateway that routes requests to multiple AI providers with x402 USDC micropayment verification on Base Sepolia testnet. Built for the ETHDenver 2026 hackathon.

## Overview

The server acts as a "dumb pipe" that:

- Receives masked AI requests (request metadata only, no user data)
- Verifies x402 USDC micropayments via the facilitator
- Proxies requests to 8 AI providers (Anthropic, OpenAI, Google, DeepSeek)
- Returns AI responses with actual cost breakdowns
- Never logs or stores user message content

This architecture separates payment verification from the actual AI request, enabling privacy-first interactions where the server never sees original user data.

## Quick Start

### Prerequisites

- Node.js 20+ (required for full x402 functionality)
- npm 8+

### 1. Setup Environment

```bash
cp .env.example .env
```

Fill in your API keys:

```env
PORT=3001
NODE_ENV=development
RESOURCE_WALLET_ADDRESS=0xYourWalletOnBaseSepolia
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=eip155:84532

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Server listens on `http://localhost:3001`

### 4. Verify Health

```bash
curl http://localhost:3001/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-11T12:00:00.000Z",
  "providers": {
    "anthropic": true,
    "openai": true,
    "deepseek": true,
    "gemini": true
  }
}
```

## API Reference

### Available Providers

| ID | Name | Model | Tier | x402 Price | Provider |
|---|---|---|---|---|---|
| `haiku` | Claude Haiku 4.5 | claude-haiku-4-5-20251001 | budget | $0.001 | Anthropic |
| `deepseek_v3` | DeepSeek V3.2 | deepseek-chat | budget | $0.001 | DeepSeek |
| `gemini_flash` | Gemini 3 Flash | gemini-3-flash-preview | budget | $0.001 | Google |
| `claude_sonnet` | Claude Sonnet 4.5 | claude-sonnet-4-5-20250929 | standard | $0.01 | Anthropic |
| `gpt5` | GPT-5.2 | gpt-5.2 | standard | $0.01 | OpenAI |
| `gemini_pro` | Gemini 3 Pro | gemini-3-pro-preview | standard | $0.01 | Google |
| `deepseek_r1` | DeepSeek R1 | deepseek-reasoner | premium | $0.02 | DeepSeek |
| `claude_opus` | Claude Opus 4.5 | claude-opus-4-5-20251101 | premium | $0.03 | Anthropic |

### GET /health

Health check for server and all AI provider connections.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2026-02-11T12:00:00.000Z",
  "providers": {
    "anthropic": true,
    "openai": true,
    "deepseek": true,
    "gemini": true
  }
}
```

**Response (503 Service Unavailable):**

```json
{
  "status": "error",
  "timestamp": "2026-02-11T12:00:00.000Z"
}
```

---

### GET /providers

List all available providers with pricing and capabilities.

**Response (200 OK):**

```json
{
  "providers": [
    {
      "id": "haiku",
      "name": "Claude Haiku 4.5",
      "tier": "budget",
      "pricing": {
        "input_per_1k_tokens": 0.0008,
        "output_per_1k_tokens": 0.004
      },
      "capabilities": {
        "domains": ["simple_qa", "writing"],
        "extended_thinking": false,
        "web_search": false,
        "max_context": 200000
      }
    },
    ...
  ]
}
```

---

### POST /estimate

Estimate cost for a request without executing it.

**Request:**

```json
{
  "provider_id": "gemini_flash",
  "token_estimate": 1000
}
```

**Response (200 OK):**

```json
{
  "provider_id": "gemini_flash",
  "estimated_cost_usd": 0.00025,
  "breakdown": {
    "input_cost": 0.00005,
    "output_cost": 0.0002,
    "total": 0.00025
  },
  "tier": "budget",
  "x402_price": "$0.001"
}
```

**Response (400 Bad Request):**

```json
{
  "error": "Unknown provider_id: invalid_provider"
}
```

---

### POST /route

Smart routing — recommend the best provider based on metadata without executing the request.

**Request:**

```json
{
  "routing_metadata": {
    "context_length": 500,
    "domain": "code",
    "tier": "budget",
    "speed_quality_weight": 0,
    "requires_thinking": false,
    "requires_web_search": false
  }
}
```

**Routing Metadata Fields:**

- `context_length` (number): Estimated input token count (default: 1000)
- `domain` (string): Task domain — code, analysis, writing, math, reasoning, simple_qa, general (default: general)
- `tier` (enum): budget, standard, premium (default: standard)
- `speed_quality_weight` (number): 0 = pure speed, 100 = pure quality (default: 50)
- `requires_thinking` (boolean): Whether extended thinking is needed (default: false)
- `requires_web_search` (boolean): Whether web search is needed (default: false)

**Response (200 OK):**

```json
{
  "recommended_provider": "haiku",
  "provider_name": "Claude Haiku 4.5",
  "x402_price": "$0.001",
  "endpoint": "/request/haiku",
  "reasoning": "Selected Claude Haiku 4.5 (tier=budget, weight=0): speed 95x1.00 + quality 35x0.00 = 95.0"
}
```

**Routing Logic:**

1. **Filter by tier** — choose providers in the requested `tier`
2. **Apply capability filters** — thinking, web search, max context length
3. **Tier escalation (upward only)** — if no eligible provider, try higher tiers
4. **Weighted scoring** — `speed*(1-w) + quality*w`, where `w = speed_quality_weight / 100`
5. **Domain bonus** — add +15 when provider supports the requested domain
6. **Return top scorer** with reasoning and candidate list

---

### POST /proof/generate

Generate a Groth16 proof from collected usage records.

Uses server-side tx-binding so the proof can be independently checked against on-chain x402 payments.

**Request:**

```json
{
  "budgetLimit": 0.1
}
```

`txHashes` is not accepted from clients. The server derives tx bindings from
`UsageRecord.txHash` values patched by x402 `onAfterSettle` and zero-pads missing entries.

**Response (200 OK):**

```json
{
  "success": true,
  "proof": { "pi_a": [], "pi_b": [], "pi_c": [] },
  "publicSignals": ["...", "...", "...", "..."],
  "calldata": "[...]",
  "meta": {
    "requestCount": 2,
    "budgetLimit": 0.1,
    "txHashesRoot": "12345678901234567890",
    "txHashCount": 2,
    "generatedAt": "2026-02-19T12:00:00.000Z"
  }
}
```

`txHashesRoot` participates in commitment:
`Poseidon(totalCost, requestCount, txHashesRoot, salt)`

---

### GET /proof/records

Returns current in-memory usage records waiting for proof generation.

Each record can include optional `txHash` for x402 transaction binding.

---

### POST /request/:provider_id

Execute an AI request with a specific provider (requires x402 payment).

**URL Parameter:**

- `provider_id` (string): One of the provider IDs listed above

**Request:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is 2+2?"
    }
  ],
  "options": {
    "max_tokens": 4096,
    "extended_thinking": false,
    "thinking_budget": 10000
  },
  "routing_metadata": {
    "domain": "math",
    "complexity": "simple"
  }
}
```

**Request Fields:**

- `messages` (required): Array of message objects with `role` (user|assistant|system) and `content`
- `options.max_tokens` (optional, default 4096): Maximum response tokens (1–16384)
- `options.extended_thinking` (optional, default false): Enable extended thinking for supported providers
- `options.thinking_budget` (optional): Token budget for thinking (if enabled, max 100000)
- `routing_metadata` (optional): Metadata for logging/routing decisions

**Response (200 OK):**

```json
{
  "provider_id": "gemini_flash",
  "response": {
    "content": "2 + 2 equals 4.",
    "model": "gemini-3-flash-preview",
    "usage": {
      "input_tokens": 12,
      "output_tokens": 8
    }
  },
  "cost": {
    "input_cost": 0.0000012,
    "output_cost": 0.0000032,
    "actual_total": 0.0000044,
    "charged": 0.001
  }
}
```

**Cost Explanation:**

- `input_cost`: Calculated from input tokens and provider's per-1k-token rate
- `output_cost`: Calculated from output tokens and provider's per-1k-token rate
- `actual_total`: Sum of input and output cost
- `charged`: x402 price (micropayment amount verified on-chain)

**Response with Extended Thinking (200 OK):**

```json
{
  "provider_id": "claude_sonnet",
  "response": {
    "content": "The answer is 4.",
    "model": "claude-sonnet-4-5-20250929",
    "usage": {
      "input_tokens": 12,
      "output_tokens": 30
    },
    "thinking": "The user is asking for 2+2... This is basic arithmetic..."
  },
  "cost": {
    "input_cost": 0.000036,
    "output_cost": 0.00045,
    "actual_total": 0.000486,
    "charged": 0.01
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Unknown provider | provider_id not in list |
| 400 | Validation error | malformed request body |
| 429 | Rate limit exceeded | Provider rate limit hit |
| 502 | Provider authentication failed | API key invalid |
| 503 | Provider temporarily unavailable | Provider down or overloaded |
| 504 | Provider request timed out | Request took >30s (or >120s with thinking) |
| 500 | Internal server error | Unexpected error |

---

## Quick Test Examples

### List all providers

```bash
curl http://localhost:3001/providers
```

### Estimate cost for 1000 tokens

```bash
curl -X POST http://localhost:3001/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "gemini_flash",
    "token_estimate": 1000
  }'
```

### Get smart routing recommendation

```bash
curl -X POST http://localhost:3001/route \
  -H "Content-Type: application/json" \
  -d '{
    "routing_metadata": {
      "domain": "code",
      "tier": "budget",
      "speed_quality_weight": 0,
      "requires_thinking": false
    }
  }'
```

### Execute a request (no x402 in dev mode)

```bash
curl -X POST http://localhost:3001/request/gemini_flash \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Say hello"
      }
    ]
  }'
```

### Request with extended thinking

```bash
curl -X POST http://localhost:3001/request/claude_sonnet \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Solve: x^2 - 5x + 6 = 0"
      }
    ],
    "options": {
      "extended_thinking": true,
      "thinking_budget": 5000
    }
  }'
```

---

## Architecture

### Project Structure

```
server/
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript config
├── .env.example                 # Environment template
├── src/
│   ├── index.ts                 # Express app setup, route mounting, error handling
│   ├── config/
│   │   └── env.ts               # Environment validation with Zod
│   ├── providers/
│   │   ├── types.ts             # ProviderAdapter and AIRequest/AIResponse types
│   │   ├── registry.ts          # ProviderRegistry: manages all adapters
│   │   ├── anthropic.ts         # Anthropic adapter (Claude)
│   │   ├── openai.ts            # OpenAI adapter (GPT)
│   │   ├── deepseek.ts          # DeepSeek adapter (V3, R1)
│   │   └── gemini.ts            # Google Gemini adapter
│   ├── routes/
│   │   ├── providers.ts         # GET /providers
│   │   ├── estimate.ts          # POST /estimate
│   │   ├── request.ts           # POST /request/:provider_id
│   │   └── route.ts             # POST /route (routing engine)
│   ├── middleware/
│   │   ├── x402.ts              # x402 payment middleware setup
│   │   └── validation.ts        # Zod-based request validation
│   └── utils/
│       ├── pricing.ts           # Provider registry and cost calculation
│       └── logger.ts            # Structured logging with sanitization
└── dist/                        # Compiled JavaScript (created by `npm run build`)
```

### Data Flow

1. **Request → Validation** — Zod validates request schema
2. **Validation → x402 Middleware** — x402 payment verification (if enabled)
3. **x402 → Provider Selection** — Route to ProviderRegistry
4. **Registry → Provider Adapter** — Normalize and execute with specific AI SDK
5. **Adapter → AI Provider API** — Send request over HTTPS
6. **Response → Cost Calculation** — Estimate cost from token usage
7. **Cost → Client** — Return response with actual and charged cost

### Provider Adapters

Each provider adapter:

- Implements `ProviderAdapter` interface
- Converts generic `AIRequest` to provider-specific format
- Handles provider-specific parameters (thinking, web search, etc.)
- Extracts standard `AIResponse` (content, tokens, model)
- Implements `healthCheck()` for /health endpoint

### Payment Architecture

- **x402 Middleware** — Intercepts POST /request/* routes
- **Route Config** — Each provider gets its own route with x402 price
- **Exact EVM Scheme** — USDC on Base Sepolia via ExactEvmScheme
- **Facilitator** — HTTPFacilitatorClient verifies payment receipts
- **Graceful Fallback** — If x402 fails to initialize, server runs in dev mode (no verification)

---

## Configuration

### Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | development or production |
| `ANTHROPIC_API_KEY` | Yes | — | sk-ant-... format |
| `OPENAI_API_KEY` | Yes | — | sk-... format |
| `DEEPSEEK_API_KEY` | Yes | — | sk-... format |
| `GEMINI_API_KEY` | Yes | — | AIza... format |
| `RESOURCE_WALLET_ADDRESS` | Yes | — | 0x... address on Base Sepolia |
| `FACILITATOR_URL` | No | https://x402.org/facilitator | x402 facilitator endpoint |
| `NETWORK` | No | eip155:84532 | Base Sepolia network ID |

### Validation

Environment variables are validated at startup using Zod. If validation fails, the server prints clear error messages and exits:

```
❌ Environment validation failed:
  - ANTHROPIC_API_KEY: String must contain at least 1 character
  - PORT: Expected number, received string
```

---

## Development

### Scripts

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run routing unit tests
npm test
# - src/routing/select-provider.test.ts
# - src/zk/proof-generator.test.ts

# Start production server
npm start
```

### File Size Limits

Request body limit: 1 MB (configurable in `src/index.ts`)

### Request Timeouts

- Standard requests: 30 seconds
- Extended thinking requests: 120 seconds

Exceeding timeout results in 504 Gateway Timeout.

### Logging

Logs are JSON formatted with automatic sensitive field redaction:

```json
{
  "timestamp": "2026-02-11T12:00:00.000Z",
  "level": "INFO",
  "message": "Request completed",
  "meta": {
    "method": "POST",
    "path": "/request/gemini_flash",
    "status": 200,
    "duration_ms": 1250
  }
}
```

Redacted fields: content, messages, prompt, key, token, secret, password, api_key, authorization

---

## Testing

### Manual Testing with cURL

**1. Health check**

```bash
curl http://localhost:3001/health | jq
```

**2. List providers**

```bash
curl http://localhost:3001/providers | jq '.providers[0]'
```

**3. Estimate cost**

```bash
curl -X POST http://localhost:3001/estimate \
  -H "Content-Type: application/json" \
  -d '{"provider_id": "haiku", "token_estimate": 500}' | jq
```

**4. Route recommendation**

```bash
curl -X POST http://localhost:3001/route \
  -H "Content-Type: application/json" \
  -d '{
    "routing_metadata": {
      "domain": "code",
      "tier": "budget",
      "speed_quality_weight": 0
    }
  }' | jq
```

**5. Execute request**

```bash
curl -X POST http://localhost:3001/request/gemini_flash \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "List 3 programming languages"}
    ]
  }' | jq
```

### Error Scenarios

**Unknown provider:**

```bash
curl -X POST http://localhost:3001/request/unknown_provider \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "hi"}]}'
```

Response: 400 with `error: "Unknown provider: unknown_provider"`

**Missing API key:**

Remove GEMINI_API_KEY from .env and restart. Requests to gemini_flash will return 502.

**Invalid request (empty message content):**

```bash
curl -X POST http://localhost:3001/request/gemini_flash \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": ""}]}'
```

Response: 400 with validation error

---

## Security Notes

### What This Server Does NOT Do

- Never logs or stores user message content
- Never exposes API keys in logs (automatic redaction)
- Never forwards raw request content to x402 middleware
- API keys are held server-side; clients never need their own

### What This Server DOES Do

- Validates all incoming requests with Zod
- Sanitizes error messages to avoid exposing secrets
- Uses HTTPS for all external API calls
- Implements request timeouts to prevent hanging connections
- Gracefully handles provider failures without crashing

### Production Considerations

1. **HTTPS Only** — Use reverse proxy (nginx, CloudFlare) in production
2. **Rate Limiting** — Implement per-IP rate limiting at reverse proxy level
3. **Monitoring** — Parse JSON logs into centralized logging system (DataDog, ELK, etc.)
4. **Secrets Management** — Use environment management service (HashiCorp Vault, AWS Secrets Manager)
5. **x402 Payment Verification** — Ensure Node 20+ and network access to facilitator for full x402 protection
6. **API Key Rotation** — Rotate AI provider API keys regularly

---

## Troubleshooting

### x402 Payment Verification Disabled

**Message:**
```
x402 route configuration failed — payment verification disabled for affected routes
```

**Cause:** Server is running on Node <20 or cannot reach facilitator

**Fix:**
```bash
node --version  # Ensure 20+
curl https://x402.org/facilitator  # Verify network access
```

### Provider Health Check Failing

**Check individual provider status:**

```bash
curl http://localhost:3001/health | jq '.providers'
```

**Fix:**
- Verify API key in .env is correct
- Check provider API status page
- Verify network connectivity

### Request Timeout (504 Gateway Timeout)

**Cause:** Provider took too long to respond

**Fix:**
- Try a faster provider (budget tier)
- Reduce max_tokens
- Check provider API status

---

## Deployment

### Docker (example)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json .
RUN npm ci --omit=dev

COPY src src
COPY tsconfig.json .

RUN npm run build
RUN rm -rf src tsconfig.json

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t ai-gateway-server .
docker run -p 3001:3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e OPENAI_API_KEY=sk-... \
  -e DEEPSEEK_API_KEY=sk-... \
  -e GEMINI_API_KEY=AIza... \
  -e RESOURCE_WALLET_ADDRESS=0x... \
  ai-gateway-server
```

---

## License

MIT

---

## Contributing

This is an ETHDenver 2026 hackathon project. For questions or contributions, open an issue.

# ProofRoute AI Server Reference

Korean version: `server/REFERENCE_ko.md`

## Overview

The ProofRoute AI server is an Express + TypeScript gateway responsible for x402 payment validation and AI proxy execution.

Core responsibilities:

- x402-gated execution for `POST /request/:provider_id`
- adaptive recommendation via `POST /route`
- usage collection and ZK proof-input generation via `/proof/*`
- settlement tx-hash binding through `onAfterSettle`

Default chain profile is `NETWORK=eip155:84532` (Base Sepolia).

## Tech Stack

- Runtime: Node.js 20+
- Framework: Express.js
- Language: TypeScript
- Validation: Zod
- Payment: `@x402/express`, `@x402/evm`, `@x402/core`
- Providers: Anthropic, OpenAI, DeepSeek, Gemini
- ZK utilities: snarkjs + circom artifacts (proof generation path)

## Provider Catalog

The provider map is sourced from default values in `server/src/utils/pricing.ts` and optional overrides in `server/data/providers.json`.

- 8 provider IDs across `budget/standard/premium`
- includes `x402_price`, `capabilities`, and `scores(speed/quality)`
- loaded at startup via `loadProviderOverrides()`

Note:

- `/providers` `PUT` updates the in-memory catalog and persisted file, but x402 route rules are configured at startup. Restart is recommended after catalog changes to keep payment rules aligned.

## Environment Variables

From `server/.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development

# x402 Payment
RESOURCE_WALLET_ADDRESS=0xYourWalletOnBaseSepolia
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=eip155:84532

# AI Provider API Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=

# Optional: headless autonomous demo
HEADLESS_PRIVATE_KEY=
HEADLESS_PROVIDER=haiku
HEADLESS_GATEWAY_URL=http://localhost:3001
HEADLESS_MESSAGE=Explain what x402 is in one sentence.
```

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Server and provider adapter health |
| `GET` | `/providers` | Provider list, prices, capabilities |
| `PUT` | `/providers` | Replace provider map and persist |
| `POST` | `/estimate` | Token-estimate cost calculation |
| `POST` | `/route` | Metadata-based provider recommendation |
| `POST` | `/request/:provider_id` | Actual AI execution (payment path) |
| `POST` | `/proof/generate` | Build proof/calldata from usage batch |
| `GET` | `/proof/records` | Inspect current usage batch |
| `GET` | `/usage` | Inspect server usage + settlement tx hashes |

## Key Request/Response Shapes

### POST `/estimate`

Request:

```json
{
  "provider_id": "haiku",
  "token_estimate": 1000
}
```

Response:

```json
{
  "provider_id": "haiku",
  "estimated_cost_usd": 0.003,
  "breakdown": {
    "input_cost": 0.001,
    "output_cost": 0.002,
    "total": 0.003
  },
  "tier": "budget",
  "x402_price": "$0.001"
}
```

### POST `/route`

Request:

```json
{
  "routing_metadata": {
    "context_length": 800,
    "domain": "code",
    "tier": "budget",
    "speed_quality_weight": 20,
    "requires_thinking": false,
    "requires_web_search": false
  }
}
```

Response:

```json
{
  "recommended_provider": "haiku",
  "provider_name": "Claude Haiku 4.5",
  "x402_price": "$0.001",
  "endpoint": "/request/haiku",
  "reasoning": "Selected ...",
  "candidates": []
}
```

### POST `/request/:provider_id`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "masked prompt" }
  ],
  "options": {
    "max_tokens": 512,
    "extended_thinking": false,
    "requires_web_search": false
  }
}
```

Response:

```json
{
  "provider_id": "haiku",
  "response": {
    "content": "answer",
    "model": "claude-haiku-4-5-20251001",
    "usage": {
      "input_tokens": 120,
      "output_tokens": 220
    }
  },
  "cost": {
    "input_cost": 0.00012,
    "output_cost": 0.0011,
    "actual_total": 0.00122,
    "charged": 0.001
  },
  "limits": {
    "tier": "budget",
    "max_output_tokens": 512,
    "requested_max_tokens": 512,
    "applied_max_tokens": 512
  }
}
```

### POST `/proof/generate`

Request:

```json
{
  "budgetLimit": 0.1
}
```

Behavior:

- reads server-side usage batch (max 32)
- does not accept client-supplied `txHashes`
- computes `txHashesRoot` from settlement tx hashes captured by `onAfterSettle`

## Routing Logic (`select-provider`)

From `server/src/routing/select-provider.ts`:

1. tier filter
2. capability filter (thinking/web_search/context)
3. upward tier escalation when no match
4. score: `speed*(1-w) + quality*w`, where `w=speed_quality_weight/100`
5. domain bonus `+15`
6. return highest-scoring provider

If still no candidates, `claude_sonnet` is returned as fallback.

## x402 Settlement and txHash Binding

`server/src/middleware/x402.ts`:

- registers payment rules for `POST /request/{providerId}`
- captures settlement transaction hash in `x402ResourceServer.onAfterSettle`
- patches the latest usage record via `usageCollector.patchLastTxHash(txHash)`

Note:

- if x402 initialization fails, the server can continue in a warning/dev mode without active payment verification.

## ZK Usage Path

Relevant files:

- `src/zk/usage-collector.ts`
- `src/zk/proof-generator.ts`
- `src/routes/proof.ts`
- `src/routes/usage.ts`

Summary:

- usage records persist in `server/data/usage-records.json`
- batch size is 32 (aligned with circuit constraints)
- after successful proof generation, processed batch entries are dequeued

## Headless Autonomous Demo

Run autonomous payment flow without manual wallet clicks:

```bash
cd server
tsx scripts/headless-demo.ts
```

Required:

- `HEADLESS_PRIVATE_KEY` in `server/.env` with a wallet funded for Base Sepolia USDC settlement.

## Directory Layout

```text
server/
  src/
    config/
    middleware/
    providers/
    routes/
    routing/
    utils/
    zk/
  data/
  scripts/
```

## Dev Commands

```bash
# dev server
npm run dev

# type build
npm run build

# tests
npm test
```

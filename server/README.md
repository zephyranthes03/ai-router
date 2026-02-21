# AI Router Server

Express + TypeScript gateway for:

- x402 payment-gated AI requests
- adaptive provider routing
- usage collection for ZK proofs
- settlement tx-hash binding (`onAfterSettle`)

Current default settlement network is `eip155:84532` (Base Sepolia).

## What This Service Owns

- `POST /request/:provider_id`: paid AI execution (x402 middleware)
- `POST /route`: provider recommendation based on routing metadata
- `GET /providers`, `PUT /providers`: provider catalog read/update
- `POST /proof/generate`, `GET /proof/records`: ZK proof input/output
- `GET /usage`: server-side usage + settlement tx hash view

Raw prompt privacy is handled on the client side before requests arrive here.

## Prerequisites

- Node.js 20+
- npm 10+

## First-Time Setup

Run once:

```bash
cp .env.example .env
```

Then fill `server/.env`:

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

# Optional: headless payment demo
HEADLESS_PRIVATE_KEY=
HEADLESS_PROVIDER=haiku
HEADLESS_GATEWAY_URL=http://localhost:3001
HEADLESS_MESSAGE=Explain what x402 is in one sentence.
```

## Run

```bash
npm install
npm run dev
```

Server starts at `http://localhost:3001`.

## Quick Checks

```bash
curl http://localhost:3001/health
curl http://localhost:3001/providers
```

If some provider keys are missing, health response may include `demo_mode`.

## API Summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Gateway and provider status |
| `GET` | `/providers` | List providers, prices, capabilities |
| `PUT` | `/providers` | Replace provider map and persist to `server/data/providers.json` |
| `POST` | `/estimate` | Token-based cost estimate (no execution) |
| `POST` | `/route` | Adaptive provider recommendation |
| `POST` | `/request/:provider_id` | x402-paid model request |
| `POST` | `/proof/generate` | Build Groth16 proof payload from server usage batch |
| `GET` | `/proof/records` | Inspect usage batch before proof generation |
| `GET` | `/usage` | Server-side usage records with tx hash bindings |

## Minimal Request Examples

Route recommendation:

```bash
curl -X POST http://localhost:3001/route \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_metadata": {
      "tier": "budget",
      "speed_quality_weight": 20,
      "domain": "code",
      "requires_thinking": false,
      "requires_web_search": false,
      "context_length": 300
    }
  }'
```

Paid request endpoint shape:

```bash
curl -X POST http://localhost:3001/request/haiku \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role":"user","content":"hello"}],
    "options": {"max_tokens": 256}
  }'
```

Note: in normal mode, this endpoint is payment-gated by x402 and returns `402` first.

## x402 and ZK Binding Flow

1. Client hits `/request/:provider_id`.
2. x402 middleware validates payment and settlement.
3. Request handler records usage stats.
4. `onAfterSettle` patches the latest usage record with settlement `txHash`.
5. `/proof/generate` derives `txHashesRoot` from server-side records and returns proof/calldata.

Key implementation:

- `src/middleware/x402.ts`
- `src/routes/request.ts`
- `src/zk/usage-collector.ts`
- `src/routes/proof.ts`

## Headless Autonomous Demo

For no-click autonomous payment execution:

```bash
tsx scripts/headless-demo.ts
```

This script signs EIP-712 payment authorization from Node.js and completes an x402-paid request without browser wallet interaction.

## Tests and Build

```bash
npm test
npm run build
```

Current test command runs `tsx --test src/**/*.test.ts`.

## Notes for Track Alignment

- Current live/demo chain profile is Base Sepolia (`eip155:84532`).
- To target additional networks (for example Kite testnet/mainnet), switch `NETWORK`, settlement wallet, and facilitator profile in env/config, then re-run the same flow.

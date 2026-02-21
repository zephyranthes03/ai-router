# AI Router Client

This is the client layer of AI Router, composed of a local FastAPI service and a React/Vite web UI.

Core responsibilities:

- On-device PII detection and masking (Regex + Presidio)
- Adaptive routing metadata generation
- Optional 0G inference signal injection
- x402 paid request execution via wallet integration
- Billing and ZK proof submission UX

## Components

### 1) Python Local API (`client/app`, port `8000`)

- `POST /analyze`: PII + routing analysis
- `GET/PUT /settings`: user settings management
- `POST /usage/log`, `GET /usage/history`: local usage history
- `GET/POST/DELETE /wallet/keystore`: embedded wallet keystore lifecycle

### 2) Frontend (`client/frontend`, port `5173`)

- Chat and provider-routing UI
- x402 request execution (`x402-fetch`)
- Billing view (local + server usage aggregation)
- ZK proof generation and on-chain submission
- ERC-8021 builder-code suffix injection for `submitAndVerify`

## Prerequisites

- Python 3.9+
- Node.js 20+
- npm 10+
- Optional: Ollama for local model-assisted analysis
- Recommended: Base Sepolia test assets for x402 demos

## First-Time Setup

### Python dependencies

```bash
cd client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend dependencies and env

```bash
cd client/frontend
npm install
cp .env.example .env.local
```

Main `client/frontend/.env.local` keys:

```env
VITE_GATEWAY_SERVER_URL=http://localhost:3001
VITE_LOCAL_API_URL=http://localhost:8000
VITE_PROOF_REGISTRY_ADDRESS=0x...
VITE_BUILDER_CODE=ai-router
```

## Run (3 terminals)

Terminal 1 (gateway):

```bash
cd server
npm install
npm run dev
```

Terminal 2 (frontend):

```bash
cd client/frontend
npm run dev
```

Terminal 3 (local API):

```bash
cd client
source venv/bin/activate
DEV=1 python main.py
```

## Current Analysis Pipeline

1. Regex PII scan
2. Presidio contextual scan
3. Detection merge + masking (`pii_mode`)
4. Optional 0G classification (if enabled)
5. Server `/route` call for provider recommendation
6. Fallback router when server route is unavailable

Key files:

- `app/orchestrator.py`
- `app/pii/regex_layer.py`
- `app/pii/presidio_layer.py`
- `app/llm/zero_g.py`

## Settings

Main settings exposed via `/settings`:

- `tier`: `budget | standard | premium`
- `speed_quality_weight`: `0..100`
- `pii_mode`: `none | permissive | strict | user_select`
- `extended_thinking`, `web_search`
- `use_0g_inference`
- `zero_g_api_key`, `zero_g_model`, `zero_g_base_url`

0G inference is off by default and is used only when enabled with a valid API key.

## Wallet and Payment Notes

- Browser mode: injected wallet (wagmi) is supported
- Desktop/local mode: encrypted embedded-wallet keystore is supported
- Paid requests are validated by the gateway x402 middleware

Related files:

- `frontend/src/lib/x402Client.ts`
- `frontend/src/contexts/EmbeddedWalletContext.tsx`
- `frontend/src/lib/embeddedWallet.ts`

## ZK and On-Chain Notes

- Proof generation uses gateway endpoint `/proof/generate`
- Frontend submission appends ERC-8021 suffix to `submitAndVerify` calldata
- Server usage (`GET /usage`) tx hashes are consumed by billing and proof evidence views

Related files:

- `frontend/src/lib/zkProof.ts`
- `frontend/src/lib/builderCode.ts`
- `frontend/src/hooks/useServerUsage.ts`

## Tests

Python unit tests:

```bash
cd client
python3 -m unittest discover -s tests -p "test_*.py"
```

Frontend build validation:

```bash
cd client/frontend
npm run build
```

## Notes

- Current chain profile is Base Sepolia.
- `client/.env` is not the primary runtime config path; practical config is managed mainly through `/settings` and `client/frontend/.env.local`.

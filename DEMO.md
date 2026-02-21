# ProofRoute AI — Demo Walkthrough

**Total time: ~5 minutes**

> **Prerequisites**: Server (`cd server && npm run dev`), Frontend (`cd client/frontend && npm run dev`), Python backend (`cd client && python main.py`), MetaMask on Base Sepolia with USDC, and `client/frontend/.env.local` with `VITE_PROOF_REGISTRY_ADDRESS` set (or run `cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia` once).

---

## Step 0: Headless Autonomous Payment — No Clicks Required (60s)

> **Demonstrates:** Fully autonomous x402 USDC payment with no browser, no MetaMask prompt, no manual interaction. This satisfies the "no manual wallet clicking" requirement.

### Setup

Add to `server/.env`:

```bash
HEADLESS_PRIVATE_KEY=0xYourPrivateKeyWithUsdcOnBaseSepolia
HEADLESS_PROVIDER=haiku
HEADLESS_GATEWAY_URL=http://localhost:3001
HEADLESS_MESSAGE=Focusing on pay-as-you-go USDC AI API payments with verifiable settlement.

```

### Run

> **Important:** The server must be running first (`cd server && npm run dev` in a separate terminal).

```bash
cd server && npx tsx scripts/headless-demo.ts
```

### Sample Output (verified run)

```
=== Headless Autonomous x402 Demo ===
Wallet:   0x46d98FE8d6dBD1A1128dCb1466E3eed0F79a8467
Provider: haiku ($0.001 USDC per request)
Gateway:  http://localhost:3001

[1/3] Sending request to gateway...
      --> 402 received (payment required)
      Asset:   0x036CbD53842c5426634e7929541eC2318f3dCF7e
      Amount:  1000 atomic units
      PayTo:   0x46d98FE8d6dBD1A1128dCb1466E3eed0F79a8467
      Network: eip155:84532
      Scheme:  exact

[2/3] Signing payment authorization (no browser, no clicks)...
      Signature: 0x3142ac7b6a6ec4eb6f...0f27c41c

[3/3] Retrying with PAYMENT-SIGNATURE header...

SUCCESS
--------
Response: x402 is a payment protocol that enables AI API providers to charge users per
          request in USDC with cryptographic proof of settlement, eliminating trust
          requirements and enabling truly pay-as-you-go monetization.
Tokens:   42 in / 48 out
Cost:     $0.000282 actual / $0.0010 charged via x402

x402 Settlement:
  TX Hash:  0x3dfec550f74b47f8954ea32a1fee9a656c37bb9d94e9bce1658fb7659f244964
  Explorer: https://sepolia.basescan.org/tx/0x3dfec550f74b47f8954ea32a1fee9a656c37bb9d94e9bce1658fb7659f244964

Flow summary:
  1. POST /request/haiku        -> 402 (payment required)
  2. signTypedData(EIP-712)     -> signature (off-chain, no gas)
  3. POST + PAYMENT-SIGNATURE   -> 200 (facilitator settles on-chain)
  No browser. No wallet extension. No manual clicks. Fully autonomous.
```

> TX Hash verified on Base Sepolia: [0x3dfec5...44964](https://sepolia.basescan.org/tx/0x3dfec550f74b47f8954ea32a1fee9a656c37bb9d94e9bce1658fb7659f244964)

**What this proves:**
- Private key loaded from env → no password, no browser unlock
- `signTypedData()` (EIP-3009) runs server-side with viem
- Facilitator settles on-chain → tx appears in Base Sepolia USDC Token Transfers
- The full loop (request → payment → AI response) runs without any user interaction

---

## Step 1: PII Masking — Multi-signal Detection (60s)

Set PII Mode to **User Select**. Type in the chat:

> `Hi, I'm alice@company.io. I'm trying to claim my airdrop but my wallet 0x742d35Cc6634C0532925a3b8D4C9D0e27541e37b isn't showing the tokens yet. Is there a processing delay? You can also reach me at +1-415-555-0198 if needed.`

**PII Review dialog shows:**

| Detected | Type | Severity | Mode |
|---|---|---|---|
| `alice@company.io` | `EMAIL` | high | masked in strict |
| `0x742d35Cc...` | `ETH_ADDRESS` | high | masked in strict |
| `+1-415-555-0198` | `PHONE_NUMBER` | medium | masked in strict |

**Three send options:**
- **Permissive** → real email + wallet + phone pass through to the AI
- **Strict** → all three replaced with placeholders — AI never sees real values
- **Original** → no masking at all

Choose **Strict** — the AI gets `[EMAIL_ADDRESS]`, `[ETH_ADDRESS]`, `[PHONE_NUMBER]` and still answers the airdrop question helpfully.

**When the AI responds**, any `[ETH_ADDRESS]` in the reply is automatically swapped back to `0x742d35Cc...` before display — so the response reads naturally without the user manually reversing placeholders.

> **What this shows:** Three pieces of identifying info — email, on-chain identity, phone — never left the device unmasked, yet the AI gave a perfectly useful answer. In a real support chat these would be logged by the provider.

---

## Step 2: Vibe Coding — Credentials in Code (45s)

Set PII Mode to **User Select**. Paste this in the chat:

```
Can you fix the N+1 query in this code?

import anthropic, psycopg2

client = anthropic.Anthropic(api_key="sk-ant-api03-xKj9mQpLzRtNvWBY2cDaEfHsUeI0oM8n")

def get_orders(user_ids):
    conn = psycopg2.connect(
        host="prod-db.internal", user="admin",
        password="Sup3rS3cret!", database="orders"
    )
    results = []
    for uid in user_ids:          # N+1 here
        results.append(conn.execute(f"SELECT * FROM orders WHERE uid={uid}"))
    return results
```

**PII Review dialog catches:**

| Detected | Type | Severity |
|---|---|---|
| `sk-ant-api03-xKj9mQ...` | `API_KEY` | critical |
| `Sup3rS3cret!` | `PASSWORD` | critical |

**"Send Original" is disabled.** Choosing **Strict** sends:

```
Can you fix the N+1 query in this code?

import anthropic, psycopg2

client = anthropic.Anthropic(api_key="[API_KEY]")

def get_orders(user_ids):
    conn = psycopg2.connect(
        host="prod-db.internal", user="admin",
        password="[PASSWORD]", database="orders"
    )
    ...
```

The AI can still understand and fix the N+1 bug — it never sees the real API key or password.

> **Why this matters:** In everyday vibe-coding workflows, developers routinely paste working code snippets that contain real credentials. PII filtering acts as a last-line-of-defense without interrupting the workflow.

---

## Step 3: Smart Routing (20s)

Send:

> `What is Apple's stock price right now?`

**Routing result shows:**
- Keyword `right now` → `requires_web_search: true`
- Gemini provider selected (Google Search grounding enabled)

Switch tier to **Budget** — provider changes to a cheaper model automatically.

---

## Step 4: 0G Compute Inference — AI-Powered Routing (30s)

Open **Dashboard → Settings** and enable **0G Compute Inference**. Enter your 0G API key.

Send any message, e.g.:

> `Explain the difference between Proof of Work and Proof of Stake consensus mechanisms.`

**With 0G off** — routing is decided by local keyword matching:
- "explain" → domain: `reasoning`, tier: standard

**With 0G on** — routing is decided by a 0G-hosted LLM:
- 0G classifies: `{ "domain": "reasoning", "complexity": "complex", "requires_thinking": true, "confidence": 0.95 }`
- `requires_thinking: true` → premium provider selected (e.g. Claude Opus)

**What the demo shows:**
- The routing panel displays `source: "0g_inference"` vs `"keyword"`
- The same message selects a different provider tier depending on 0G on/off
- All inference runs on **0G Compute Network** — decentralized, verifiable compute

---

## Step 5: ZK Proof — Privacy-Preserving Audit (90s)

1. **ZK Verification** panel → set Budget Limit (e.g. `0.05` USDC) → **Generate Proof**
2. **Submit On-Chain** → confirm MetaMask → wait ~3s
3. Click the **Basescan link** → find `ProofVerified` event in logs

**What the proof guarantees:**
- User stayed within the declared budget
- Every usage record is cryptographically bound to a real USDC settlement tx
- The AI query content is never revealed on-chain

> **Note:** x402 USDC micro-payment happens automatically on every message (embedded wallet signs EIP-3009 in browser, or run `npx tsx scripts/headless-demo.ts` for fully autonomous no-click mode). USDC transfers appear in Base Sepolia's [USDC Token Transfers tab](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e), not the main Transactions tab (which shows ETH amounts only).

---

## Architecture

```
User input
  → Regex + Presidio PII scan (~10ms, local)
  → PII Review dialog (none / permissive / strict / user-select)
  → Keyword routing (domain + web_search flag)
  → 0G Compute inference (optional: AI-enhanced domain + complexity classification)
  → Gateway: POST /route → optimal provider selected
  → x402 USDC micro-payment on Base Sepolia
  → AI provider receives masked text only
  → Response: placeholders swapped back to originals before display
  → Usage recorded with bound tx hash
  → ZK proof: Poseidon commitment + Groth16
  → ProofRegistry on Base Sepolia → public verifiability
```

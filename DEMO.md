# AI Router — Demo Walkthrough

**Total time: ~4 minutes**

> **Prerequisites**: Server (`cd server && npm run dev`), Client (`cd client && python main.py`), MetaMask on Base Sepolia with USDC.

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

## Step 4: ZK Proof — Privacy-Preserving Audit (90s)

1. **ZK Verification** panel → set Budget Limit (e.g. `0.05` USDC) → **Generate Proof**
2. **Submit On-Chain** → confirm MetaMask → wait ~3s
3. Click the **Basescan link** → find `ProofVerified` event in logs

**What the proof guarantees:**
- User stayed within the declared budget
- Every usage record is cryptographically bound to a real USDC settlement tx
- The AI query content is never revealed on-chain

> **Note:** x402 USDC micro-payment (MetaMask prompt) happens automatically on every message sent in Steps 1–3.

---

## Architecture

```
User input
  → Regex + Presidio PII scan (~10ms, local)
  → PII Review dialog (none / permissive / strict / user-select)
  → Keyword routing (domain + web_search flag)
  → Gateway: POST /route → optimal provider selected
  → x402 USDC micro-payment on Base Sepolia
  → AI provider receives masked text only
  → Response: placeholders swapped back to originals before display
  → Usage recorded with bound tx hash
  → ZK proof: Poseidon commitment + Groth16
  → ProofRegistry on Base Sepolia → public verifiability
```

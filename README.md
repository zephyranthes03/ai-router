# AI Router | ETHDenver 2026 Submission

**Privacy-first AI access with Edge AI + x402 micropayments + ZK accountability**

> "Everyone deserves private access to AI."

Korean version: `README_ko.md`

AI Router is a desktop AI gateway that protects sensitive prompts on-device, pays for usage through USDC micropayments (x402), and proves accountable usage with ZK proofs verified on-chain.

---

## 60-Second Pitch (For Judges)

1. **Problem**: Sensitive AI questions are high-value but high-risk in cloud-only workflows.
2. **Solution**: AI Router keeps raw input local, sends only masked/minimal metadata, and routes to the best AI provider.
3. **Accountability**: Usage is paid via x402 and proven via Groth16 proofs on Base Sepolia.
4. **Outcome**: Private AI usage with public verifiability and no raw data disclosure.

---

## Live on Base Sepolia

| Contract | Address | Explorer |
|---|---|---|
| Groth16Verifier | `0x_VERIFIER_ADDRESS` | [Basescan](https://sepolia.basescan.org/address/0x_VERIFIER_ADDRESS) |
| ProofRegistry | `0x_REGISTRY_ADDRESS` | [Basescan](https://sepolia.basescan.org/address/0x_REGISTRY_ADDRESS) |

> After deploying, run `cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia` to populate real addresses above. The script saves `deployed-addresses.json`, auto-verifies on Basescan, and updates `client/frontend/.env.local` with `VITE_PROOF_REGISTRY_ADDRESS`.

---

## 1) What We Built

- **Edge AI privacy layer**: Local LLM + rule-based PII detection/masking
- **Multi-provider AI routing**: Anthropic / OpenAI / DeepSeek / Gemini
- **x402 micropayments**: Request-level USDC payments on Base Sepolia
- **ZK accountability**: Groth16 proofs bind usage stats + x402 tx hash root, then verify on-chain
- **Billing observability**: Request/token/cost tracking with dashboard visibility

---

## 2) Why It Matters

People often need AI most for medical, legal, and financial questions, where privacy risk is the highest.

AI Router's design principle:
- Keep content private
- Prove responsible usage
- Keep payment and verification transparent

This is our approach to "transparency without surveillance".

---

## 3) System Architecture

```text
[User]
  -> [Edge AI: local PII detection/masking]
  -> [Gateway: routing + x402 verification + provider call]
  -> [Usage collector + ZK proof generator]
  -> [ProofRegistry on Base Sepolia]
```

### 3-layer privacy model

1. **Local (private)**: Raw prompt and PII processing
2. **Gateway (minimal exposure)**: Masked text + routing metadata
3. **On-chain (verifiable)**: Proof results only, no raw usage details

---

## 4) Hackathon Demo Flow (Judge-friendly)

> **[3-Minute Demo Guide → DEMO.md](DEMO.md)** — step-by-step walkthrough with exact commands and expected outputs.

1. User submits a prompt containing sensitive data
2. Local pipeline detects and masks PII
3. Only masked request goes to the gateway
4. x402 USDC payment is verified and AI response is returned
5. Usage batch is converted into a ZK proof
6. Proof is submitted to `ProofRegistry` on Base Sepolia
7. On-chain `verifyProof` succeeds

---

## 5) Repository Layout

- `server/`: Express + TypeScript gateway (x402 verification + provider proxy)
- `client/`: Python orchestrator + desktop app runtime
- `client/frontend/`: React UI (chat, billing, wallet, proof submit)
- `circuits/`: circom circuits + snarkjs setup
- `contracts/`: Hardhat + `Groth16Verifier.sol` + `ProofRegistry.sol`

Detailed component/API docs:
- `server/README.md`
- `client/README.md`

---

## 6) Quick Start

### Prerequisites

- Node.js 20+ (**Node 22 recommended for Hardhat workflows**)
- Python 3.9+
- npm 10+
- Ollama (for local classification/PII demo pipeline)
- MetaMask (Base Sepolia)
- (Optional) Docker (for circom compile alternative)

### Run local app (3 terminals)

```bash
# Terminal 1: gateway
cd server
npm install
cp .env.example .env
npm run dev
```

```bash
# Terminal 2: frontend
cd client/frontend
npm install
cp .env.example .env.local
npm run dev
```

```bash
# Terminal 3: python backend + desktop
cd client
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
DEV=1 python main.py
```

---

## 7) ZK Setup & On-chain Test

### Step A: Build circuits artifacts

Choose one option for `circom` compilation.

#### Option A) Local `circom` binary (fast iteration)

```bash
cargo install --git https://github.com/iden3/circom.git --tag v2.1.8 --locked
```

```bash
cd circuits
npm install
npm run compile
npm run setup
npm run generate-verifier
```

#### Option B) Docker for `circom` compile (no local binary)

```bash
docker pull ghcr.io/iden3/circom:2.1.8
```

```bash
cd circuits
npm install

docker run --rm \
  -v "$PWD:/work" \
  -w /work \
  ghcr.io/iden3/circom:2.1.8 \
  circom circuits/usage_budget.circom --r1cs --wasm --sym -o build

npm run setup
npm run generate-verifier
```

> Docker replaces only the `circom` compile step. `setup` and `generate-verifier` still run via `snarkjs` in Node.

### Tx-binding model (x402 -> ZK)

- Commitment upgraded from `Poseidon(totalCost, requestCount, salt)` to:
  `Poseidon(totalCost, requestCount, txHashesRoot, salt)`
- `txHashesRoot` is computed as a Poseidon hash chain over up to 32 tx hashes:
  `chain[0]=txHashes[0]`, `chain[i]=Poseidon(chain[i-1], txHashes[i])`
- Public signals are now 4 values:
  `[budgetLimit, requestCount, commitmentHash, txHashesRoot]`
- `ProofRegistry` stores `txHashesRoot`, so third parties can recompute from on-chain transfers and compare.

### Step B: Run automated tests

```bash
# Routing/control logic tests
cd server
npm install
npm test

# Smart contract + on-chain verifier integration tests
cd contracts
npm install
npm test
```

- Routing tests: `server/src/routing/select-provider.test.ts`
- ZK input/tx-binding tests: `server/src/zk/proof-generator.test.ts`
- Contract tests: `contracts/test/ProofRegistry.test.ts`
- Contract fixture input: `contracts/test/fixtures/usageBudgetProofInput.ts`
- Contract tests generate **real Groth16 proofs** via `snarkjs.groth16.fullProve` (no dummy proof path)

---

## 8) Validation Scope (Current)

| Layer | Validation |
|---|---|
| `contracts` | Hardhat unit tests (`npm test`) |
| `circuits` | compile/setup/verifier generation |
| `server` | route-selection + ZK input-builder unit tests (`npm test`) + TypeScript build (`npm run build`) |
| `client/frontend` | production build (`npm run build`) |

`client/frontend` and `client` (Python) currently use build/runtime validation rather than dedicated unit-test suites.

### Routing control scenarios (`tier` + `speed_quality_weight`)

| Scenario | Inputs | Expected winner |
|---|---|---|
| Cost-sensitive + speed | `tier=budget`, `speed_quality_weight=0` | `haiku` |
| Cost-sensitive + quality | `tier=budget`, `speed_quality_weight=100` | `gemini_flash` |
| Balanced-cost + speed | `tier=standard`, `speed_quality_weight=0` | `gpt5` |
| Balanced-cost + quality | `tier=standard`, `speed_quality_weight=100` | `gemini_pro` |
| Capability escalation | `tier=budget`, `requires_thinking=true` | Escalates to standard tier (`claude_sonnet`) |
| Domain bonus effect | `tier=budget`, `speed_quality_weight=0`, `domain=code` | Domain bonus flips winner to `gemini_flash` |
| Hard fallback | `tier=premium`, `requires_web_search=true` | Fallback `claude_sonnet` |

Cost control in the UI is represented by `tier` selection:
- more cost-sensitive mode -> `budget`
- less cost-sensitive / quality-first mode -> `standard` or `premium`

### ZK tx-binding scenarios

| Scenario | What is verified |
|---|---|
| Server-side tx capture | x402 `onAfterSettle` hook patches each `UsageRecord.txHash` automatically |
| `/proof/generate` | `txHashesRoot` is derived from server-collected tx hashes; zero-pads missing entries |
| Commitment integrity | commitment is computed as `Poseidon(totalCost, requestCount, txHashesRoot, salt)` |
| On-chain persistence | `ProofRegistry` stores `txHashesRoot` and emits it in `ProofVerified` |
| Groth16 compatibility | real proof generation/verification still passes with `pubSignals[4]` |

---

## 9) Track/Theme Fit

- **Privacy-preserving AI**: Raw prompt protection + minimal data transfer
- **On-chain accountability**: Verifiable usage without revealing content
- **Practical UX**: End-to-end flow from routing/payment to dashboard and proof submission

Track-specific submission stories:
- [**x402 Payment Track** → `docs/BOUNTY-x402.md`](docs/BOUNTY-x402.md)
- [**ZK / Privacy Track** → `docs/BOUNTY-ZK-Privacy.md`](docs/BOUNTY-ZK-Privacy.md)

---

## 10) Status

- x402 payment + routing pipeline operational
- ZK circuit/proof generation pipeline operational
- `ProofRegistry` on-chain verification tests passing
- `tier + speed_quality_weight` routing scenario tests passing
- Frontend flow integrated for proof generation/submission

---

## 11) Roadmap: Local AI-Enhanced Routing

The local LLM (currently used for PII masking) can further optimize cloud routing:

- **Local-first triage**: Classify intent/complexity locally → select the right cloud model tier automatically
- **Context budget controller**: Compose optimal prompt within a token budget before sending to cloud
- **Evidence packer**: Extract relevant snippets locally → reduce hallucination in cloud responses
- **Multi-step compression**: Consolidate multi-turn cloud calls into a single optimized request

---

## Contact

ETHDenver 2026 Hackathon submission project.

For detailed implementation docs:
- `README_ko.md` (Korean version)
- `server/README.md`
- `client/README.md`

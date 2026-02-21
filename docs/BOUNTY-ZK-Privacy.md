# AI Router — ZK / Privacy Track Submission

## Problem

When users send sensitive queries to cloud AI (medical, legal, financial), they face a fundamental tension:

- **Privacy risk**: Raw prompts containing PII are sent to third-party servers
- **Accountability gap**: No way to prove responsible usage without exposing the data
- **Trust assumption**: Users must trust that providers handle data responsibly

## Solution

**AI Router** implements a **3-layer privacy model** that keeps content private while proving accountable usage on-chain — using zero-knowledge proofs.

## 3-Layer Privacy Architecture

### Layer 1: Local (Private)

- Edge AI runs on-device for PII detection and masking
- Raw prompts never leave the user's machine
- Rule-based + local LLM classification identifies sensitive content
- Only masked/anonymized text is forwarded to the gateway

### Layer 2: Gateway (Minimal Exposure)

- Receives only masked text + routing metadata
- Routes to the optimal AI provider based on tier and quality preferences
- Records usage statistics (cost, tokens) without storing prompt content
- x402 micropayments settle on Base Sepolia

### Layer 3: On-Chain (Verifiable)

- ZK proof commits to usage aggregates without revealing details
- Groth16 proof verifies: "total cost ≤ budget" and "request count matches"
- No raw data, no prompt content, no individual request details on-chain
- Only cryptographic commitments and verified boolean results

## ZK Proof System

### Circuit Design (`usage_budget.circom`)

```
Private inputs:
  - costs[32]        (per-request costs)
  - txHashes[32]     (x402 settlement tx hashes)
  - salt             (randomness for commitment)

Public inputs:
  - budgetLimit      (maximum allowed spend)
  - requestCount     (number of requests)
  - commitmentHash   (Poseidon commitment)
  - txHashesRoot     (hash chain of tx hashes)

Constraints:
  1. sum(costs) ≤ budgetLimit
  2. commitmentHash == Poseidon(totalCost, requestCount, txHashesRoot, salt)
  3. txHashesRoot == hashChain(txHashes)
```

### What the proof reveals

| Information | Revealed? |
|---|---|
| Total cost within budget | Yes (public) |
| Number of requests | Yes (public) |
| Payment tx binding | Yes (txHashesRoot) |
| Individual request costs | **No** |
| Prompt content | **No** |
| Which providers were used | **No** |
| Token counts per request | **No** |
| Timestamps | **No** |

### Poseidon Hash Chain (tx binding)

```
chain[0] = txHash[0]
chain[i] = Poseidon(chain[i-1], txHash[i])
txHashesRoot = chain[31]
```

The hash chain binds the proof to actual on-chain payments without revealing individual transaction details in the proof itself.

## On-Chain Verification

### Smart Contracts

- **Groth16Verifier.sol**: Auto-generated verifier from trusted setup
- **ProofRegistry.sol**: Stores verified proof records with `commitmentHash` and `txHashesRoot`

### Verification Flow

```
User generates proof locally
  → Submits to ProofRegistry.submitAndVerify()
  → Groth16Verifier.verifyProof() runs on-chain
  → ProofRecord stored: { commitmentHash, txHashesRoot, budgetLimit, timestamp }
  → ProofVerified event emitted
```

### Third-Party Audit

Anyone can verify the proof's integrity:

1. Read `ProofRecord` from the registry
2. Query USDC Transfer events for the user's wallet
3. Recompute the Poseidon hash chain from settlement tx hashes
4. Compare against stored `txHashesRoot`
5. Confirm the Groth16 proof was verified on-chain

## Innovation

### Privacy-Preserving AI Accountability

Traditional approaches to AI accountability require logging and auditing — which conflicts with privacy. AI Router's ZK approach provides:

- **Compliance without surveillance**: Prove budget adherence without revealing what was asked
- **Cryptographic binding**: Usage proof is tied to real payments, not self-reported data
- **On-chain permanence**: Proofs are immutable and publicly verifiable
- **Zero content disclosure**: The on-chain footprint reveals nothing about prompt content

### Server-Side Trust Minimization

- x402 settlement tx hashes are captured server-side (not client-provided)
- The ZK proof's private inputs (costs, tx hashes) never appear on-chain
- Only the commitment and hash chain root are public

## Technical Stack

| Component | Technology |
|---|---|
| ZK circuit | circom 2.1.8 |
| Proof system | Groth16 (snarkjs) |
| Hash function | Poseidon (circomlibjs) |
| On-chain verifier | Groth16Verifier.sol (auto-generated) |
| Proof registry | ProofRegistry.sol (Hardhat) |
| Edge AI | Local LLM (Ollama) + rule-based PII detection |
| Payment | x402 USDC micropayments |
| Chain | Base Sepolia |

## Demo Focus

1. **Sensitive prompt** → observe PII masking locally (content never leaves device)
2. **AI response** → response returned without raw data exposure
3. **Generate proof** → ZK proof created from usage data (private inputs hidden)
4. **Submit on-chain** → `ProofVerified` event on Basescan (no content visible)
5. **Audit** → compare `txHashesRoot` with USDC transfers (independent verification)

## Key Differentiators

- **Not just encryption** — ZK proofs provide verifiability, not just confidentiality
- **Not just anonymization** — mathematical guarantee that private inputs cannot be extracted
- **Practical UX** — end-to-end flow from chat to on-chain proof in a desktop app
- **Payment binding** — privacy proofs are anchored to real economic activity

## Links

- [3-Minute Demo Guide](../DEMO.md)
- [Main README](../README.md)
- [x402 Payment Track Submission](BOUNTY-x402.md)

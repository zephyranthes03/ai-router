# AI Router — Kite AI Submission: Agent-Native Payments & Identity (x402-Powered)

## Problem

AI API billing today is opaque: monthly subscriptions or prepaid credits with no per-request cost transparency. Users cannot independently verify what they paid for, and providers can overcharge without accountability.

## Solution

**AI Router** uses the **x402 protocol** to enable **per-request USDC micropayments** for AI inference. Every API call has a transparent, verifiable price — and every payment is cryptographically bound to a ZK proof of usage.

## Requirements Mapping (as of 2026-02-21)

| Kite AI requirement | Status | Evidence / Notes |
|---|---|---|
| Build on Kite AI Testnet/mainnet | In progress | Current live flow is on Base Sepolia. Network profile migration to Kite testnet/mainnet is tracked as the next deployment step. |
| Use x402-style payment flows | Implemented | `server/src/middleware/x402.ts`, `client/frontend/src/lib/x402Client.ts` |
| Implement verifiable agent identity (wallet or credentials) | Implemented (wallet-based) | Wallet-signed payment authorization + settlement tx hash binding in proof data |
| Demonstrate autonomous execution (no manual wallet clicking) | Implemented (headless path) | `server/scripts/headless-demo.ts` |
| Open-source core components (MIT / Apache) | Implemented | Repository license is MIT (`LICENSE`) |

## Why this fits Kite AI

- **x402-native request flow**: Each routed AI call is gated by HTTP 402 and settled per request.
- **Adaptive agent orchestration**: Model/provider is chosen dynamically by task profile (tier/speed-quality/domain/capability), then only that path is paid.
- **Verifiable identity/accountability linkage**: Wallet-level settlement tx hashes are captured server-side and bound into ZK commitments.
- **No subscription lock-in**: Pay-as-you-go economics align with real usage for agent workloads.

## How x402 Powers AI Router

### Per-Request Micropayments

Each AI provider endpoint has a dynamic USDC price set in the x402 route configuration:

| Provider | Tier | Price per Request |
|---|---|---|
| Claude Haiku | Budget | $0.001 |
| GPT-5 | Standard | $0.005 |
| Gemini Pro | Standard | $0.004 |
| Claude Sonnet | Premium | $0.010 |

The `x402ResourceServer` middleware intercepts each request, verifies payment, and settles before the AI response is delivered.

### Settlement Transaction Capture

AI Router captures the x402 settlement transaction hash **server-side** using the `onAfterSettle` hook:

```
x402ResourceServer
  .onAfterSettle(async (context) => {
    const txHash = context.result.transaction;
    usageCollector.patchLastTxHash(txHash);
  })
```

This means:
- **No client trust required** — tx hashes come from the settlement layer, not user input
- Each usage record is automatically tagged with its on-chain payment receipt
- The proof generator reads tx hashes from server-collected records

### ZK-Bound Payment Receipts

The captured settlement tx hashes are bound into a **Poseidon hash chain**:

```
chain[0] = txHash[0]
chain[i] = Poseidon(chain[i-1], txHash[i])
txHashesRoot = chain[31]
```

This `txHashesRoot` becomes a public signal in the Groth16 proof and is stored in `ProofRegistry`. Anyone can:

1. Query USDC Transfer events for the user's wallet
2. Recompute the hash chain
3. Compare against the on-chain `txHashesRoot`
4. Confirm the proof is bound to real payments

## Autonomous Execution Path (No Manual Clicking)

AI Router provides a headless execution path for autonomous payment flow:

```bash
cd server
tsx scripts/headless-demo.ts
```

This script performs end-to-end payment authorization and paid request execution from Node.js without browser wallet clicks.

## Innovation

**Settlement tx → ZK commitment binding** is novel in the x402 ecosystem:

- x402 handles the payment layer (request-level USDC micropayments)
- ZK proofs handle the accountability layer (usage within budget, bound to payments)
- The bridge between them is the `txHashesRoot` — a single value that cryptographically ties every payment to the proof

This creates a trustless audit trail: "I paid for N requests, stayed within budget X, and here is the on-chain proof."

## Technical Stack

| Component | Technology |
|---|---|
| Payment protocol | x402 (ExactEvmScheme) |
| Settlement (current deployment) | USDC on Base Sepolia |
| Proof system | Groth16 (circom + snarkjs) |
| Hash function | Poseidon |
| On-chain verifier | Groth16Verifier.sol |
| Proof registry | ProofRegistry.sol |
| Backend | Express.js + TypeScript |
| Frontend | React + wagmi + viem |

## Kite Network Rollout Plan

1. Add Kite network profile values for chain id / settlement asset / explorer.
2. Run the same headless x402 flow against Kite profile and capture tx evidence.
3. Re-run proof generation/submission flow and publish updated explorer links in submission.

## Demo Focus

1. **Send request** → observe x402 USDC settlement in wallet/Basescan
2. **Generate proof** → see `txHashesRoot` and `txHashCount` in the response
3. **Submit on-chain** → verify `ProofVerified` event includes `txHashesRoot`
4. **Cross-reference** → match USDC Transfer events with the proof's tx binding

## Key Differentiators

- **Not just pay-per-use** — payments are cryptographically anchored to usage proofs
- **Server-side tx capture** — eliminates client-side trust assumptions
- **Adaptive orchestration** — model/provider is selected per request for better quality-per-dollar
- **On-chain verifiability** — anyone can audit the payment-proof binding

## Links

- [3-Minute Demo Guide](../DEMO.md)
- [Main README](../README.md)
- [Prosperia Submission Story](BOUNTY-Prosperia.md)
- [0G Labs Submission Story](BOUNTY-0G-Labs-Best-Use-of-AI-Inference-or-Fine-Tuning-0G-Compute.md)
- [Base Submission Story (Self-Sustaining Autonomous Agents)](BOUNTY-Base-Self-Sustaining-Autonomous-Agents.md)

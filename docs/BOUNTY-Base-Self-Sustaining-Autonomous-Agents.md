# ProofRoute AI — Base Submission: Base Self-Sustaining Autonomous Agents

## Problem

Agentic AI workflows usually break into disconnected pieces:

- Model selection is static or manual
- Payment is bolted on as a separate billing layer
- Accountability is mostly off-chain and hard to audit

This makes autonomous behavior difficult to trust and hard to sustain economically.

## Base Requirements Mapping (as of 2026-02-21)

| Base requirement | Status | Evidence / Notes |
|---|---|---|
| Bot must transact on Base mainnet and be self-sustaining | In progress | Current live/payment demo path is Base Sepolia. Mainnet migration is the remaining requirement for strict fit. |
| Transactions integrate ERC-8021 builder codes | Implemented for proof submission path | `client/frontend/src/lib/builderCode.ts`, `client/frontend/src/lib/zkProof.ts` |
| Autonomous execution with minimal/no human intervention | Implemented demo path | `server/scripts/headless-demo.ts` (headless x402 payment + request flow) |

## Current Solution (Live Path)

**ProofRoute AI** runs an end-to-end agentic loop on Base Sepolia:

1. Analyze request context and select the best model path
2. Execute request-level x402 USDC settlement
3. Record usage and payment linkage
4. Generate ZK proof over budget and request-count constraints
5. Verify and persist proof on-chain via `ProofRegistry.submitAndVerify()`

The result is a self-sustaining flow where decisions, payments, and accountability are connected.

## Why This Fits Base Autonomous Agents

- **Autonomous decision step**: Adaptive orchestration chooses provider/tier by domain, speed-quality preference, and capability needs, with 0G complexity-aware standard-tier adjustment (`complex -> premium`, `simple -> budget`)
- **Autonomous payment step**: x402 gates each request with USDC settlement on Base Sepolia
- **Autonomous verification step**: usage commitments are proven (Groth16) and finalized on-chain
- **Composable state**: verified proof records can be read by other apps/agents as trust anchors

## On-Chain Evidence

| Evidence | Location |
|---|---|
| Settlement chain | Base Sepolia (USDC via x402 settlement) |
| Proof verifier contract | `contracts/contracts/Groth16Verifier.sol` |
| Registry contract | `contracts/contracts/ProofRegistry.sol` |
| Submit path | `client/frontend/src/lib/zkProof.ts` (`submitAndVerify`) |
| Event for indexing | `ProofVerified` in `contracts/contracts/ProofRegistry.sol` |

## Agent Loop Mapping

```text
Request
  -> local analysis + adaptive routing
  -> x402 payment gate (USDC, Base Sepolia)
  -> provider execution
  -> usage + tx hash collection
  -> Groth16 proof generation
  -> ProofRegistry.submitAndVerify()
  -> on-chain proof record usable by downstream agents/apps
```

## Gap to Strict Base Prize Compliance

1. Move autonomous bot execution from Base Sepolia to Base mainnet.
2. Show continuous self-sustaining policy (budget guard + autonomous loop) on mainnet tx evidence.
3. Keep ERC-8021 attribution on autonomous on-chain transactions and attach explorer proof.

## Demo Focus

1. Send prompts with different routing constraints (tier/speed-quality/domain).
2. Show automatic provider selection changes.
3. Confirm request-level x402 settlement.
4. Submit proof on-chain and show `ProofVerified` on Basescan.
5. Explain how this record can be consumed as machine-verifiable agent history.

## Links

- [Main README](../README.md)
- [Kite AI Submission Story (x402-Powered)](BOUNTY-Kite-AI-Agent-Native-Payments-and-Identity-on-Kite-AI-x402-Powered.md)
- [Prosperia Submission Story](BOUNTY-Prosperia.md)
- [0G Labs Submission Story](BOUNTY-0G-Labs-Best-Use-of-AI-Inference-or-Fine-Tuning-0G-Compute.md)

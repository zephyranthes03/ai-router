# AI Router — Bounty Alignment & Evidence Index

This document summarizes current bounty alignment and where each claim is implemented in code.
Status snapshot date: **2026-02-21**.

---

## 1) Primary Focus: Kite AI (x402-Powered)

| Kite requirement | Status | Evidence / Notes |
|---|---|---|
| Build on Kite AI testnet/mainnet | In progress | Current live flow is Base Sepolia. Same x402 architecture is ready to run with a Kite network profile. |
| Use x402-style payment flows | Implemented | `server/src/middleware/x402.ts`, `client/frontend/src/lib/x402Client.ts` |
| Verifiable agent identity (wallet/credential) | Implemented (wallet-based) | EIP-712 signed payment auth + settlement tx hash capture + proof binding |
| Autonomous execution (no manual wallet clicking) | Implemented (headless path) | `server/scripts/headless-demo.ts` |
| Open-source core components (MIT/Apache) | Implemented | `LICENSE` (MIT) |

### Headless demo command

```bash
cd server
tsx scripts/headless-demo.ts
```

Required env: `HEADLESS_PRIVATE_KEY` in `server/.env`.

---

## 2) Additional Target: Base Self-Sustaining Autonomous Agents

| Base requirement | Status | Evidence / Notes |
|---|---|---|
| Bot transacts on Base mainnet and is self-sustaining | In progress | Current autonomous/payment demo chain is Base Sepolia. |
| ERC-8021 builder code integration | Implemented for proof-submission transactions | `client/frontend/src/lib/builderCode.ts`, `client/frontend/src/lib/zkProof.ts` |
| Autonomous execution with minimal intervention | Implemented demo path | `server/scripts/headless-demo.ts` |

### Gap to strict Base compliance

1. Run autonomous flow on Base **mainnet** (not only Sepolia).
2. Provide mainnet explorer evidence for autonomous transactions.
3. Preserve ERC-8021 attribution in the autonomous on-chain path.

---

## 3) Additional Target: Prosperia (Privacy + Accountability)

| Claim | Evidence |
|---|---|
| Local PII detection/masking before cloud calls | `client/app/pii/regex_layer.py`, `client/app/pii/presidio_layer.py`, `client/app/orchestrator.py` |
| Prompt privacy + minimal exposure architecture | `README.md` (3-layer model), `docs/BOUNTY-Prosperia.md` |
| ZK accountability without content disclosure | `circuits/circuits/usage_budget.circom`, `server/src/zk/proof-generator.ts`, `contracts/contracts/ProofRegistry.sol` |

---

## 4) Additional Target: 0G Labs (Inference Path)

| 0G requirement area | Status | Evidence |
|---|---|---|
| Inference integration (mainnet/testnet endpoint) | Implemented | `client/app/llm/zero_g.py`, `client/app/orchestrator.py` |
| App workflow integration (not single prompt) | Implemented | `client/app/api/routes/analyze.py`, adaptive routing flow |
| Reproducible setup and docs | Implemented | `docs/BOUNTY-0G-Labs-Best-Use-of-AI-Inference-or-Fine-Tuning-0G-Compute.md` |
| Fine-tuning workflow | Not claimed | Explicitly out of scope in current version |

---

## 5) Core Technical Evidence Map

| Area | Key files |
|---|---|
| x402 server middleware and settlement hook | `server/src/middleware/x402.ts` |
| Adaptive routing selection | `server/src/routing/select-provider.ts` |
| Paid client request path | `client/frontend/src/lib/x402Client.ts` |
| Autonomous headless payment demo | `server/scripts/headless-demo.ts` |
| ZK circuit | `circuits/circuits/usage_budget.circom` |
| Proof generation (server) | `server/src/zk/proof-generator.ts` |
| On-chain verifier | `contracts/contracts/Groth16Verifier.sol` |
| On-chain registry | `contracts/contracts/ProofRegistry.sol` |
| ERC-8021 builder suffix | `client/frontend/src/lib/builderCode.ts` |
| ERC-8021-appended proof submit tx | `client/frontend/src/lib/zkProof.ts` |

---

## 6) Related Submission Stories

- `docs/BOUNTY-Kite-AI-Agent-Native-Payments-and-Identity-on-Kite-AI-x402-Powered.md`
- `docs/BOUNTY-Base-Self-Sustaining-Autonomous-Agents.md`
- `docs/BOUNTY-Prosperia.md`
- `docs/BOUNTY-0G-Labs-Best-Use-of-AI-Inference-or-Fine-Tuning-0G-Compute.md`

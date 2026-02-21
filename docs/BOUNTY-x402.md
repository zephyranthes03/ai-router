# AI Router — x402 Payment Track Submission

## Problem

AI API billing today is opaque: monthly subscriptions or prepaid credits with no per-request cost transparency. Users cannot independently verify what they paid for, and providers can overcharge without accountability.

## Solution

**AI Router** uses the **x402 protocol** to enable **per-request USDC micropayments** for AI inference. Every API call has a transparent, verifiable price — and every payment is cryptographically bound to a ZK proof of usage.

## How x402 Powers AI Router

### Per-Request Micropayments

Each AI provider endpoint has a dynamic USDC price set in the x402 route configuration:

| Provider | Tier | Price per Request |
|---|---|---|
| Claude Haiku | Budget | $0.001 |
| GPT-5 | Standard | $0.005 |
| Gemini Pro | Standard | $0.004 |
| Claude Sonnet | Premium | $0.010 |

The `x402ResourceServer` middleware intercepts every request, verifies payment, and settles on-chain before the AI response is delivered.

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

This `txHashesRoot` becomes a public signal in the Groth16 proof, stored permanently in the `ProofRegistry` smart contract on Base Sepolia. Anyone can:

1. Query USDC Transfer events for the user's wallet
2. Recompute the hash chain
3. Compare against the on-chain `txHashesRoot`
4. Confirm the proof is bound to real payments

## Innovation

**Settlement tx → ZK commitment binding** is novel in the x402 ecosystem:

- x402 handles the payment layer (request-level USDC micropayments)
- ZK proofs handle the accountability layer (usage within budget, bound to payments)
- The bridge between them is the `txHashesRoot` — a single value that cryptographically ties every payment to the proof

This creates a trustless audit trail: "I paid for N requests, stayed within budget X, and here's the on-chain proof."

## Technical Stack

| Component | Technology |
|---|---|
| Payment protocol | x402 (ExactEvmScheme) |
| Settlement | USDC on Base Sepolia |
| Proof system | Groth16 (circom + snarkjs) |
| Hash function | Poseidon |
| On-chain verifier | Groth16Verifier.sol |
| Proof registry | ProofRegistry.sol |
| Backend | Express.js + TypeScript |
| Frontend | React + wagmi + viem |

## Demo Focus

1. **Send request** → observe x402 USDC settlement in wallet/Basescan
2. **Generate proof** → see `txHashesRoot` and `txHashCount` in the response
3. **Submit on-chain** → verify `ProofVerified` event includes `txHashesRoot`
4. **Cross-reference** → match USDC Transfer events with the proof's tx binding

## Key Differentiators

- **Not just pay-per-use** — payments are cryptographically anchored to usage proofs
- **Server-side tx capture** — eliminates client-side trust assumptions
- **Multi-provider routing** — x402 pricing adapts per provider tier
- **On-chain verifiability** — anyone can audit the payment-proof binding

## Links

- [3-Minute Demo Guide](../DEMO.md)
- [Main README](../README.md)
- [ZK/Privacy Track Submission](BOUNTY-ZK-Privacy.md)

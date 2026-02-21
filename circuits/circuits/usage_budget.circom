pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// UsageBudgetProof - AI Accountability Proof with x402 Transaction Binding
//
// Proves:
//   1. N AI requests were made within a budget limit
//   2. Those requests are bound to specific x402 payment tx hashes
//
// A third-party verifier can independently query on-chain USDC Transfer
// events, recompute txHashesRoot, and compare with the on-chain public signal
// to confirm the proof is anchored to real payments.
template UsageBudgetProof(maxRequests) {
    // Private inputs
    signal input costs[maxRequests];       // per-request cost (microdollars)
    signal input providerIds[maxRequests]; // which AI model was used
    signal input txHashes[maxRequests];    // x402 payment tx hashes (field elements)
    signal input salt;                     // randomness for commitment

    // Public inputs
    signal input budgetLimit;              // max allowed budget
    signal input requestCount;             // number of requests
    signal input commitmentHash;           // Poseidon commitment
    signal input txHashesRoot;             // hash chain root of tx hashes

    // --- 1. Sum all costs ---
    signal sums[maxRequests + 1];
    sums[0] <== 0;
    for (var i = 0; i < maxRequests; i++) {
        sums[i+1] <== sums[i] + costs[i];
    }

    // --- 2. Prove total cost <= budget limit ---
    component lte = LessEqThan(64);
    lte.in[0] <== sums[maxRequests];
    lte.in[1] <== budgetLimit;
    lte.out === 1;

    // --- 3. Compute txHashesRoot via Poseidon hash chain ---
    //   chain[0] = txHashes[0]
    //   chain[i] = Poseidon(chain[i-1], txHashes[i])  for i >= 1
    signal chain[maxRequests];
    chain[0] <== txHashes[0];

    component chainHashers[maxRequests - 1];
    for (var i = 1; i < maxRequests; i++) {
        chainHashers[i - 1] = Poseidon(2);
        chainHashers[i - 1].inputs[0] <== chain[i - 1];
        chainHashers[i - 1].inputs[1] <== txHashes[i];
        chain[i] <== chainHashers[i - 1].out;
    }

    // Verify txHashesRoot matches the computed chain
    txHashesRoot === chain[maxRequests - 1];

    // --- 4. Verify commitment = Poseidon(totalCost, requestCount, txHashesRoot, salt) ---
    component hasher = Poseidon(4);
    hasher.inputs[0] <== sums[maxRequests];
    hasher.inputs[1] <== requestCount;
    hasher.inputs[2] <== chain[maxRequests - 1];
    hasher.inputs[3] <== salt;
    commitmentHash === hasher.out;
}

component main {public [budgetLimit, requestCount, commitmentHash, txHashesRoot]}
    = UsageBudgetProof(32);

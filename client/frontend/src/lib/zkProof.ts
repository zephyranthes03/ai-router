/**
 * ZK Proof utilities for client-side proof submission and on-chain verification.
 */

import { type WalletClient, encodeFunctionData } from "viem";
import {
  PROOF_REGISTRY_ADDRESS,
  IS_PROOF_REGISTRY_CONFIGURED,
  PROOF_REGISTRY_ABI,
} from "./contracts";
import { GATEWAY_SERVER_URL } from "./env";
import { BUILDER_DATA_SUFFIX } from "./builderCode";

export interface ProofGenerateResponse {
  success: boolean;
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
  calldata: string;
  meta: {
    requestCount: number;
    budgetLimit: number;
    txHashesRoot: string;
    txHashCount: number;
    generatedAt: string;
  };
}

export interface UsageRecordsResponse {
  records: Array<{
    providerId: string;
    cost: number;
    timestamp: number;
    inputTokens: number;
    outputTokens: number;
    txHash?: string;
  }>;
  stats: {
    count: number;
    totalCost: number;
    totalTokens: number;
    maxBatchSize: number;
  };
}

export interface OnChainProofRecord {
  proofId: string;
  prover: string;
  requestCount: bigint;
  budgetLimit: bigint;
  timestamp: bigint;
  commitmentHash: string;
  txHashesRoot: string;
}

/**
 * Fetch current usage records from the server
 */
export async function getUsageRecords(): Promise<UsageRecordsResponse> {
  const resp = await fetch(`${GATEWAY_SERVER_URL}/proof/records`);
  if (!resp.ok) throw new Error(`Failed to fetch usage records: ${resp.status}`);
  return resp.json();
}

/**
 * Request ZK proof generation from the server.
 * txHashes are collected server-side from x402 settlements — no client input needed.
 */
export async function generateProof(
  budgetLimit: number
): Promise<ProofGenerateResponse> {
  const resp = await fetch(`${GATEWAY_SERVER_URL}/proof/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgetLimit }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Proof generation failed: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Parse calldata string from snarkjs into contract-compatible arrays
 */
function parseCalldata(calldata: string): {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
  pubSignals: [bigint, bigint, bigint, bigint];
} {
  const parsed = JSON.parse(`[${calldata}]`);
  return {
    pA: parsed[0].map(BigInt) as [bigint, bigint],
    pB: parsed[1].map((row: string[]) => row.map(BigInt)) as [
      [bigint, bigint],
      [bigint, bigint]
    ],
    pC: parsed[2].map(BigInt) as [bigint, bigint],
    pubSignals: parsed[3].map(BigInt) as [bigint, bigint, bigint, bigint],
  };
}

/**
 * Submit a ZK proof to the ProofRegistry smart contract on-chain
 */
export async function submitProofOnChain(
  calldata: string,
  walletClient: WalletClient
): Promise<`0x${string}`> {
  if (!IS_PROOF_REGISTRY_CONFIGURED) {
    throw new Error(
      "ProofRegistry address is not configured. Set VITE_PROOF_REGISTRY_ADDRESS in client/frontend/.env.local"
    );
  }

  const { pA, pB, pC, pubSignals } = parseCalldata(calldata);

  // Encode calldata + append ERC-8021 builder attribution suffix
  const encoded = encodeFunctionData({
    abi: PROOF_REGISTRY_ABI,
    functionName: "submitAndVerify",
    args: [pA, pB, pC, pubSignals],
  });
  const data = (encoded + BUILDER_DATA_SUFFIX.slice(2)) as `0x${string}`;

  const hash = await walletClient.sendTransaction({
    to: PROOF_REGISTRY_ADDRESS,
    data,
    chain: walletClient.chain,
    account: walletClient.account!,
  });

  return hash;
}

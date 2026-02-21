import { logger } from "../utils/logger.js";
import type { UsageRecord } from "./usage-collector.js";

const PROVIDER_ID_MAP: Record<string, number> = {
  haiku: 1,
  deepseek_v3: 2,
  gemini_flash: 3,
  claude_sonnet: 4,
  gpt5: 5,
  gemini_pro: 6,
  deepseek_r1: 7,
  claude_opus: 8,
};

const MAX_REQUESTS = 32;

export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface ProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
  calldata: string;
  txHashesRoot: string;
}

function costToMicrodollars(cost: number): bigint {
  return BigInt(Math.round(cost * 1_000_000));
}

function txHashToFieldElement(txHash: string): bigint {
  const hex = txHash.startsWith("0x") ? txHash.slice(2) : txHash;
  return BigInt("0x" + hex);
}

export async function buildCircuitInput(
  records: UsageRecord[],
  budgetLimit: number
): Promise<{ input: Record<string, string | string[]>; txHashesRoot: string }> {
  if (records.length > MAX_REQUESTS) {
    throw new Error(`Too many records: ${records.length} > ${MAX_REQUESTS}`);
  }

  const costs: string[] = new Array(MAX_REQUESTS).fill("0");
  const providerIds: string[] = new Array(MAX_REQUESTS).fill("0");
  const txHashFields: string[] = new Array(MAX_REQUESTS).fill("0");

  let totalCostMicro = 0n;
  for (const [i, record] of records.entries()) {
    const costMicro = costToMicrodollars(record.cost);
    costs[i] = costMicro.toString();
    providerIds[i] = (PROVIDER_ID_MAP[record.providerId] ?? 0).toString();
    totalCostMicro += costMicro;
  }

  // Populate txHashes from server-collected usage records (missing values stay zero-padded).
  for (const [i, record] of records.entries()) {
    if (record.txHash) {
      txHashFields[i] = txHashToFieldElement(record.txHash).toString();
    }
  }

  const salt = BigInt(
    "0x" +
      Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, "0")
      ).join("")
  ).toString();

  const budgetLimitMicro = costToMicrodollars(budgetLimit).toString();
  const requestCount = records.length.toString();

  // Compute txHashesRoot and commitmentHash using Poseidon
  const circomlibjs = await import("circomlibjs");
  const poseidon = await circomlibjs.buildPoseidon();

  // Hash chain: chain[0] = txHashes[0], chain[i] = Poseidon(chain[i-1], txHashes[i])
  let chain = BigInt(txHashFields[0] ?? "0");
  for (let i = 1; i < MAX_REQUESTS; i++) {
    const h = poseidon([chain, BigInt(txHashFields[i] ?? "0")]);
    chain = poseidon.F.toObject(h);
  }
  const txHashesRoot = chain.toString();

  // commitmentHash = Poseidon(totalCost, requestCount, txHashesRoot, salt)
  const commitHash = poseidon([
    totalCostMicro,
    BigInt(requestCount),
    chain,
    BigInt(salt),
  ]);
  const commitmentHash = poseidon.F.toString(commitHash);

  return {
    input: {
      costs,
      providerIds,
      txHashes: txHashFields,
      salt,
      budgetLimit: budgetLimitMicro,
      requestCount,
      commitmentHash,
      txHashesRoot,
    },
    txHashesRoot,
  };
}

export async function generateUsageBudgetProof(
  records: UsageRecord[],
  budgetLimit: number
): Promise<ProofResult> {
  const boundTxCount = records.filter((record) => !!record.txHash).length;

  logger.info("Generating ZK proof", {
    recordCount: records.length,
    budgetLimit,
    txHashCount: boundTxCount,
  });

  try {
    const snarkjs = await import("snarkjs");

    const { input, txHashesRoot } = await buildCircuitInput(records, budgetLimit);

    const wasmPath = new URL(
      "../../../circuits/build/usage_budget_js/usage_budget.wasm",
      import.meta.url
    ).pathname;
    const zkeyPath = new URL(
      "../../../circuits/build/usage_budget_final.zkey",
      import.meta.url
    ).pathname;

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    const calldata = await snarkjs.groth16.exportSolidityCallData(
      proof,
      publicSignals
    );

    logger.info("ZK proof generated successfully", {
      publicSignals,
      txHashesRoot,
    });

    return {
      proof: proof as unknown as Groth16Proof,
      publicSignals,
      calldata,
      txHashesRoot,
    };
  } catch (error: any) {
    logger.error("ZK proof generation failed", { error: error.message });
    throw error;
  }
}

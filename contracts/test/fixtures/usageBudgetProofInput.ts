export const MAX_REQUESTS = 32;

export const USAGE_BUDGET_PROOF_FIXTURE = {
  costs: ["1200", "2300"],
  providerIds: ["4", "5"],
  txHashes: [
    "0x1111111111111111111111111111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222222222222222222222222222",
  ],
  totalCost: 3500n,
  requestCount: 2n,
  budgetLimit: 5000n,
  salt: 123456789n,
} as const;

function padWithZeros(values: readonly string[], length: number): string[] {
  const padded = [...values];
  while (padded.length < length) {
    padded.push("0");
  }
  return padded;
}

function txHashToFieldElement(txHash: string): string {
  const hex = txHash.startsWith("0x") ? txHash.slice(2) : txHash;
  return BigInt(`0x${hex}`).toString();
}

export function buildTxHashFieldElements(): bigint[] {
  const padded = padWithZeros(
    USAGE_BUDGET_PROOF_FIXTURE.txHashes.map(txHashToFieldElement),
    MAX_REQUESTS
  );
  return padded.map((value) => BigInt(value));
}

export function buildUsageBudgetCircuitInput(
  commitmentHash: string,
  txHashesRoot: string
): {
  costs: string[];
  providerIds: string[];
  txHashes: string[];
  salt: string;
  budgetLimit: string;
  requestCount: string;
  commitmentHash: string;
  txHashesRoot: string;
} {
  const txHashes = buildTxHashFieldElements().map((value) => value.toString());

  return {
    costs: padWithZeros(USAGE_BUDGET_PROOF_FIXTURE.costs, MAX_REQUESTS),
    providerIds: padWithZeros(USAGE_BUDGET_PROOF_FIXTURE.providerIds, MAX_REQUESTS),
    txHashes,
    salt: USAGE_BUDGET_PROOF_FIXTURE.salt.toString(),
    budgetLimit: USAGE_BUDGET_PROOF_FIXTURE.budgetLimit.toString(),
    requestCount: USAGE_BUDGET_PROOF_FIXTURE.requestCount.toString(),
    commitmentHash,
    txHashesRoot,
  };
}

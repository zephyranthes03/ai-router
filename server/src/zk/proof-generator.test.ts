import assert from "node:assert/strict";
import test from "node:test";
import { buildCircuitInput } from "./proof-generator.js";
import type { UsageRecord } from "./usage-collector.js";

const TX_A =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const TX_B =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

function toField(txHash: string): string {
  return BigInt(txHash).toString();
}

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    providerId: "haiku",
    cost: 0.001,
    timestamp: Date.now(),
    inputTokens: 100,
    outputTokens: 200,
    ...overrides,
  };
}

test("buildCircuitInput binds server-collected record txHashes into txHashesRoot and commitment", async () => {
  const records: UsageRecord[] = [
    makeRecord({ providerId: "haiku", cost: 0.001, txHash: TX_A }),
    makeRecord({ providerId: "gpt5", cost: 0.0025, txHash: TX_B }),
  ];

  const { input, txHashesRoot } = await buildCircuitInput(records, 0.01);
  const txHashes = input.txHashes as string[];

  assert.equal(txHashes.length, 32);
  assert.equal(txHashes[0], toField(TX_A));
  assert.equal(txHashes[1], toField(TX_B));
  assert.equal(txHashes[2], "0");
  assert.equal(input.requestCount, "2");

  const circomlibjs = await import("circomlibjs");
  const poseidon = await circomlibjs.buildPoseidon();

  let chain = BigInt(txHashes[0] ?? "0");
  for (let i = 1; i < txHashes.length; i++) {
    const h = poseidon([chain, BigInt(txHashes[i] ?? "0")]);
    chain = poseidon.F.toObject(h);
  }
  const expectedRoot = chain.toString();

  assert.equal(txHashesRoot, expectedRoot);
  assert.equal(input.txHashesRoot, expectedRoot);

  const totalCostMicro = records.reduce(
    (sum, record) => sum + BigInt(Math.round(record.cost * 1_000_000)),
    0n
  );
  const commitment = poseidon([
    totalCostMicro,
    2n,
    chain,
    BigInt(input.salt as string),
  ]);
  const expectedCommitment = poseidon.F.toString(commitment);

  assert.equal(input.commitmentHash, expectedCommitment);
});

test("buildCircuitInput zero-pads missing record txHash values", async () => {
  const records: UsageRecord[] = [
    makeRecord({ providerId: "haiku", txHash: TX_A }),
    makeRecord({ providerId: "gpt5" }),
  ];

  const { input } = await buildCircuitInput(records, 0.01);
  const txHashes = input.txHashes as string[];

  assert.equal(txHashes[0], toField(TX_A));
  assert.equal(txHashes[1], "0");
  assert.equal(txHashes[31], "0");
});

test("buildCircuitInput rejects batches larger than 32 records", async () => {
  const records = Array.from({ length: 33 }, () => makeRecord());

  await assert.rejects(
    () => buildCircuitInput(records, 0.1),
    /Too many records: 33 > 32/
  );
});

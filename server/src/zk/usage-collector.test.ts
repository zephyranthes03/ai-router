import assert from "node:assert/strict";
import test from "node:test";
import { usageCollector } from "./usage-collector.js";
import { buildCircuitInput } from "./proof-generator.js";
import type { UsageRecord } from "./usage-collector.js";

const TX_1 =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX_2 =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function makeUsageRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    providerId: "haiku",
    cost: 0.001,
    timestamp: Date.now(),
    inputTokens: 100,
    outputTokens: 200,
    ...overrides,
  };
}

test("onAfterSettle-style patching binds tx hashes to the matching usage records", async () => {
  usageCollector.reset();

  // Simulate request lifecycle:
  // 1) request handler records usage
  // 2) x402 onAfterSettle patches tx hash
  usageCollector.record(makeUsageRecord({ providerId: "haiku" }));
  usageCollector.patchLastTxHash(TX_1);

  usageCollector.record(makeUsageRecord({ providerId: "gpt5", cost: 0.002 }));
  usageCollector.patchLastTxHash(TX_2);

  const records = usageCollector.getBatchForProof();
  const { input } = await buildCircuitInput(records, 0.01);
  const txHashes = input.txHashes as string[];

  assert.equal(txHashes[0], BigInt(TX_1).toString());
  assert.equal(txHashes[1], BigInt(TX_2).toString());
  assert.equal(txHashes[2], "0");

  usageCollector.reset();
});

test("patchLastTxHash is a no-op when there is no usage record yet", () => {
  usageCollector.reset();
  usageCollector.patchLastTxHash(TX_1);
  assert.equal(usageCollector.getRecords().length, 0);
});

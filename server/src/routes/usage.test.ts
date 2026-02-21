/**
 * Tests for GET /usage endpoint.
 * Exercises the response shape and aggregation logic by driving
 * usageCollector directly (same approach as usage-collector.test.ts).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { usageCollector } from "../zk/usage-collector.js";

const TX_A =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// ---------------------------------------------------------------------------
// Simulate the route's response serialisation so we can test it in isolation
// without spinning up an HTTP server.
// ---------------------------------------------------------------------------
function buildUsageResponse() {
  const records = usageCollector.getRecords();
  const stats = usageCollector.getStats();
  return {
    records: records.map((r) => ({
      providerId: r.providerId,
      cost: r.cost,
      timestamp: r.timestamp,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      txHash: r.txHash ?? null,
    })),
    stats: {
      count: stats.count,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("GET /usage returns empty records and zero stats when collector is empty", () => {
  usageCollector.reset();

  const body = buildUsageResponse();

  assert.deepEqual(body.records, []);
  assert.equal(body.stats.count, 0);
  assert.equal(body.stats.totalCost, 0);
  assert.equal(body.stats.totalTokens, 0);

  usageCollector.reset();
});

test("GET /usage returns correct record shape (all fields present)", () => {
  usageCollector.reset();

  usageCollector.record({
    providerId: "haiku",
    cost: 0.001,
    timestamp: 1_700_000_000,
    inputTokens: 50,
    outputTokens: 100,
  });

  const body = buildUsageResponse();

  assert.equal(body.records.length, 1);
  const rec = body.records[0];
  assert.ok(rec, "record should exist");
  assert.equal(rec.providerId, "haiku");
  assert.equal(rec.cost, 0.001);
  assert.equal(rec.timestamp, 1_700_000_000);
  assert.equal(rec.inputTokens, 50);
  assert.equal(rec.outputTokens, 100);
  // txHash defaults to null when not set
  assert.equal(rec.txHash, null);

  usageCollector.reset();
});

test("GET /usage exposes txHash as string when settlement is patched", () => {
  usageCollector.reset();

  usageCollector.record({
    providerId: "haiku",
    cost: 0.001,
    timestamp: Date.now(),
    inputTokens: 10,
    outputTokens: 20,
  });
  usageCollector.patchLastTxHash(TX_A);

  const body = buildUsageResponse();

  assert.equal(body.records.length, 1);
  assert.equal(body.records[0]?.txHash, TX_A);

  usageCollector.reset();
});

test("GET /usage stats aggregate correctly across multiple records", () => {
  usageCollector.reset();

  usageCollector.record({
    providerId: "haiku",
    cost: 0.001,
    timestamp: Date.now(),
    inputTokens: 100,
    outputTokens: 200,
  });
  usageCollector.record({
    providerId: "gpt5",
    cost: 0.005,
    timestamp: Date.now(),
    inputTokens: 50,
    outputTokens: 75,
  });

  const body = buildUsageResponse();

  assert.equal(body.stats.count, 2);
  assert.ok(
    Math.abs(body.stats.totalCost - 0.006) < 1e-9,
    `expected totalCost ≈ 0.006 but got ${body.stats.totalCost}`
  );
  assert.equal(body.stats.totalTokens, 100 + 200 + 50 + 75); // 425

  usageCollector.reset();
});

test("GET /usage records preserve insertion order", () => {
  usageCollector.reset();

  const providers = ["haiku", "gpt5", "gemini-flash"] as const;
  for (const pid of providers) {
    usageCollector.record({
      providerId: pid,
      cost: 0.001,
      timestamp: Date.now(),
      inputTokens: 10,
      outputTokens: 10,
    });
  }

  const body = buildUsageResponse();

  assert.deepEqual(
    body.records.map((r) => r.providerId),
    [...providers]
  );

  usageCollector.reset();
});

test("GET /usage txHash is null for records without settlement, string for settled ones", () => {
  usageCollector.reset();

  usageCollector.record({
    providerId: "haiku",
    cost: 0.001,
    timestamp: Date.now(),
    inputTokens: 10,
    outputTokens: 20,
  });
  usageCollector.patchLastTxHash(TX_A);

  usageCollector.record({
    providerId: "gpt5",
    cost: 0.002,
    timestamp: Date.now(),
    inputTokens: 30,
    outputTokens: 40,
  });
  // second record intentionally not patched — should remain null

  const body = buildUsageResponse();

  assert.equal(body.records[0]?.txHash, TX_A);
  assert.equal(body.records[1]?.txHash, null);

  usageCollector.reset();
});

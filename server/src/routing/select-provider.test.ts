import assert from "node:assert/strict";
import test from "node:test";
import { selectProvider, type RoutingMetadata } from "./select-provider.js";

function metadata(overrides: Partial<RoutingMetadata> = {}): RoutingMetadata {
  return {
    context_length: 1000,
    domain: "general",
    tier: "standard",
    speed_quality_weight: 50,
    requires_thinking: false,
    requires_web_search: false,
    ...overrides,
  };
}

test("budget tier + speed preference selects the fastest budget model", () => {
  const result = selectProvider(
    metadata({
      tier: "budget",
      speed_quality_weight: 0,
    })
  );

  assert.equal(result.id, "haiku");
  assert.match(result.reasoning, /tier=budget/);
});

test("budget tier + quality preference selects the highest-quality budget model", () => {
  const result = selectProvider(
    metadata({
      tier: "budget",
      speed_quality_weight: 100,
    })
  );

  assert.equal(result.id, "gemini_flash");
});

test("standard tier + speed preference selects GPT-5.2", () => {
  const result = selectProvider(
    metadata({
      tier: "standard",
      speed_quality_weight: 0,
    })
  );

  assert.equal(result.id, "gpt5");
});

test("standard tier + quality preference selects Gemini 3 Pro", () => {
  const result = selectProvider(
    metadata({
      tier: "standard",
      speed_quality_weight: 100,
    })
  );

  assert.equal(result.id, "gemini_pro");
});

test("tier remains a hard filter when providers are available in that tier", () => {
  const result = selectProvider(
    metadata({
      tier: "premium",
      speed_quality_weight: 0,
    })
  );

  assert.equal(result.id, "deepseek_r1");
  assert.deepEqual(
    new Set(result.candidates.map((candidate) => candidate.id)),
    new Set(["deepseek_r1", "claude_opus"])
  );
});

test("if tier has no eligible providers for required capability, router relaxes upward", () => {
  const result = selectProvider(
    metadata({
      tier: "budget",
      speed_quality_weight: 0,
      requires_thinking: true,
    })
  );

  assert.equal(result.id, "claude_sonnet");
  assert.deepEqual(
    new Set(result.candidates.map((candidate) => candidate.id)),
    new Set(["claude_sonnet", "gemini_pro"])
  );
});

test("domain bonus can change winner for the same tier and weight", () => {
  const base = selectProvider(
    metadata({
      tier: "budget",
      speed_quality_weight: 0,
      domain: "general",
    })
  );
  const code = selectProvider(
    metadata({
      tier: "budget",
      speed_quality_weight: 0,
      domain: "code",
    })
  );

  assert.equal(base.id, "haiku");
  assert.equal(code.id, "gemini_flash");
});

test("ultimate fallback returns claude_sonnet when no eligible provider exists", () => {
  const result = selectProvider(
    metadata({
      tier: "premium",
      requires_web_search: true,
    })
  );

  assert.equal(result.id, "claude_sonnet");
  assert.equal(result.candidates.length, 0);
  assert.match(result.reasoning, /Fallback/);
});

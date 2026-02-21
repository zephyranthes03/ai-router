import { Router } from "express";
import { PROVIDERS, updateProviders } from "../utils/pricing.js";
import type { ProviderInfo } from "../utils/pricing.js";

const router = Router();

/**
 * GET /providers
 * Returns list of all available providers with their pricing and capabilities
 */
router.get("/", (_req, res) => {
  const providers = Object.entries(PROVIDERS).map(([id, info]) => ({
    id,
    name: info.name,
    tier: info.tier,
    x402_price: info.x402_price,
    max_output_tokens: info.max_output_tokens,
    pricing: info.pricing,
    capabilities: info.capabilities,
  }));

  res.json({ providers });
});

/**
 * PUT /providers
 * Replace the provider map at runtime and persist to disk.
 * Body: Record<string, ProviderInfo> (same shape as the internal PROVIDERS object)
 */
router.put("/", (req, res) => {
  const body = req.body as Record<string, ProviderInfo>;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Body must be a JSON object keyed by provider id" });
  }

  // Basic sanity check — each entry must have at least model, provider, tier
  for (const [id, info] of Object.entries(body)) {
    if (!info.model || !info.provider || !info.tier) {
      return res.status(400).json({
        error: `Provider "${id}" is missing required fields: model, provider, tier`,
      });
    }
  }

  try {
    updateProviders(body);
    const providers = Object.entries(body).map(([id, info]) => ({ id, ...info }));
    res.json({ ok: true, count: providers.length, providers });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Failed to update providers" });
  }
});

export default router;

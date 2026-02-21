import { Router } from "express";
import { PROVIDERS } from "../utils/pricing.js";

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

export default router;

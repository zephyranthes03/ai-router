import { Router } from "express";
import { validate, estimateSchema } from "../middleware/validation.js";
import { getProviderInfo, estimateCost } from "../utils/pricing.js";

const router = Router();

/**
 * POST /estimate
 * Estimates the cost for a request without executing it
 */
router.post("/", validate(estimateSchema), (req, res) => {
  const { provider_id, token_estimate } = req.body;

  const providerInfo = getProviderInfo(provider_id);
  if (!providerInfo) {
    return res.status(400).json({
      error: `Unknown provider_id: ${provider_id}`,
    });
  }

  // Assume 50/50 split between input and output tokens
  const inputTokens = Math.floor(token_estimate / 2);
  const outputTokens = Math.ceil(token_estimate / 2);

  const { input_cost, output_cost, actual_total } = estimateCost(
    provider_id,
    inputTokens,
    outputTokens
  );

  res.json({
    provider_id,
    estimated_cost_usd: actual_total,
    breakdown: {
      input_cost,
      output_cost,
      total: actual_total,
    },
    tier: providerInfo.tier,
    x402_price: providerInfo.x402_price,
  });
});

export default router;

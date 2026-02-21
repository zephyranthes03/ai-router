import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validation.js";
import { registry } from "../providers/registry.js";
import { getProviderInfo, estimateCost, PROVIDERS } from "../utils/pricing.js";
import { usageCollector } from "../zk/usage-collector.js";

const router = Router();

// Updated request schema - provider_id comes from URL params, not body
const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1, "Message content cannot be empty"),
      })
    )
    .min(1, "At least one message is required"),
  options: z
    .object({
      max_tokens: z.number().int().positive().max(16384).default(4096),
      extended_thinking: z.boolean().default(false),
      thinking_budget: z.number().int().positive().max(100000).optional(),
      requires_web_search: z.boolean().optional(),
    })
    .optional(),
  routing_metadata: z
    .object({
      domain: z.string().optional(),
      complexity: z.string().optional(),
      requires_thinking: z.boolean().optional(),
      requires_web_search: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /request/:provider_id
 * Provider-based routing endpoint
 */
router.post("/:provider_id", validate(requestSchema), async (req: Request, res: Response) => {
  const provider_id = req.params.provider_id as string;

  // Validate provider exists
  const providerInfo = getProviderInfo(provider_id);
  if (!providerInfo) {
    return res.status(400).json({
      error: `Unknown provider: ${provider_id}`,
      available: Object.keys(PROVIDERS),
    });
  }

  const { messages, options } = req.body;

  try {
    // Clamp max_tokens to the tier-based limit
    const tierLimit = providerInfo.max_output_tokens;
    const requestedMaxTokens = options?.max_tokens ?? 4096;
    const clampedMaxTokens = Math.min(requestedMaxTokens, tierLimit);

    // Build request object for registry
    const aiRequest = {
      messages,
      max_tokens: clampedMaxTokens,
      thinking: options?.extended_thinking,
      thinking_budget: options?.thinking_budget,
      web_search: options?.requires_web_search,
    };

    // Execute the request
    const response = await registry.executeRequest(provider_id, aiRequest);

    // Calculate actual cost from usage
    const cost = estimateCost(
      provider_id,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    // Parse charged amount from provider x402_price string (e.g., "$0.001" -> 0.001)
    const charged = parseFloat(providerInfo.x402_price.replace("$", ""));

    // Build response object matching client spec
    const responseObj: {
      content: string;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
      thinking?: string;
    } = {
      content: response.content,
      model: response.model,
      usage: response.usage,
    };

    // Include thinking if present
    if (response.thinking) {
      responseObj.thinking = response.thinking;
    }

    // Record usage for ZK proof generation.
    // txHash will be patched by x402 onAfterSettle hook (fires after this handler).
    usageCollector.record({
      providerId: provider_id,
      cost: cost.actual_total,
      timestamp: Date.now(),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const isDemo = registry.isDemo(provider_id);

    const responsePayload: Record<string, unknown> = {
      provider_id,
      response: responseObj,
      cost: {
        input_cost: cost.input_cost,
        output_cost: cost.output_cost,
        actual_total: cost.actual_total,
        charged,
      },
      limits: {
        tier: providerInfo.tier,
        max_output_tokens: tierLimit,
        requested_max_tokens: requestedMaxTokens,
        applied_max_tokens: clampedMaxTokens,
      },
    };

    if (isDemo) {
      responsePayload.demo_mode = true;
      responsePayload.demo_notice =
        "This response is simulated. The routing logic worked correctly — " +
        `provider "${provider_id}" (${providerInfo.name}) was selected based on your request metadata. ` +
        "Set the corresponding API key in .env to get real AI responses.";
    }

    res.json(responsePayload);
  } catch (error: any) {
    // Map provider errors to HTTP status codes
    let status = 500;
    let errorMessage = "Internal server error";

    if (error.message) {
      const msg = error.message.toLowerCase();

      if (msg.includes("timeout") || msg.includes("timed out")) {
        status = 504;
        errorMessage = "Provider request timed out";
      } else if (msg.includes("auth") || msg.includes("unauthorized") || msg.includes("api key")) {
        status = 502;
        errorMessage = "Provider authentication failed";
      } else if (msg.includes("rate limit") || msg.includes("quota")) {
        status = 429;
        errorMessage = "Rate limit exceeded";
      } else if (msg.includes("unavailable") || msg.includes("down") || msg.includes("connection")) {
        status = 503;
        errorMessage = "Provider temporarily unavailable";
      } else {
        errorMessage = error.message;
      }
    }

    // Log sanitized error (no content, no API keys)
    console.error(`[${new Date().toISOString()}] Provider error:`, {
      provider: provider_id,
      status,
      error: errorMessage,
      // NEVER log: messages, API keys, request content
    });

    res.status(status).json({
      error: errorMessage,
      provider: provider_id,
    });
  }
});

export default router;

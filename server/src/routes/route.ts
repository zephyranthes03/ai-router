import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validation.js";
import { registry } from "../providers/registry.js";
import { selectProvider, type RoutingMetadata } from "../routing/select-provider.js";

const router = Router();

const routeSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      })
    )
    .optional(),
  routing_metadata: z.object({
    context_length: z.number().positive().default(1000),
    domain: z.string().default("general"),
    tier: z.enum(["budget", "standard", "premium"]).default("standard"),
    speed_quality_weight: z.number().min(0).max(100).default(50),
    requires_thinking: z.boolean().default(false),
    requires_web_search: z.boolean().default(false),
  }),
});

/**
 * POST /route — recommend best provider based on tier + speed/quality preference
 */
router.post("/", validate(routeSchema), (req, res) => {
  const metadata: RoutingMetadata = req.body.routing_metadata;

  const recommended = selectProvider(metadata);

  const isDemo = registry.isDemo(recommended.id);

  res.json({
    recommended_provider: recommended.id,
    provider_name: recommended.name,
    x402_price: recommended.x402_price,
    endpoint: `/request/${recommended.id}`,
    reasoning: recommended.reasoning,
    candidates: recommended.candidates,
    ...(isDemo && {
      demo_mode: true,
      demo_notice:
        "Routing logic is fully functional. The selected provider is in demo mode — " +
        "set the API key in .env for real AI responses.",
    }),
  });
});

export default router;

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { PROVIDERS, type TierName } from "../utils/pricing.js";

// Schema definitions
export const estimateSchema = z.object({
  provider_id: z
    .string()
    .refine((id) => id in PROVIDERS, {
      message: "provider_id must be a valid provider",
    }),
  token_estimate: z.number().positive(),
});

export const requestSchema = z.object({
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

// Validation middleware factory
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

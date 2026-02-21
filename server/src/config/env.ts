import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  ANTHROPIC_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  DEEPSEEK_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  RESOURCE_WALLET_ADDRESS: z.string().default("0x0000000000000000000000000000000000000000"),
  FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  NETWORK: z.string().default("eip155:84532"),
});

export type Env = z.infer<typeof envSchema>;

// Parse and export. If validation fails, print clear error and exit.
let config: Env;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Environment validation failed:");
    error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }
  throw error;
}

/**
 * Check which provider API keys are actually configured.
 * Returns a map of provider name -> whether the key is present.
 */
export function getConfiguredProviders(): Record<string, boolean> {
  return {
    anthropic: config.ANTHROPIC_API_KEY.length > 0,
    openai: config.OPENAI_API_KEY.length > 0,
    deepseek: config.DEEPSEEK_API_KEY.length > 0,
    gemini: config.GEMINI_API_KEY.length > 0,
  };
}

export function isDemoMode(): boolean {
  const configured = getConfiguredProviders();
  return !Object.values(configured).some(Boolean);
}

export { config };

import type { Express } from "express";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { PROVIDERS } from "../utils/pricing.js";
import { usageCollector } from "../zk/usage-collector.js";

export async function setupX402(app: Express): Promise<boolean> {
  try {
    const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
    const { ExactEvmScheme } = await import("@x402/evm/exact/server");
    const { HTTPFacilitatorClient } = await import("@x402/core/server");

    const payTo = config.RESOURCE_WALLET_ADDRESS as `0x${string}`;
    const network = config.NETWORK as `${string}:${string}`;

    const facilitatorClient = new HTTPFacilitatorClient({
      url: config.FACILITATOR_URL,
    });

    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(network, new ExactEvmScheme())
      .onAfterSettle(async (context: any) => {
        // x402 settles AFTER the request handler has already recorded usage.
        // Patch the most recent usage record with the settlement tx hash.
        const txHash: string | undefined = context.result?.transaction;
        if (txHash) {
          usageCollector.patchLastTxHash(txHash);
        } else {
          logger.warn("x402 onAfterSettle: settlement tx hash not available");
        }
      });

    const routeConfig: Record<string, any> = {};
    for (const [providerId, info] of Object.entries(PROVIDERS)) {
      routeConfig[`POST /request/${providerId}`] = {
        accepts: [
          {
            scheme: "exact" as const,
            price: info.x402_price,
            network,
            payTo,
          },
        ],
        description: `AI Gateway - ${info.name}`,
        mimeType: "application/json",
      };
    }

    // syncFacilitatorOnStart=false: defer facilitator connection until first payment request
    // This prevents startup failures when the facilitator is temporarily unreachable.
    app.use(paymentMiddleware(routeConfig, resourceServer, undefined, undefined, false));

    logger.info(`x402 payment middleware initialized for ${Object.keys(PROVIDERS).length} providers`);
    return true;
  } catch (error: any) {
    logger.warn(`x402 payment middleware failed to initialize: ${error.message}`);
    logger.warn("Payment endpoints will operate WITHOUT payment verification (dev mode)");
    return false;
  }
}

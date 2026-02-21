import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { setupX402 } from "./middleware/x402.js";
import { registry } from "./providers/registry.js";
import providersRouter from "./routes/providers.js";
import { loadProviderOverrides } from "./utils/pricing.js";
import estimateRouter from "./routes/estimate.js";
import requestRouter from "./routes/request.js";
import routeRouter from "./routes/route.js";
import proofRouter from "./routes/proof.js";
import usageRouter from "./routes/usage.js";

// Handle x402 library's deferred async errors gracefully (requires Node 20+ for full functionality)
process.on("unhandledRejection", (reason: any) => {
  if (reason?.constructor?.name === "RouteConfigurationError") {
    logger.warn("x402 route configuration failed — payment verification disabled for affected routes");
    logger.warn("Ensure Node 20+ and network access to the facilitator for x402 to work");
    return; // Don't crash
  }
  logger.error("Unhandled rejection", { error: reason?.message || reason });
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
});

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  try {
    const providers = await registry.healthCheck();
    const demoProviders = registry.getDemoProviders();
    const allDemo = demoProviders.length === 4;

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      providers,
      ...(demoProviders.length > 0 && {
        demo_mode: {
          active: true,
          all_demo: allDemo,
          demo_providers: demoProviders,
          message: allDemo
            ? "All providers running in demo mode. Routing works correctly — set API keys in .env for real AI responses."
            : `${demoProviders.join(", ")} running in demo mode. Set corresponding API keys for real responses.`,
        },
      }),
    });
  } catch (error) {
    logger.error("Health check failed", { error });
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
    });
  }
});

// Mount routes
app.use("/providers", providersRouter);
app.use("/estimate", estimateRouter);
app.use("/request", requestRouter);
app.use("/route", routeRouter);
app.use("/proof", proofRouter);
app.use("/usage", usageRouter);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: "Internal server error",
  });
});

// Start server
async function start() {
  try {
    // Setup x402 payment middleware BEFORE route mounting
    const x402Enabled = await setupX402(app);
    if (!x402Enabled) {
      logger.warn("Running WITHOUT x402 payment verification (dev mode)");
    }

    loadProviderOverrides();
    await registry.init();
    logger.info("Provider registry initialized");

    app.listen(config.PORT, () => {
      logger.info(`AI Gateway server listening on port ${config.PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`Network: ${config.NETWORK}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  process.exit(0);
});

start();

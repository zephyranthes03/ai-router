import { Router, type Request, type Response } from "express";
import { usageCollector } from "../zk/usage-collector.js";

const router = Router();

/**
 * GET /usage
 * Returns all collected usage records (including x402 payment tx hashes)
 * and aggregate stats.
 */
router.get("/", (_req: Request, res: Response) => {
  const records = usageCollector.getRecords();
  const stats = usageCollector.getStats();

  res.json({
    records: records.map((r) => ({
      providerId: r.providerId,
      cost: r.cost,
      timestamp: r.timestamp,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      txHash: r.txHash ?? null,
    })),
    stats: {
      count: stats.count,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
    },
  });
});

export default router;

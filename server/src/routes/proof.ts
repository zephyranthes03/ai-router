import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validation.js";
import { usageCollector } from "../zk/usage-collector.js";
import { generateUsageBudgetProof } from "../zk/proof-generator.js";

const router = Router();

const generateSchema = z.object({
  budgetLimit: z.number().positive("Budget limit must be positive"),
});

/**
 * POST /proof/generate
 * Generate a ZK proof from collected usage records.
 * txHashes are sourced server-side from x402 settlement receipts
 * stored in UsageRecord.txHash (populated by onAfterSettle hook).
 */
router.post("/generate", validate(generateSchema), async (req: Request, res: Response) => {
  const { budgetLimit } = req.body;
  const records = usageCollector.getBatchForProof();

  if (records.length === 0) {
    return res.status(400).json({
      error: "No usage records available for proof generation",
      hint: "Make some AI requests first via POST /request/:provider_id",
    });
  }

  const boundTxCount = records.filter((r) => !!r.txHash).length;

  try {
    // No client-provided txHashes — proof generator reads from records directly
    const result = await generateUsageBudgetProof(records, budgetLimit);

    usageCollector.clearBatch();

    res.json({
      success: true,
      proof: result.proof,
      publicSignals: result.publicSignals,
      calldata: result.calldata,
      meta: {
        requestCount: records.length,
        budgetLimit,
        txHashesRoot: result.txHashesRoot,
        txHashCount: boundTxCount,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Proof generation failed",
      details: error.message,
    });
  }
});

/**
 * GET /proof/records
 * Get currently collected usage records (before proof generation)
 */
router.get("/records", (_req: Request, res: Response) => {
  const records = usageCollector.getRecords();
  const stats = usageCollector.getStats();

  res.json({
    records: records.map((r) => ({
      providerId: r.providerId,
      cost: r.cost,
      timestamp: r.timestamp,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      txHash: r.txHash,
    })),
    stats: {
      count: stats.count,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
      maxBatchSize: 32,
    },
  });
});

export default router;

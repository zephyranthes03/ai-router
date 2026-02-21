import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";

export interface UsageRecord {
  providerId: string;
  cost: number; // actual_total from estimateCost() in microdollars
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  txHash?: string; // x402 payment transaction hash (hex string with 0x prefix)
}

const MAX_BATCH_SIZE = 32; // matches circom circuit maxRequests

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../data");
const RECORDS_FILE = join(DATA_DIR, "usage-records.json");

class UsageCollector {
  private records: UsageRecord[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      if (existsSync(RECORDS_FILE)) {
        const raw = readFileSync(RECORDS_FILE, "utf-8");
        this.records = JSON.parse(raw) as UsageRecord[];
        logger.info("ZK usage records loaded from disk", { count: this.records.length });
      }
    } catch (err: any) {
      logger.warn("Failed to load usage records from disk, starting fresh", { error: err.message });
      this.records = [];
    }
  }

  private persist(): void {
    try {
      writeFileSync(RECORDS_FILE, JSON.stringify(this.records, null, 2), "utf-8");
    } catch (err: any) {
      logger.error("Failed to persist usage records to disk", { error: err.message });
    }
  }

  record(entry: UsageRecord): void {
    this.records.push(entry);
    this.persist();
    logger.info("ZK usage recorded", {
      providerId: entry.providerId,
      cost: entry.cost,
      tokens: entry.inputTokens + entry.outputTokens,
      batchSize: this.records.length,
    });
  }

  getRecords(): UsageRecord[] {
    return [...this.records];
  }

  getBatchForProof(): UsageRecord[] {
    return this.records.slice(0, MAX_BATCH_SIZE);
  }

  clearBatch(): void {
    this.records = this.records.slice(MAX_BATCH_SIZE);
    this.persist();
    logger.info("ZK batch cleared", { remaining: this.records.length });
  }

  getStats(): { count: number; totalCost: number; totalTokens: number } {
    const totalCost = this.records.reduce((sum, r) => sum + r.cost, 0);
    const totalTokens = this.records.reduce(
      (sum, r) => sum + r.inputTokens + r.outputTokens,
      0
    );
    return { count: this.records.length, totalCost, totalTokens };
  }

  /**
   * Patch the most recent record's txHash.
   * Called by x402 onAfterSettle hook which fires after the request handler.
   */
  patchLastTxHash(txHash: string): void {
    if (this.records.length === 0) return;
    const last = this.records[this.records.length - 1];
    if (!last) return;
    last.txHash = txHash;
    this.persist();
    logger.info("ZK usage record patched with settlement txHash", {
      providerId: last.providerId,
      txHash: txHash.slice(0, 18) + "...",
    });
  }

  reset(): void {
    this.records = [];
    this.persist();
  }
}

export const usageCollector = new UsageCollector();

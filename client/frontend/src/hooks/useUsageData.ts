/**
 * Usage data aggregation hook — computes cost summaries from conversations.
 * Exports pure functions for unit testing.
 */

import { useMemo } from "react";
import type {
  Conversation,
  Message,
  UsageFilter,
  UsagePeriod,
  UsageSummary,
  ProviderUsageSummary,
  DateBucket,
} from "../types";

/** Get the date bucket string for a timestamp based on period. */
export function getDateBucket(timestamp: number, period: UsagePeriod): string {
  const d = new Date(timestamp);
  if (period === "daily") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (period === "weekly") {
    // ISO week number
    const temp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${temp.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }
  // monthly
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Filter messages by date range based on period or custom range. */
export function filterByDateRange(
  messages: Message[],
  period: UsagePeriod,
  dateRange?: { start: number; end: number }
): Message[] {
  if (dateRange) {
    return messages.filter((m) => m.timestamp >= dateRange.start && m.timestamp <= dateRange.end);
  }

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let start: number;
  if (period === "daily") {
    start = startOfDay.getTime();
  } else if (period === "weekly") {
    start = now - 7 * 24 * 60 * 60 * 1000;
  } else {
    start = now - 30 * 24 * 60 * 60 * 1000;
  }

  return messages.filter((m) => m.timestamp >= start);
}

/** Core aggregation logic — pure function for testability. */
export function aggregateUsage(messages: Message[], filter: UsageFilter): UsageSummary {
  // Only messages with cost data
  const costed = messages.filter((m) => m.cost !== undefined);

  // Filter by date range
  const dated = filterByDateRange(costed, filter.period, filter.dateRange);

  // Filter by provider
  const filtered = filter.providerIds && filter.providerIds.length > 0
    ? dated.filter((m) => m.provider && filter.providerIds!.includes(m.provider))
    : dated;

  let totalCost = 0;
  let totalCharged = 0;
  let requestCount = 0;
  const tokenCount = { input: 0, output: 0 };
  const byProvider: Record<string, ProviderUsageSummary> = {};
  const dateMap: Record<string, DateBucket> = {};

  for (const msg of filtered) {
    if (!msg.cost) continue;

    totalCost += msg.cost.actual_total;
    totalCharged += msg.cost.charged;
    requestCount++;

    if (msg.tokens) {
      tokenCount.input += msg.tokens.input;
      tokenCount.output += msg.tokens.output;
    }

    // Group by provider
    const pid = msg.provider ?? "unknown";
    if (!byProvider[pid]) {
      byProvider[pid] = {
        provider_name: msg.provider_name ?? pid,
        tier: msg.tier ?? "unknown",
        totalCost: 0,
        totalCharged: 0,
        requestCount: 0,
        tokenCount: { input: 0, output: 0 },
      };
    }
    byProvider[pid].totalCost += msg.cost.actual_total;
    byProvider[pid].totalCharged += msg.cost.charged;
    byProvider[pid].requestCount++;
    if (msg.tokens) {
      byProvider[pid].tokenCount.input += msg.tokens.input;
      byProvider[pid].tokenCount.output += msg.tokens.output;
    }

    // Group by date bucket
    const bucket = getDateBucket(msg.timestamp, filter.period);
    if (!dateMap[bucket]) {
      dateMap[bucket] = { date: bucket, cost: 0, charged: 0, requestCount: 0, byProvider: {} };
    }
    dateMap[bucket].cost += msg.cost.actual_total;
    dateMap[bucket].charged += msg.cost.charged;
    dateMap[bucket].requestCount++;
    dateMap[bucket].byProvider[pid] = (dateMap[bucket].byProvider[pid] ?? 0) + msg.cost.actual_total;
  }

  const byDate = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  return { totalCost, totalCharged, requestCount, tokenCount, byProvider, byDate };
}

/** React hook that computes usage summary from conversations. */
export function useUsageData(conversations: Conversation[], filter: UsageFilter): UsageSummary {
  return useMemo(() => {
    const allMessages = conversations.flatMap((c) => c.messages);
    return aggregateUsage(allMessages, filter);
  }, [conversations, filter]);
}

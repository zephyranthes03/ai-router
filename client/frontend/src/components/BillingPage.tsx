import { useState, useMemo } from "react";
import type { Conversation, UsageFilter, UsageRecord } from "../types";
import { useUsageData } from "../hooks/useUsageData";
import { useServerUsage } from "../hooks/useServerUsage";
import BillingFilters from "./billing/BillingFilters";
import BillingChart from "./billing/BillingChart";
import BillingTable from "./billing/BillingTable";
import BlockchainHistory from "./billing/BlockchainHistory";
import ZkVerification from "./billing/ZkVerification";

interface BillingPageProps {
  conversations: Conversation[];
}

export default function BillingPage({ conversations }: BillingPageProps) {
  const [filter, setFilter] = useState<UsageFilter>({ period: "daily" });
  const summary = useUsageData(conversations, filter);
  const { data: serverUsage } = useServerUsage();

  // Build flat UsageRecord array from conversations for the table
  const records: UsageRecord[] = useMemo(() => {
    const result: UsageRecord[] = [];
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (!msg.cost || msg.role !== "assistant") continue;
        result.push({
          id: msg.id,
          timestamp: msg.timestamp,
          provider_id: msg.provider ?? "unknown",
          provider_name: msg.provider_name ?? "Unknown",
          tier: msg.tier ?? "unknown",
          cost: msg.cost,
          tokens: msg.tokens ?? { input: 0, output: 0 },
          conversation_id: conv.id,
        });
      }
    }
    // Apply date/provider filters
    let filtered = result;
    if (filter.dateRange) {
      filtered = filtered.filter(
        (r) => r.timestamp >= filter.dateRange!.start && r.timestamp <= filter.dateRange!.end
      );
    } else {
      const now = Date.now();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      let start: number;
      if (filter.period === "daily") start = startOfDay.getTime();
      else if (filter.period === "weekly") start = now - 7 * 86400000;
      else start = now - 30 * 86400000;
      filtered = filtered.filter((r) => r.timestamp >= start);
    }
    if (filter.providerIds && filter.providerIds.length > 0) {
      filtered = filtered.filter((r) => filter.providerIds!.includes(r.provider_id));
    }
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [conversations, filter]);

  // Build a map from UsageRecord.id -> txHash by matching server records to
  // conversation records via closest timestamp + same provider (within 5 seconds).
  const txHashMap = useMemo<Record<string, string>>(() => {
    if (!serverUsage?.records) return {};
    const result: Record<string, string> = {};
    const serverWithHash = serverUsage.records.filter((r) => r.txHash);

    // For each conversation record, find the closest server record by timestamp + provider
    const allRecords: UsageRecord[] = [];
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (!msg.cost || msg.role !== "assistant") continue;
        allRecords.push({
          id: msg.id,
          timestamp: msg.timestamp,
          provider_id: msg.provider ?? "unknown",
          provider_name: msg.provider_name ?? "Unknown",
          tier: msg.tier ?? "unknown",
          cost: msg.cost,
          tokens: msg.tokens ?? { input: 0, output: 0 },
          conversation_id: conv.id,
        });
      }
    }

    const used = new Set<number>(); // track which server records are already matched
    for (const rec of allRecords) {
      let bestIdx = -1;
      let bestDelta = Infinity;
      serverWithHash.forEach((sr, idx) => {
        if (used.has(idx)) return;
        if (sr.providerId !== rec.provider_id) return;
        const delta = Math.abs(sr.timestamp - rec.timestamp);
        if (delta < 5000 && delta < bestDelta) {
          bestDelta = delta;
          bestIdx = idx;
        }
      });
      if (bestIdx >= 0) {
        result[rec.id] = serverWithHash[bestIdx]!.txHash!;
        used.add(bestIdx);
      }
    }
    return result;
  }, [serverUsage, conversations]);

  // Find most used provider
  const topProvider = useMemo(() => {
    const entries = Object.entries(summary.byProvider);
    if (entries.length === 0) return "N/A";
    entries.sort((a, b) => b[1].requestCount - a[1].requestCount);
    return entries[0][1].provider_name;
  }, [summary]);

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
      <h2 className="text-xl font-semibold">Usage & Billing</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total Cost" value={`$${summary.totalCost.toFixed(4)}`} color="text-yellow-400" />
        <SummaryCard label="Charged (USDC)" value={`$${summary.totalCharged.toFixed(4)}`} color="text-green-400" />
        <SummaryCard label="Requests" value={summary.requestCount.toString()} color="text-blue-400" />
        <SummaryCard label="Tokens" value={`${(summary.tokenCount.input + summary.tokenCount.output).toLocaleString()}`} color="text-gray-300" />
        <SummaryCard label="Top Provider" value={topProvider} color="text-purple-400" />
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-800 p-4">
        <BillingFilters
          conversations={conversations}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      {/* Charts */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-800 p-4">
        <BillingChart summary={summary} />
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-300">Usage Records</h3>
        </div>
        <BillingTable records={records} txHashMap={txHashMap} />
      </div>

      {/* ZK Verification */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-800">
        <ZkVerification />
      </div>

      {/* Blockchain History */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-800">
        <BlockchainHistory />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-800 p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}

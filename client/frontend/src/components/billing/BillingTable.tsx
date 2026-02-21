import { useState, useMemo } from "react";
import type { UsageRecord } from "../../types";

interface BillingTableProps {
  records: UsageRecord[];
  /** Map from UsageRecord.id to x402 payment tx hash (from server /usage endpoint) */
  txHashMap?: Record<string, string>;
}

type SortKey = "timestamp" | "provider_name" | "tier" | "tokens_in" | "tokens_out" | "input_cost" | "output_cost" | "actual_total" | "charged";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

function getSortValue(rec: UsageRecord, key: SortKey): number | string {
  switch (key) {
    case "timestamp": return rec.timestamp;
    case "provider_name": return rec.provider_name;
    case "tier": return rec.tier;
    case "tokens_in": return rec.tokens.input;
    case "tokens_out": return rec.tokens.output;
    case "input_cost": return rec.cost.input_cost;
    case "output_cost": return rec.cost.output_cost;
    case "actual_total": return rec.cost.actual_total;
    case "charged": return rec.cost.charged;
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BillingTable({ records, txHashMap = {} }: BillingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [records, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const headerClass = "px-3 py-2 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none";
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " \u2191" : " \u2193") : "");

  if (records.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        No usage records for this period
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              <th className={headerClass} onClick={() => handleSort("timestamp")}>Date/Time{arrow("timestamp")}</th>
              <th className={headerClass} onClick={() => handleSort("provider_name")}>Provider{arrow("provider_name")}</th>
              <th className={headerClass} onClick={() => handleSort("tier")}>Tier{arrow("tier")}</th>
              <th className={headerClass} onClick={() => handleSort("tokens_in")}>Tokens In{arrow("tokens_in")}</th>
              <th className={headerClass} onClick={() => handleSort("tokens_out")}>Tokens Out{arrow("tokens_out")}</th>
              <th className={headerClass} onClick={() => handleSort("input_cost")}>Input Cost{arrow("input_cost")}</th>
              <th className={headerClass} onClick={() => handleSort("output_cost")}>Output Cost{arrow("output_cost")}</th>
              <th className={headerClass} onClick={() => handleSort("actual_total")}>Total{arrow("actual_total")}</th>
              <th className={headerClass} onClick={() => handleSort("charged")}>Charged{arrow("charged")}</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Tx Hash</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((rec, i) => (
              <tr
                key={rec.id}
                className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}`}
              >
                <td className="px-3 py-2 text-gray-300">{formatTime(rec.timestamp)}</td>
                <td className="px-3 py-2 text-gray-300">{rec.provider_name}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    rec.tier === "premium" ? "bg-purple-900/50 text-purple-300" :
                    rec.tier === "standard" ? "bg-blue-900/50 text-blue-300" :
                    "bg-green-900/50 text-green-300"
                  }`}>
                    {rec.tier}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-gray-400">{rec.tokens.input.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-gray-400">{rec.tokens.output.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-gray-400">${rec.cost.input_cost.toFixed(4)}</td>
                <td className="px-3 py-2 font-mono text-gray-400">${rec.cost.output_cost.toFixed(4)}</td>
                <td className="px-3 py-2 font-mono text-yellow-400">${rec.cost.actual_total.toFixed(4)}</td>
                <td className="px-3 py-2 font-mono text-green-400">${rec.cost.charged.toFixed(4)}</td>
                <td className="px-3 py-2">
                  {txHashMap[rec.id] ? (
                    <a
                      href={`https://sepolia.basescan.org/tx/${txHashMap[rec.id]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-xs font-mono"
                    >
                      {txHashMap[rec.id]!.slice(0, 10)}...{txHashMap[rec.id]!.slice(-8)} ↗
                    </a>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
          <span>
            Page {page + 1} of {totalPages} ({sorted.length} records)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { Conversation, UsagePeriod, UsageFilter } from "../types";
import { useUsageData } from "../hooks/useUsageData";

interface HeaderCostDisplayProps {
  conversations: Conversation[];
  onNavigateToBilling: () => void;
}

const PERIODS: UsagePeriod[] = ["daily", "weekly", "monthly"];
const PERIOD_LABELS: Record<UsagePeriod, string> = {
  daily: "Today",
  weekly: "7 days",
  monthly: "30 days",
};

export default function HeaderCostDisplay({ conversations, onNavigateToBilling }: HeaderCostDisplayProps) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = PERIODS[periodIdx];

  const filter: UsageFilter = { period };
  const summary = useUsageData(conversations, filter);

  const cyclePeriod = () => {
    setPeriodIdx((i) => (i + 1) % PERIODS.length);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-yellow-400 font-mono text-sm">
        ${summary.totalCost.toFixed(4)}
      </span>
      <button
        onClick={cyclePeriod}
        className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
      >
        {PERIOD_LABELS[period]}
      </button>
      <button
        onClick={onNavigateToBilling}
        className="text-gray-400 hover:text-white transition-colors"
        title="View billing details"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </div>
  );
}

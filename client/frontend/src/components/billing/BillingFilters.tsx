import { useState, useMemo } from "react";
import type { Conversation, UsageFilter, UsagePeriod } from "../../types";

interface BillingFiltersProps {
  conversations: Conversation[];
  filter: UsageFilter;
  onFilterChange: (filter: UsageFilter) => void;
}

const PERIODS: { value: UsagePeriod | "custom"; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

export default function BillingFilters({ conversations, filter, onFilterChange }: BillingFiltersProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Derive available providers from conversation data
  const providers = useMemo(() => {
    const map = new Map<string, string>();
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (msg.provider && msg.provider_name) {
          map.set(msg.provider, msg.provider_name);
        }
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [conversations]);

  const allSelected = !filter.providerIds || filter.providerIds.length === 0;

  const handlePeriodClick = (p: UsagePeriod | "custom") => {
    if (p === "custom") {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      onFilterChange({ ...filter, period: p, dateRange: undefined });
    }
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 86400000 - 1; // end of day
      onFilterChange({ ...filter, dateRange: { start, end } });
    }
  };

  const handleToggleAll = () => {
    // Always reset to show all providers
    onFilterChange({ ...filter, providerIds: undefined });
  };

  const handleToggleProvider = (pid: string) => {
    const current = filter.providerIds ?? providers.map((p) => p.id);
    const next = current.includes(pid)
      ? current.filter((id) => id !== pid)
      : [...current, pid];
    onFilterChange({ ...filter, providerIds: next.length === providers.length ? undefined : next });
  };

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Period:</span>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodClick(p.value)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                (p.value === "custom" && isCustom) ||
                (p.value !== "custom" && !isCustom && filter.period === p.value)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {isCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!startDate || !endDate}
            className="px-3 py-1 rounded text-xs bg-blue-600 text-white disabled:bg-gray-700 disabled:text-gray-500"
          >
            Apply
          </button>
        </div>
      )}

      {/* Provider filter */}
      {providers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Provider:</span>
          <button
            onClick={handleToggleAll}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              allSelected
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            All
          </button>
          {providers.map((p) => {
            const isActive = allSelected || (filter.providerIds?.includes(p.id) ?? false);
            return (
              <button
                key={p.id}
                onClick={() => handleToggleProvider(p.id)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  isActive
                    ? "bg-gray-700 text-gray-200"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

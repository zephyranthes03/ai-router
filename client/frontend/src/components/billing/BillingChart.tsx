import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { UsageSummary } from "../../types";

interface BillingChartProps {
  summary: UsageSummary;
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316",
];

export default function BillingChart({ summary }: BillingChartProps) {
  const providers = Object.entries(summary.byProvider);

  // Provider IDs for stacked bars
  const providerIds = Object.keys(summary.byProvider);
  const providerNames: Record<string, string> = {};
  for (const [id, data] of providers) {
    providerNames[id] = data.provider_name;
  }

  // Build stacked bar data: each date bucket has a key per provider
  const barData = summary.byDate.map((bucket) => {
    const row: Record<string, string | number> = { date: bucket.date };
    for (const pid of providerIds) {
      row[pid] = bucket.byProvider[pid] ?? 0;
    }
    return row;
  });

  // Pie data
  const pieData = providers.map(([, data]) => ({
    name: data.provider_name,
    value: Math.round(data.totalCost * 10000) / 10000,
  }));

  if (summary.requestCount === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        No usage data for this period
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bar Chart — cost over time */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Cost Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "#374151" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "#374151" }}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  color: "#e5e7eb",
                  fontSize: 12,
                }}
                formatter={(value) => [`$${Number(value ?? 0).toFixed(4)}`, "Cost"]}
              />
              {providerIds.map((pid, i) => (
                <Bar
                  key={pid}
                  dataKey={pid}
                  name={providerNames[pid] ?? pid}
                  stackId="cost"
                  fill={COLORS[i % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart — cost by provider */}
      {pieData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Cost by Provider</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} (${((percent ?? 0) * 100).toFixed(1)}%)`
                  }
                  labelLine={{ stroke: "#6b7280" }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    color: "#e5e7eb",
                    fontSize: 12,
                  }}
                  formatter={(value) => [`$${Number(value ?? 0).toFixed(4)}`, "Cost"]}
                />
                <Legend
                  wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

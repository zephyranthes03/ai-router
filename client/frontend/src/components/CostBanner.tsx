import type { CostInfo } from "../types";

interface CostBannerProps {
  cost: CostInfo;
}

export default function CostBanner({ cost }: CostBannerProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
      <span>
        Charged: <span className="text-yellow-400 font-mono">${cost.charged.toFixed(4)}</span>
      </span>
      <span>
        Actual: <span className="text-gray-300 font-mono">${cost.actual_total.toFixed(4)}</span>
      </span>
      <span className="text-gray-600">
        (in: ${cost.input_cost.toFixed(4)} / out: ${cost.output_cost.toFixed(4)})
      </span>
    </div>
  );
}

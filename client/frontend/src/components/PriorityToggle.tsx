import type { TierName } from "../types/tier";

export type { TierName };

interface PriorityToggleProps {
  tier: TierName;
  speedQualityWeight: number;
  onTierChange: (t: TierName) => void;
  onWeightChange: (w: number) => void;
}

const TIERS: { value: TierName; label: string; color: string; price: string }[] = [
  { value: "budget", label: "Budget", color: "bg-green-600", price: "≤$0.001" },
  { value: "standard", label: "Standard", color: "bg-blue-600", price: "≤$0.01" },
  { value: "premium", label: "Premium", color: "bg-purple-600", price: "≤$0.03" },
];

export default function PriorityToggle({
  tier,
  speedQualityWeight,
  onTierChange,
  onWeightChange,
}: PriorityToggleProps) {
  const weightLabel =
    speedQualityWeight <= 20
      ? "Speed"
      : speedQualityWeight >= 80
        ? "Quality"
        : "Balanced";

  return (
    <div className="flex items-center gap-3">
      {/* Tier Selector */}
      <div className="flex gap-0.5 bg-gray-800 rounded p-0.5">
        {TIERS.map((t) => (
          <button
            key={t.value}
            onClick={() => onTierChange(t.value)}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              tier === t.value
                ? `${t.color} text-white`
                : "text-gray-400 hover:text-gray-200"
            }`}
            title={t.price}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Speed ↔ Quality Slider */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-yellow-400 font-medium w-8 text-right">Spd</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={speedQualityWeight}
          onChange={(e) => onWeightChange(Number(e.target.value))}
          className="w-20 h-1 accent-indigo-500 cursor-pointer"
          title={`${weightLabel} (${speedQualityWeight})`}
        />
        <span className="text-[10px] text-purple-400 font-medium w-8">Qlty</span>
      </div>
    </div>
  );
}

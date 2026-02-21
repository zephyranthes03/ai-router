interface ProviderBadgeProps {
  name: string;
  tier: string;
  price?: string;
}

const TIER_COLORS: Record<string, string> = {
  budget: "bg-green-900/50 text-green-400 border-green-800",
  standard: "bg-blue-900/50 text-blue-400 border-blue-800",
  premium: "bg-purple-900/50 text-purple-400 border-purple-800",
};

export default function ProviderBadge({ name, tier, price }: ProviderBadgeProps) {
  const colors = TIER_COLORS[tier] || TIER_COLORS.standard;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${colors}`}>
      <span className="font-medium">{name}</span>
      {price && <span className="opacity-75">{price}</span>}
    </span>
  );
}

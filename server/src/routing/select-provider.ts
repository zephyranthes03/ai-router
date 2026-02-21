import { PROVIDERS, type TierName, type ProviderInfo } from "../utils/pricing.js";

export interface RoutingMetadata {
  context_length: number;
  domain: string;
  tier: TierName;
  speed_quality_weight: number;
  requires_thinking: boolean;
  requires_web_search: boolean;
}

interface ScoredProvider {
  id: string;
  provider: ProviderInfo;
  finalScore: number;
  reasons: string[];
}

export interface RoutingRecommendation {
  id: string;
  name: string;
  x402_price: string;
  reasoning: string;
  candidates: Array<{
    id: string;
    name: string;
    speed_score: number;
    quality_score: number;
    final_score: number;
  }>;
}

/**
 * Select the best provider based on tier filter + speed/quality weighted scoring.
 *
 *   tier                 -> hard filter (only providers in this tier)
 *   speed_quality_weight -> 0 = pure speed, 100 = pure quality
 */
export function selectProvider(metadata: RoutingMetadata): RoutingRecommendation {
  const speedW = (100 - metadata.speed_quality_weight) / 100;
  const qualityW = metadata.speed_quality_weight / 100;

  // Step 1: Filter by tier
  let eligible = Object.entries(PROVIDERS).filter(
    ([_, p]) => p.tier === metadata.tier
  );

  // Step 2: Filter by capability requirements
  eligible = eligible.filter(([_, provider]) => {
    if (metadata.requires_thinking && !provider.capabilities.extended_thinking) {
      return false;
    }
    if (metadata.requires_web_search && !provider.capabilities.web_search) {
      return false;
    }
    if (metadata.context_length > provider.capabilities.max_context) {
      return false;
    }
    return true;
  });

  // If no providers match after capability filter, relax tier constraint upward
  if (eligible.length === 0) {
    const tierOrder: TierName[] = ["budget", "standard", "premium"];
    const currentIdx = tierOrder.indexOf(metadata.tier);
    for (let i = currentIdx + 1; i < tierOrder.length; i++) {
      eligible = Object.entries(PROVIDERS).filter(([_, p]) => {
        if (p.tier !== tierOrder[i]) return false;
        if (metadata.requires_thinking && !p.capabilities.extended_thinking) return false;
        if (metadata.requires_web_search && !p.capabilities.web_search) return false;
        if (metadata.context_length > p.capabilities.max_context) return false;
        return true;
      });
      if (eligible.length > 0) break;
    }
  }

  // Ultimate fallback
  if (eligible.length === 0) {
    const fallback = PROVIDERS["claude_sonnet"];
    if (!fallback) {
      throw new Error("Fallback provider not configured: claude_sonnet");
    }
    return {
      id: "claude_sonnet",
      name: fallback.name,
      x402_price: fallback.x402_price,
      reasoning: "Fallback: no providers matched tier + capability requirements",
      candidates: [],
    };
  }

  // Step 3: Weighted scoring
  const scored: ScoredProvider[] = eligible.map(([id, provider]) => {
    const reasons: string[] = [];
    let baseScore =
      provider.scores.speed * speedW + provider.scores.quality * qualityW;

    reasons.push(
      `speed ${provider.scores.speed}x${speedW.toFixed(2)} + quality ${provider.scores.quality}x${qualityW.toFixed(2)} = ${baseScore.toFixed(1)}`
    );

    // Domain matching bonus
    if (
      metadata.domain !== "general" &&
      provider.capabilities.domains.includes(metadata.domain)
    ) {
      baseScore += 15;
      reasons.push(`+15 domain match (${metadata.domain})`);
    }

    return { id, provider, finalScore: baseScore, reasons };
  });

  // Step 4: Sort by score descending
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const winner = scored[0];
  if (!winner) {
    throw new Error("No eligible provider after scoring");
  }

  return {
    id: winner.id,
    name: winner.provider.name,
    x402_price: winner.provider.x402_price,
    reasoning: `Selected ${winner.provider.name} (tier=${metadata.tier}, weight=${metadata.speed_quality_weight}): ${winner.reasons.join(", ")}`,
    candidates: scored.map((s) => ({
      id: s.id,
      name: s.provider.name,
      speed_score: s.provider.scores.speed,
      quality_score: s.provider.scores.quality,
      final_score: Math.round(s.finalScore * 10) / 10,
    })),
  };
}

"""Routing types used by server_router and fallback_engine."""

from dataclasses import dataclass


@dataclass
class RoutingMetadata:
    """Metadata sent to server's POST /route."""

    domain: str  # "code" | "writing" | "analysis" | "math" | "reasoning" | "simple_qa"
    tier: str  # "budget" | "standard" | "premium"
    speed_quality_weight: int  # 0 (pure speed) .. 100 (pure quality)
    requires_thinking: bool
    requires_web_search: bool
    context_length: int  # approximate token count of user message


@dataclass
class ProviderSelection:
    """Selected provider for routing."""

    provider_id: str  # e.g., "claude_sonnet"
    provider_name: str  # e.g., "Claude Sonnet 4.5"
    tier: str  # "budget" | "standard" | "premium"
    x402_price: str  # "$0.01"
    endpoint: str  # "/request/claude_sonnet"
    reasoning: str  # Why this provider was selected
    source: str  # "server" | "fallback"


@dataclass
class RoutingResult:
    """Final routing result with provider selection."""

    selected: ProviderSelection
    analysis_source: str  # "llama" | "fallback" (how routing_metadata was generated)
    requires_web_search: bool = False

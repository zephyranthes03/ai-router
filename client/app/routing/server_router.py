"""Server-side routing via POST /route endpoint."""

import logging

import httpx

from app.config.constants import GATEWAY_SERVER_URL
from app.routing.types import RoutingMetadata, ProviderSelection

logger = logging.getLogger(__name__)


class ServerRouteError(Exception):
    """Error calling server's POST /route."""

    pass


class ServerRouter:
    """Routes via server's POST /route endpoint. Primary routing method."""

    def __init__(self, server_url: str = GATEWAY_SERVER_URL) -> None:
        self.server_url = server_url

    async def route(self, metadata: RoutingMetadata) -> ProviderSelection:
        """Send routing_metadata to server and get recommended provider.

        Server response: {
            recommended_provider: str,
            provider_name: str,
            x402_price: str,
            endpoint: str,
            reasoning: str
        }
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.server_url}/route",
                json={
                    "routing_metadata": {
                        "context_length": metadata.context_length,
                        "domain": metadata.domain,
                        "tier": metadata.tier,
                        "speed_quality_weight": metadata.speed_quality_weight,
                        "requires_thinking": metadata.requires_thinking,
                        "requires_web_search": metadata.requires_web_search,
                    }
                },
                timeout=5.0,
            )

            if resp.status_code != 200:
                raise ServerRouteError(f"POST /route returned {resp.status_code}")

            data = resp.json()
            return ProviderSelection(
                provider_id=data["recommended_provider"],
                provider_name=data["provider_name"],
                tier=self._tier_from_price(data["x402_price"]),
                x402_price=data["x402_price"],
                endpoint=data["endpoint"],
                reasoning=data["reasoning"],
                source="server",
            )

    @staticmethod
    def _tier_from_price(x402_price: str) -> str:
        """Infer tier from x402 price string."""
        price_map = {
            "$0.001": "budget",
            "$0.01": "standard",
            "$0.02": "premium",
            "$0.03": "premium",
        }
        return price_map.get(x402_price, "standard")

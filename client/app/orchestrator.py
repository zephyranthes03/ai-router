"""Analysis orchestrator: regex -> Presidio -> keyword routing -> server POST /route."""

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from app.config.constants import GATEWAY_SERVER_URL
from app.config.settings import UserSettings
from app.pii.presidio_layer import PresidioScanner
from app.pii.regex_layer import RegexPiiScanner
from app.pii.strategies import PiiDetection
from app.routing.fallback_engine import FallbackRouter
from app.routing.server_router import ServerRouter, ServerRouteError
from app.routing.types import RoutingMetadata, RoutingResult

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Complete result of the analysis pipeline."""

    original_message: str
    masked_message: str
    pii_detections: list[PiiDetection]
    mask_map: dict[str, str]
    routing: RoutingResult
    analysis_source: str  # "presidio" | "regex"


def merge_detections(
    base: list[PiiDetection], new: list[PiiDetection]
) -> list[PiiDetection]:
    """Merge two detection lists, preferring higher severity on overlap."""
    severity_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    result = list(base)

    for det in new:
        overlapping = False
        for i, existing in enumerate(result):
            if det.start < existing.end and det.end > existing.start:
                overlapping = True
                new_rank = severity_rank.get(det.severity, 0)
                existing_rank = severity_rank.get(existing.severity, 0)
                if new_rank > existing_rank:
                    result[i] = det
                break
        if not overlapping:
            result.append(det)

    result.sort(key=lambda d: d.start)
    return result


class AnalysisOrchestrator:
    """Full analysis pipeline: PII scan -> keyword routing -> server routing.

    PII detection:
      1. Regex layer  — structured patterns (email, SSN, credit card, …) ~0 ms
      2. Presidio     — contextual NER (PERSON, PHONE_NUMBER)             ~10 ms

    Routing classification (keyword-based, instant):
      - domain        via FallbackRouter._classify_domain()
      - needs_web_search via FallbackRouter._needs_web_search()
      - needs_thinking  from settings.extended_thinking (user preference)
    """

    def __init__(self, settings: UserSettings) -> None:
        self.regex_scanner = RegexPiiScanner()
        self.presidio = PresidioScanner()
        self.server_router = ServerRouter(
            server_url=settings.server_url or GATEWAY_SERVER_URL
        )
        self.fallback_router = FallbackRouter()
        self.settings = settings

    async def analyze(
        self,
        user_message: str,
        tier: Optional[str] = None,
        speed_quality_weight: Optional[int] = None,
    ) -> AnalysisResult:
        """Run the full analysis pipeline."""
        effective_tier = tier or self.settings.tier
        effective_sqw = (
            speed_quality_weight
            if speed_quality_weight is not None
            else self.settings.speed_quality_weight
        )

        # Step 1: Regex PII scan (instant, structured patterns)
        regex_result = self.regex_scanner.scan(user_message)

        # Step 2: Presidio contextual PII scan (~10 ms, synchronous NER)
        presidio_detections = self.presidio.scan(user_message)
        analysis_source = "presidio" if self.presidio.is_available else "regex"

        # Step 3: Merge detections (regex wins on overlap by severity)
        all_pii = merge_detections(regex_result.detections, presidio_detections)

        # Step 4: Apply masking per pii_mode setting
        masked = self.regex_scanner.mask_text(
            user_message, all_pii, self.settings.pii_mode
        )

        # Step 5: Keyword-based routing classification (instant)
        text_lower = user_message.lower()
        domain = self.fallback_router._classify_domain(text_lower)
        needs_web_search = self.settings.web_search or self.fallback_router._needs_web_search(
            text_lower
        )

        routing_metadata = RoutingMetadata(
            domain=domain,
            tier=effective_tier,
            speed_quality_weight=effective_sqw,
            requires_thinking=self.settings.extended_thinking,
            requires_web_search=needs_web_search,
            context_length=len(user_message.split()),
        )

        # Step 6: Route via server or local fallback
        try:
            routing = RoutingResult(
                selected=await self.server_router.route(routing_metadata),
                analysis_source=analysis_source,
                requires_web_search=needs_web_search,
            )
        except (ServerRouteError, httpx.ConnectError, httpx.TimeoutException) as e:
            logger.warning(f"Server POST /route failed, using fallback: {e}")
            routing = RoutingResult(
                selected=self.fallback_router.route(
                    message=user_message,
                    tier=effective_tier,
                    speed_quality_weight=effective_sqw,
                ),
                analysis_source="fallback",
                requires_web_search=needs_web_search,
            )

        return AnalysisResult(
            original_message=user_message,
            masked_message=masked.masked,
            pii_detections=all_pii,
            mask_map=masked.mask_map,
            routing=routing,
            analysis_source=analysis_source,
        )

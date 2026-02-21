"""POST /analyze — run PII + routing analysis on a user message."""

from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.pii.patterns import PII_PATTERNS

router = APIRouter()


class AnalyzeRequest(BaseModel):
    message: str
    tier: Optional[str] = None
    speed_quality_weight: Optional[int] = None


def _get_action(severity: str, pii_mode: str) -> str:
    """Mirror regex_layer.mask_text action logic."""
    if pii_mode == "none":
        return "pass"
    if pii_mode == "user_select":
        # Show all detections in popup — treat like strict for masked_count
        return "mask"
    if pii_mode == "permissive" and severity in ("low", "medium", "high"):
        return "pass"
    return "mask"


class PiiDetectionResponse(BaseModel):
    type: str
    value: str
    start: int
    end: int
    category: str
    severity: str
    source: str
    action: str  # "mask" or "pass"
    placeholder: Optional[str] = None


class PiiReportResponse(BaseModel):
    detections: list[PiiDetectionResponse]
    count: int
    masked_count: int
    has_critical: bool


class RoutingResponse(BaseModel):
    provider_id: str
    provider_name: str
    tier: str
    x402_price: str
    endpoint: str
    reasoning: str
    source: str
    requires_web_search: bool = False


class AnalyzeResponse(BaseModel):
    masked_text: str
    pii_report: PiiReportResponse
    routing: RoutingResponse
    mask_map: dict[str, str]
    strict_masked_text: str


@router.post("/", response_model=AnalyzeResponse)
async def analyze_message(body: AnalyzeRequest, request: Request):
    """Run the full analysis pipeline on a user message."""
    orchestrator = request.app.state.orchestrator
    result = await orchestrator.analyze(body.message, body.tier, body.speed_quality_weight)

    pii_mode = orchestrator.settings.pii_mode
    detections = [
        PiiDetectionResponse(
            type=d.type,
            value=d.value,
            start=d.start,
            end=d.end,
            category=d.category,
            severity=d.severity,
            source=d.source,
            action=_get_action(d.severity, pii_mode),
            placeholder=PII_PATTERNS[d.type].placeholder if d.type in PII_PATTERNS else None,
        )
        for d in result.pii_detections
    ]

    masked_count = sum(1 for det in detections if det.action == "mask")
    has_critical = any(d.severity == "critical" for d in result.pii_detections)

    strict_masked_text = orchestrator.regex_scanner.mask_text(
        body.message, result.pii_detections, "strict"
    ).masked

    return AnalyzeResponse(
        masked_text=result.masked_message,
        pii_report=PiiReportResponse(
            detections=detections,
            count=len(detections),
            masked_count=masked_count,
            has_critical=has_critical,
        ),
        routing=RoutingResponse(
            provider_id=result.routing.selected.provider_id,
            provider_name=result.routing.selected.provider_name,
            tier=result.routing.selected.tier,
            x402_price=result.routing.selected.x402_price,
            endpoint=result.routing.selected.endpoint,
            reasoning=result.routing.selected.reasoning,
            source=result.routing.selected.source,
            requires_web_search=result.routing.requires_web_search,
        ),
        mask_map=result.mask_map,
        strict_masked_text=strict_masked_text,
    )

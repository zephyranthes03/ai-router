"""Parse Llama 3.2 JSON response into structured result."""

import json
import re
from dataclasses import dataclass, field
from typing import Optional

from app.pii.strategies import PiiDetection


@dataclass
class RoutingAnalysis:
    """Routing classification from Llama."""

    domain: str = "simple_qa"
    complexity: str = "medium"
    needs_thinking: bool = False
    needs_web_search: bool = False


@dataclass
class LlamaAnalysis:
    """Full parsed result from Llama unified analysis."""

    masked_text: str = ""
    pii_detections: list[PiiDetection] = field(default_factory=list)
    pii_actions: list[dict] = field(default_factory=list)
    routing: RoutingAnalysis = field(default_factory=RoutingAnalysis)
    parse_success: bool = False
    raw_response: str = ""


def parse_llama_response(raw: str) -> LlamaAnalysis:
    """Parse Llama JSON output into LlamaAnalysis.

    Tries 3 strategies:
    1. Direct JSON parse
    2. Extract from code block
    3. Regex extraction of key fields
    """
    result = LlamaAnalysis(raw_response=raw)

    # Strategy 1: Direct JSON parse
    data = _try_parse_json(raw)

    # Strategy 2: Extract from code block
    if data is None:
        code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if code_block:
            data = _try_parse_json(code_block.group(1))

    # Strategy 3: Find first { ... } block
    if data is None:
        brace_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if brace_match:
            data = _try_parse_json(brace_match.group())

    if data is None:
        return result  # parse_success = False

    try:
        # Parse PII
        pii_data = data.get("pii", {})
        additional = pii_data.get("additional", [])
        actions_by_value = {
            a.get("value", ""): a.get("action", "mask")
            for a in pii_data.get("actions", [])
        }
        for item in additional:
            value = item.get("value", "")
            # Skip items the LLM itself decided to pass — they aren't real PII
            if actions_by_value.get(value) == "pass":
                continue
            result.pii_detections.append(
                PiiDetection(
                    type=item.get("type", "other"),
                    value=value,
                    start=item.get("start", 0),
                    end=item.get("end", 0),
                    category="llm_detected",
                    severity="high",
                    source="llama",
                    confidence=0.8,
                )
            )

        result.pii_actions = pii_data.get("actions", [])

        # Parse routing
        routing_data = data.get("routing", {})
        result.routing = RoutingAnalysis(
            domain=routing_data.get("domain", "simple_qa"),
            complexity=routing_data.get("complexity", "medium"),
            needs_thinking=routing_data.get("needs_thinking", False),
            needs_web_search=routing_data.get("needs_web_search", False),
        )

        # Parse masked text
        result.masked_text = data.get("masked_text", "")
        result.parse_success = True

    except (KeyError, TypeError, AttributeError):
        result.parse_success = False

    return result


def _try_parse_json(text: str) -> Optional[dict]:
    """Attempt to parse JSON, return None on failure."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None

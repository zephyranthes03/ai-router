"""0G Compute Network inference adapter for AI-powered routing classification.

Calls a 0G-hosted LLM to classify routing metadata (domain, complexity,
requires_web_search, requires_thinking) from the user's message.
Falls back gracefully if 0G is unavailable.
"""

import json
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

CLASSIFICATION_PROMPT = """Classify this AI assistant request for optimal provider routing.
Respond ONLY with a JSON object — no markdown, no extra text.

Message: {message}

JSON schema:
{{
  "domain": "code" | "math" | "reasoning" | "writing" | "analysis" | "simple_qa",
  "complexity": "simple" | "moderate" | "complex",
  "requires_web_search": true | false,
  "requires_thinking": true | false,
  "confidence": 0.0-1.0
}}"""


@dataclass
class ZeroGClassification:
    domain: str
    complexity: str
    requires_web_search: bool
    requires_thinking: bool
    confidence: float
    model_used: str


class ZeroGInferenceAdapter:
    """OpenAI-compatible client targeting 0G Compute Network inference endpoints."""

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    async def classify(self, message: str) -> Optional[ZeroGClassification]:
        """
        Send a classification request to 0G inference.
        Returns None on any error so the caller can fall back to local logic.
        """
        prompt = CLASSIFICATION_PROMPT.format(message=message[:600])
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 200,
                        "temperature": 0.1,
                    },
                )
                if resp.status_code != 200:
                    logger.warning(
                        "[0G] Inference returned %s: %s", resp.status_code, resp.text[:200]
                    )
                    return None

                content = resp.json()["choices"][0]["message"]["content"].strip()
                # Strip markdown code fences if present
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                data = json.loads(content)
                return ZeroGClassification(
                    domain=data.get("domain", "simple_qa"),
                    complexity=data.get("complexity", "moderate"),
                    requires_web_search=bool(data.get("requires_web_search", False)),
                    requires_thinking=bool(data.get("requires_thinking", False)),
                    confidence=float(data.get("confidence", 0.8)),
                    model_used=self.model,
                )
        except Exception as exc:
            logger.warning("[0G] Inference failed (%s), using local classification", exc)
            return None

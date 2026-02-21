"""Unified Llama 3.2 analyzer: PII + routing in one Ollama call."""

import logging
from typing import Optional

import httpx

from app.llm.prompt import build_prompt
from app.llm.parser import parse_llama_response, LlamaAnalysis
from app.pii.strategies import PiiDetection

logger = logging.getLogger(__name__)


class OllamaError(Exception):
    """Error communicating with Ollama."""

    pass


class LlamaAnalyzer:
    """Single Ollama call for unified PII + routing analysis."""

    def __init__(self, ollama_url: str, model: str) -> None:
        self.ollama_url = ollama_url
        self.model = model
        self._available: Optional[bool] = None

    async def check_availability(self) -> bool:
        """Check if Ollama is running and has the required model."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.ollama_url}/api/tags",
                    timeout=3.0,
                )
                if resp.status_code != 200:
                    self._available = False
                    return False

                models = [m["name"] for m in resp.json().get("models", [])]
                self._available = any(self.model in m for m in models)
                return self._available

        except (httpx.ConnectError, httpx.TimeoutException):
            self._available = False
            return False

    async def analyze(
        self,
        user_message: str,
        regex_detections: list[PiiDetection],
        tier: str = "standard",
    ) -> LlamaAnalysis:
        """Run unified analysis: PII + routing in one Ollama call."""
        prompt = build_prompt(user_message, regex_detections, tier)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 1024,
                        },
                    },
                    timeout=15.0,
                )

                if resp.status_code != 200:
                    raise OllamaError(f"Ollama returned {resp.status_code}")

                raw = resp.json()["response"]
                return parse_llama_response(raw)

        except httpx.ConnectError as e:
            raise OllamaError(f"Cannot connect to Ollama: {e}") from e
        except httpx.TimeoutException as e:
            raise OllamaError(f"Ollama request timed out: {e}") from e

    @property
    def is_available(self) -> bool:
        return self._available is True

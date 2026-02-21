import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.config.settings import UserSettings
from app.llm.zero_g import ZeroGClassification
from app.orchestrator import AnalysisOrchestrator
from app.routing.types import ProviderSelection


class _StubRegexPiiScanner:
    def scan(self, text: str):
        return SimpleNamespace(detections=[])

    def mask_text(self, text: str, detections, pii_mode: str):
        return SimpleNamespace(masked=f"masked::{text}", mask_map={})


class _StubPresidioScanner:
    is_available = True

    def scan(self, text: str):
        return []


class _StubServerRouter:
    last_metadata = None

    def __init__(self, server_url: str):
        self.server_url = server_url

    async def route(self, metadata):
        _StubServerRouter.last_metadata = metadata
        return ProviderSelection(
            provider_id="stub_provider",
            provider_name="Stub Provider",
            tier="standard",
            x402_price="$0.01",
            endpoint="/request/stub_provider",
            reasoning="test routing result",
            source="server",
        )


class _StubFallbackRouter:
    def _classify_domain(self, text_lower: str) -> str:
        return "fallback_domain"

    def _needs_web_search(self, text_lower: str) -> bool:
        return True

    def route(self, message: str, tier: str = "standard", speed_quality_weight: int = 50):
        return ProviderSelection(
            provider_id="fallback_provider",
            provider_name="Fallback Provider",
            tier=tier,
            x402_price="$0.01",
            endpoint="/request/fallback_provider",
            reasoning="fallback route",
            source="fallback",
        )


class _StubZeroGAdapterSuccess:
    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def classify(self, message: str):
        return ZeroGClassification(
            domain="code",
            complexity="complex",
            requires_web_search=True,
            requires_thinking=False,
            confidence=0.93,
            model_used=self.model,
        )


class _StubZeroGAdapterNone:
    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def classify(self, message: str):
        return None


class AnalysisOrchestratorZeroGTests(unittest.IsolatedAsyncioTestCase):
    async def test_zero_g_classification_overrides_keyword_classification(self):
        _StubServerRouter.last_metadata = None
        settings = UserSettings(
            use_0g_inference=True,
            zero_g_api_key="test-key",
            extended_thinking=False,
            web_search=False,
            pii_mode="strict",
        )

        with (
            patch("app.orchestrator.RegexPiiScanner", _StubRegexPiiScanner),
            patch("app.orchestrator.PresidioScanner", _StubPresidioScanner),
            patch("app.orchestrator.ServerRouter", _StubServerRouter),
            patch("app.orchestrator.FallbackRouter", _StubFallbackRouter),
            patch("app.orchestrator.ZeroGInferenceAdapter", _StubZeroGAdapterSuccess),
        ):
            orchestrator = AnalysisOrchestrator(settings)
            result = await orchestrator.analyze("write code for a parser")

        self.assertIsNotNone(result.zero_g_result)
        self.assertEqual(result.routing.selected.provider_id, "stub_provider")

        metadata = _StubServerRouter.last_metadata
        self.assertIsNotNone(metadata)
        self.assertEqual(metadata.domain, "code")
        self.assertTrue(metadata.requires_web_search)
        self.assertFalse(metadata.requires_thinking)
        self.assertEqual(metadata.tier, "standard")
        self.assertEqual(metadata.speed_quality_weight, 50)

    async def test_fallback_keyword_classification_is_used_when_zero_g_is_unavailable(self):
        _StubServerRouter.last_metadata = None
        settings = UserSettings(
            use_0g_inference=True,
            zero_g_api_key="test-key",
            extended_thinking=False,
            web_search=False,
            pii_mode="strict",
        )

        with (
            patch("app.orchestrator.RegexPiiScanner", _StubRegexPiiScanner),
            patch("app.orchestrator.PresidioScanner", _StubPresidioScanner),
            patch("app.orchestrator.ServerRouter", _StubServerRouter),
            patch("app.orchestrator.FallbackRouter", _StubFallbackRouter),
            patch("app.orchestrator.ZeroGInferenceAdapter", _StubZeroGAdapterNone),
        ):
            orchestrator = AnalysisOrchestrator(settings)
            result = await orchestrator.analyze("hello world")

        self.assertIsNone(result.zero_g_result)

        metadata = _StubServerRouter.last_metadata
        self.assertIsNotNone(metadata)
        self.assertEqual(metadata.domain, "fallback_domain")
        self.assertTrue(metadata.requires_web_search)
        self.assertFalse(metadata.requires_thinking)


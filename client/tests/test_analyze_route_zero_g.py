import unittest
from types import SimpleNamespace
from typing import Optional

from starlette.requests import Request

from app.api.routes.analyze import AnalyzeRequest, analyze_message
from app.llm.zero_g import ZeroGClassification
from app.orchestrator import AnalysisResult
from app.pii.strategies import PiiDetection
from app.routing.types import ProviderSelection, RoutingResult


class _DummyRegexScanner:
    def mask_text(self, text: str, detections, pii_mode: str):
        return SimpleNamespace(masked=f"strict::{text}", mask_map={})


class _DummyOrchestrator:
    def __init__(self, result: AnalysisResult, pii_mode: str):
        self._result = result
        self.settings = SimpleNamespace(pii_mode=pii_mode)
        self.regex_scanner = _DummyRegexScanner()

    async def analyze(
        self,
        message: str,
        tier: Optional[str] = None,
        speed_quality_weight: Optional[int] = None,
    ):
        return self._result


def _build_result(zero_g_result):
    return AnalysisResult(
        original_message="Contact me at user@example.com",
        masked_message="Contact me at [EMAIL]",
        pii_detections=[
            PiiDetection(
                type="email",
                value="user@example.com",
                start=14,
                end=30,
                category="contact",
                severity="high",
                source="regex",
                confidence=1.0,
            )
        ],
        mask_map={"[EMAIL]": "user@example.com"},
        routing=RoutingResult(
            selected=ProviderSelection(
                provider_id="gpt5",
                provider_name="GPT-5.2",
                tier="standard",
                x402_price="$0.01",
                endpoint="/request/gpt5",
                reasoning="test route",
                source="server",
            ),
            analysis_source="presidio",
            requires_web_search=True,
        ),
        analysis_source="presidio",
        zero_g_result=zero_g_result,
    )


class AnalyzeRouteZeroGTests(unittest.TestCase):
    def _make_request(self, orchestrator: _DummyOrchestrator) -> Request:
        app = SimpleNamespace(state=SimpleNamespace(orchestrator=orchestrator))
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/analyze/",
            "raw_path": b"/analyze/",
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
            "app": app,
        }
        return Request(scope)

    def test_analyze_includes_zero_g_payload_when_available(self):
        result = _build_result(
            ZeroGClassification(
                domain="analysis",
                complexity="complex",
                requires_web_search=True,
                requires_thinking=True,
                confidence=0.95,
                model_used="meta-llama/Meta-Llama-3.1-8B-Instruct",
            )
        )
        request = self._make_request(_DummyOrchestrator(result, pii_mode="user_select"))

        body = analyze_message(
            AnalyzeRequest(message="Contact me at user@example.com"),
            request,
        )
        response = _run_async(body)

        self.assertEqual(response.masked_text, "Contact me at [EMAIL]")
        self.assertEqual(response.pii_report.count, 1)
        self.assertEqual(response.pii_report.masked_count, 1)
        self.assertEqual(response.pii_report.detections[0].action, "mask")
        self.assertEqual(response.strict_masked_text, "strict::Contact me at user@example.com")
        assert response.zero_g is not None
        self.assertEqual(response.zero_g.domain, "analysis")
        self.assertEqual(response.zero_g.model_used, "meta-llama/Meta-Llama-3.1-8B-Instruct")

    def test_analyze_sets_zero_g_to_null_when_not_available(self):
        result = _build_result(None)
        request = self._make_request(_DummyOrchestrator(result, pii_mode="permissive"))

        body = analyze_message(
            AnalyzeRequest(message="Contact me at user@example.com"),
            request,
        )
        response = _run_async(body)

        self.assertIsNone(response.zero_g)
        self.assertEqual(response.pii_report.detections[0].action, "pass")
        self.assertEqual(response.pii_report.masked_count, 0)


def _run_async(coro):
    import asyncio

    return asyncio.run(coro)

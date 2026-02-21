import unittest
from unittest.mock import patch

from app.llm.zero_g import ZeroGInferenceAdapter


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    post_handler = None

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        return await self.__class__.post_handler(*args, **kwargs)


class ZeroGInferenceAdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_classify_parses_json_response(self):
        async def handler(*args, **kwargs):
            return _FakeResponse(
                200,
                {
                    "choices": [
                        {
                            "message": {
                                "content": (
                                    "```json\n"
                                    '{"domain":"analysis","complexity":"complex",'
                                    '"requires_web_search":true,"requires_thinking":true,'
                                    '"confidence":0.91}\n'
                                    "```"
                                )
                            }
                        }
                    ]
                },
            )

        _FakeAsyncClient.post_handler = handler
        adapter = ZeroGInferenceAdapter(
            api_key="test-key",
            model="meta-llama/Meta-Llama-3.1-8B-Instruct",
            base_url="https://api.0g.ai/v1/",
        )

        with patch("app.llm.zero_g.httpx.AsyncClient", _FakeAsyncClient):
            result = await adapter.classify("Need a deep analysis of market data")

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.domain, "analysis")
        self.assertEqual(result.complexity, "complex")
        self.assertTrue(result.requires_web_search)
        self.assertTrue(result.requires_thinking)
        self.assertAlmostEqual(result.confidence, 0.91)
        self.assertEqual(result.model_used, "meta-llama/Meta-Llama-3.1-8B-Instruct")

    async def test_classify_returns_none_on_non_200(self):
        async def handler(*args, **kwargs):
            return _FakeResponse(429, {}, text="rate limited")

        _FakeAsyncClient.post_handler = handler
        adapter = ZeroGInferenceAdapter(
            api_key="test-key",
            model="meta-llama/Meta-Llama-3.1-8B-Instruct",
            base_url="https://api.0g.ai/v1",
        )

        with patch("app.llm.zero_g.httpx.AsyncClient", _FakeAsyncClient):
            result = await adapter.classify("simple question")

        self.assertIsNone(result)

    async def test_classify_returns_none_on_exception(self):
        async def handler(*args, **kwargs):
            raise RuntimeError("network down")

        _FakeAsyncClient.post_handler = handler
        adapter = ZeroGInferenceAdapter(
            api_key="test-key",
            model="meta-llama/Meta-Llama-3.1-8B-Instruct",
            base_url="https://api.0g.ai/v1",
        )

        with patch("app.llm.zero_g.httpx.AsyncClient", _FakeAsyncClient):
            result = await adapter.classify("simple question")

        self.assertIsNone(result)


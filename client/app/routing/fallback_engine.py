"""Fallback routing engine: used ONLY when server's POST /route is unreachable."""

from app.routing.types import ProviderSelection

PROVIDER_CATALOG_FALLBACK = {
    "haiku": {"name": "Claude Haiku 4.5", "tier": "budget", "x402_price": "$0.001", "speed": 95, "quality": 35},
    "deepseek_v3": {"name": "DeepSeek V3.2", "tier": "budget", "x402_price": "$0.001", "speed": 85, "quality": 50},
    "gemini_flash": {"name": "Gemini 3 Flash", "tier": "budget", "x402_price": "$0.001", "speed": 90, "quality": 55},
    "claude_sonnet": {"name": "Claude Sonnet 4.5", "tier": "standard", "x402_price": "$0.01", "speed": 60, "quality": 80},
    "gpt5": {"name": "GPT-5.2", "tier": "standard", "x402_price": "$0.01", "speed": 65, "quality": 78},
    "gemini_pro": {"name": "Gemini 3 Pro", "tier": "standard", "x402_price": "$0.01", "speed": 55, "quality": 82},
    "deepseek_r1": {"name": "DeepSeek R1", "tier": "premium", "x402_price": "$0.02", "speed": 30, "quality": 90},
    "claude_opus": {"name": "Claude Opus 4.5", "tier": "premium", "x402_price": "$0.03", "speed": 25, "quality": 95},
}

KEYWORD_RULES = {
    "code": {
        "keywords": [
            "code", "function", "bug", "error", "debug", "implement", "class",
            "api", "sql", "python", "javascript", "typescript", "rust", "react",
            "npm", "pip", "git", "docker", "deploy", "compile", "import",
            "코드", "함수", "버그", "에러", "디버그", "배포", "컴파일",
        ],
        "domain": "code",
    },
    "math": {
        "keywords": [
            "math", "calculate", "equation", "prove", "formula", "integral",
            "derivative", "statistics", "probability",
            "수학", "계산", "방정식", "증명", "통계", "확률",
        ],
        "domain": "math",
    },
    "reasoning": {
        "keywords": [
            "think", "reason", "analyze", "compare", "evaluate", "consider",
            "argument", "logic", "explain",
            "추론", "논리", "설명해", "비교", "분석",
        ],
        "domain": "reasoning",
    },
    "writing": {
        "keywords": [
            "write", "essay", "email", "letter", "draft", "story", "blog",
            "translate", "summarize", "proofread",
            "작성", "번역", "요약", "교정", "이메일", "블로그", "에세이",
        ],
        "domain": "writing",
    },
    "analysis": {
        "keywords": [
            "analyze", "compare", "strategy", "invest", "finance", "tax",
            "legal", "market", "research",
            "분석", "비교", "전략", "투자", "재무", "세금", "법률", "시장", "리서치",
        ],
        "domain": "analysis",
    },
    "simple_qa": {
        "keywords": [
            "what is", "who is", "when", "where", "define", "meaning",
            "뭐야", "누구", "언제", "어디",
        ],
        "domain": "simple_qa",
    },
}


_WEB_SEARCH_KEYWORDS = {
    # English — real-time / recency signals
    "today", "tonight", "yesterday", "now", "live", "latest", "current",
    "recent", "breaking", "news", "weather", "forecast", "score", "price",
    "stock", "rate", "update", "right now",
    # Weather / environmental
    "temperature", "humidity", "sunrise", "sunset", "uv index", "air quality",
    "pollen", "tide", "wind speed",
    # Korean equivalents
    "오늘", "지금", "현재", "최신", "최근", "뉴스", "날씨", "주가", "환율",
    "기온", "온도", "일출", "일몰", "습도", "미세먼지", "자외선",
}


class FallbackRouter:
    """Used ONLY when server's POST /route is unreachable.
    Mirrors the server's tier + speed/quality scoring logic with hardcoded data.
    """

    def route(
        self,
        message: str,
        tier: str = "standard",
        speed_quality_weight: int = 50,
    ) -> ProviderSelection:
        """Tier-filtered, speed/quality-weighted routing when server is unreachable."""
        domain = self._classify_domain(message.lower())

        candidates = [
            (pid, info)
            for pid, info in PROVIDER_CATALOG_FALLBACK.items()
            if info["tier"] == tier
        ]

        if not candidates:
            candidates = [
                (pid, info)
                for pid, info in PROVIDER_CATALOG_FALLBACK.items()
                if info["tier"] == "standard"
            ]

        speed_w = (100 - speed_quality_weight) / 100
        quality_w = speed_quality_weight / 100

        scored = []
        for pid, info in candidates:
            score = info["speed"] * speed_w + info["quality"] * quality_w
            scored.append((pid, info, score))

        scored.sort(key=lambda x: x[2], reverse=True)
        winner_id, winner_info, _ = scored[0]

        return ProviderSelection(
            provider_id=winner_id,
            provider_name=winner_info["name"],
            tier=winner_info["tier"],
            x402_price=winner_info["x402_price"],
            endpoint=f"/request/{winner_id}",
            reasoning=f"Fallback: {domain} domain, tier={tier}, weight={speed_quality_weight}",
            source="fallback",
        )

    def _classify_domain(self, text_lower: str) -> str:
        """Classify domain by keyword matching."""
        scores = {
            rule["domain"]: sum(1 for kw in rule["keywords"] if kw in text_lower)
            for rule in KEYWORD_RULES.values()
        }
        top = max(scores, key=scores.get)
        return top if scores[top] > 0 else "simple_qa"

    def _needs_web_search(self, text_lower: str) -> bool:
        """Return True if the message likely requires real-time web search."""
        return any(kw in text_lower for kw in _WEB_SEARCH_KEYWORDS)

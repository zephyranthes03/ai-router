"""Presidio-based contextual PII scanner (replaces Llama for PII detection)."""

import logging
import re
from typing import Optional

from app.pii.strategies import PiiDetection

logger = logging.getLogger(__name__)

# Presidio entity → (pii_type, category, severity)
_ENTITY_MAP = {
    "PERSON": ("name", "identity", "high"),
    "PHONE_NUMBER": ("phone", "contact", "high"),
    "LOCATION": ("address", "identity", "medium"),
}

# Minimum confidence score required per entity type
_SCORE_THRESHOLDS = {
    "PERSON": 0.85,
    "PHONE_NUMBER": 0.60,
    "LOCATION": 0.80,
}

# Matches a leading street number: "742 Evergreen Terrace", "10 Downing St", etc.
# General locations like "Denver, Colorado" or "Austin TX" have no leading digit.
_STREET_NUMBER_RE = re.compile(r"^\d+\s+\S")


class PresidioScanner:
    """Contextual PII scanner using Microsoft Presidio + spaCy en_core_web_lg.

    Detects:
    - PERSON       (score >= 0.85, min 2 words): full person names
    - PHONE_NUMBER (score >= 0.60): telephone numbers
    - LOCATION     (score >= 0.80): specific street addresses only
                   General city/state ("Denver, CO") is intentionally passed through
                   so the AI retains jurisdiction/context needed to answer the question.

    Intentionally skips DATE_TIME, URL, ORG, EMAIL_ADDRESS
    (too noisy or already handled by regex layer).
    """

    def __init__(self) -> None:
        self._engine: Optional[object] = None
        self._load_engine()

    def _load_engine(self) -> None:
        try:
            from presidio_analyzer import AnalyzerEngine

            self._engine = AnalyzerEngine()
            logger.info("Presidio AnalyzerEngine loaded (en_core_web_lg)")
        except Exception as e:
            logger.warning(f"Presidio unavailable, contextual PII disabled: {e}")
            self._engine = None

    @property
    def is_available(self) -> bool:
        return self._engine is not None

    def scan(self, text: str) -> list[PiiDetection]:
        """Return Presidio-detected PII items above confidence thresholds."""
        if not self._engine or not text.strip():
            return []

        try:
            results = self._engine.analyze(
                text=text,
                entities=list(_ENTITY_MAP.keys()),
                language="en",
            )
        except Exception as e:
            logger.warning(f"Presidio scan error: {e}")
            return []

        detections: list[PiiDetection] = []
        for r in results:
            threshold = _SCORE_THRESHOLDS.get(r.entity_type, 0.8)
            if r.score < threshold:
                continue

            pii_type, category, severity = _ENTITY_MAP[r.entity_type]
            value = text[r.start : r.end]

            # PERSON: require at least 2 words (first + last name) to avoid
            # single-word false positives like "Email", "John", "Main", etc.
            if r.entity_type == "PERSON" and len(value.split()) < 2:
                continue

            # LOCATION: only flag specific street addresses (start with a number).
            # "742 Evergreen Terrace" → mask.
            # "Denver, Colorado" or "Austin TX" → keep (needed for jurisdiction context).
            if r.entity_type == "LOCATION" and not _STREET_NUMBER_RE.match(value):
                continue

            detections.append(
                PiiDetection(
                    type=pii_type,
                    value=value,
                    start=r.start,
                    end=r.end,
                    category=category,
                    severity=severity,
                    source="presidio",
                    confidence=r.score,
                )
            )

        return detections

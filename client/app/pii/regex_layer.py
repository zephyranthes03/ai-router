"""Fast deterministic PII detection using regex patterns."""

import re
from typing import Literal

from app.pii.patterns import PII_PATTERNS, PiiPattern
from app.pii.strategies import PiiDetection, MaskResult, PiiAction, ScanResult


class RegexPiiScanner:
    """Layer 1 PII detection: regex patterns. Always runs, instant."""

    def __init__(self) -> None:
        self._compiled: dict[str, re.Pattern] = {}
        for name, pattern in PII_PATTERNS.items():
            try:
                self._compiled[name] = re.compile(pattern.regex)
            except re.error:
                pass  # Skip invalid patterns

    def scan(self, text: str) -> ScanResult:
        """Scan text for PII using all regex patterns."""
        detections: list[PiiDetection] = []

        for name, compiled in self._compiled.items():
            pattern_info = PII_PATTERNS[name]
            for match in compiled.finditer(text):
                detections.append(
                    PiiDetection(
                        type=name,
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                        category=pattern_info.category,
                        severity=pattern_info.severity,
                        source="regex",
                        confidence=1.0,
                    )
                )

        # Remove duplicates (overlapping matches)
        detections = self._deduplicate(detections)
        detections.sort(key=lambda d: d.start)

        return ScanResult(detections=detections, count=len(detections))

    def mask_text(
        self,
        text: str,
        detections: list[PiiDetection],
        pii_mode: Literal["none", "permissive", "strict", "user_select"],
    ) -> MaskResult:
        """Apply masking to text based on detections and PII mode.

        In regex-only mode (no LLM), all detections use 'mask' action.
        Generalize and pass require LLM context.
        """
        actions: list[PiiAction] = []
        mask_map: dict[str, str] = {}

        if pii_mode == "none":
            return MaskResult(masked=text, mask_map=mask_map, actions=actions)

        effective_mode = "strict" if pii_mode in ("user_select",) else pii_mode

        # Sort detections by position (reverse for safe replacement)
        sorted_dets = sorted(detections, key=lambda d: d.start, reverse=True)
        masked = text

        for det in sorted_dets:
            # Determine action based on mode and severity
            if effective_mode == "permissive" and det.severity in ("low", "medium", "high"):
                # Permissive: pass personal identifiers (names, emails, addresses,
                # crypto wallet addresses) — only mask critical secrets (SSN, passwords,
                # API keys, private keys).
                action = "pass"
                replacement = det.value
                reason = "Permissive mode: non-critical severity passed"
            else:
                # Default: mask everything (generalize requires LLM)
                _EXTRA_PLACEHOLDERS = {"name": "[NAME]", "phone": "[PHONE]", "address": "[ADDRESS]"}
                action = "mask"
                pattern = PII_PATTERNS.get(det.type)
                replacement = (
                    pattern.placeholder
                    if pattern
                    else _EXTRA_PLACEHOLDERS.get(det.type, "[REDACTED]")
                )
                reason = f"{det.source} detection: {det.type}"

            actions.append(
                PiiAction(
                    detection=det,
                    action=action,
                    replacement=replacement,
                    reason=reason,
                )
            )

            if action == "mask":
                mask_map[replacement] = det.value
                masked = masked[: det.start] + replacement + masked[det.end :]

        actions.reverse()  # Restore original order
        return MaskResult(masked=masked, mask_map=mask_map, actions=actions)

    def _deduplicate(self, detections: list[PiiDetection]) -> list[PiiDetection]:
        """Remove overlapping detections, keeping higher severity."""
        if not detections:
            return []

        severity_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        detections.sort(key=lambda d: (d.start, -severity_rank.get(d.severity, 0)))

        result = [detections[0]]
        for det in detections[1:]:
            prev = result[-1]
            if det.start < prev.end:
                # Overlapping — keep the one with higher severity
                if severity_rank.get(det.severity, 0) > severity_rank.get(prev.severity, 0):
                    result[-1] = det
            else:
                result.append(det)

        return result

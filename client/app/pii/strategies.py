"""PII masking strategies: mask, generalize, pass."""

from dataclasses import dataclass
from typing import Literal


@dataclass
class PiiDetection:
    """A single PII detection with position info."""

    type: str  # Pattern name (e.g., "email", "ssn")
    value: str  # Matched text
    start: int  # Start position in original text
    end: int  # End position in original text
    category: str  # contact, identity, financial, secret, technical
    severity: str  # critical, high, medium, low
    source: str  # "regex" or "llama"
    confidence: float = 1.0  # Detection confidence


@dataclass
class PiiAction:
    """Action applied to a detected PII item."""

    detection: PiiDetection
    action: Literal["mask", "generalize", "pass"]
    replacement: str
    reason: str


@dataclass
class MaskResult:
    """Result of applying all PII actions to text."""

    masked: str
    mask_map: dict[str, str]  # placeholder -> original value (for potential unmask)
    actions: list[PiiAction]


@dataclass
class ScanResult:
    """Result of a regex PII scan."""

    detections: list[PiiDetection]
    count: int

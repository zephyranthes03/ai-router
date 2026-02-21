"""PII regex pattern definitions."""

from dataclasses import dataclass


@dataclass
class PiiPattern:
    name: str
    regex: str
    category: str  # contact, identity, financial, secret, technical
    severity: str  # critical, high, medium, low
    placeholder: str  # default replacement text


PII_PATTERNS: dict[str, PiiPattern] = {
    "email": PiiPattern(
        name="email",
        regex=r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        category="contact",
        severity="high",
        placeholder="[EMAIL]",
    ),
    "phone_us": PiiPattern(
        name="phone_us",
        regex=r"(?<!\d)(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
        category="contact",
        severity="high",
        placeholder="[PHONE]",
    ),
    "ssn": PiiPattern(
        name="ssn",
        regex=r"\b\d{3}-\d{2}-\d{4}\b",
        category="identity",
        severity="critical",
        placeholder="[SSN]",
    ),
    "credit_card": PiiPattern(
        name="credit_card",
        regex=r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
        category="financial",
        severity="critical",
        placeholder="[CREDIT_CARD]",
    ),
    "ip_address": PiiPattern(
        name="ip_address",
        regex=r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        category="technical",
        severity="medium",
        placeholder="[IP_ADDRESS]",
    ),
    "aws_key": PiiPattern(
        name="aws_key",
        regex=r"\bAKIA[0-9A-Z]{16}\b",
        category="secret",
        severity="critical",
        placeholder="[AWS_KEY]",
    ),
    "api_key_generic": PiiPattern(
        name="api_key_generic",
        regex=r"\b(?:sk|pk|api[_-]?key)[_-][A-Za-z0-9]{20,}\b",
        category="secret",
        severity="critical",
        placeholder="[API_KEY]",
    ),
    "github_token": PiiPattern(
        name="github_token",
        regex=r"\bghp_[a-zA-Z0-9]{36}\b",
        category="secret",
        severity="critical",
        placeholder="[GITHUB_TOKEN]",
    ),
    "anthropic_key": PiiPattern(
        name="anthropic_key",
        regex=r"\bsk-ant-[a-zA-Z0-9\-]{20,}\b",
        category="secret",
        severity="critical",
        placeholder="[ANTHROPIC_KEY]",
    ),
    "slack_token": PiiPattern(
        name="slack_token",
        regex=r"\bxox[bprs]-[a-zA-Z0-9\-]+\b",
        category="secret",
        severity="critical",
        placeholder="[SLACK_TOKEN]",
    ),
    "google_api_key": PiiPattern(
        name="google_api_key",
        regex=r"\bAIza[0-9A-Za-z\-_]{35}\b",
        category="secret",
        severity="critical",
        placeholder="[GOOGLE_KEY]",
    ),
    "credential_assignment": PiiPattern(
        name="credential_assignment",
        # Matches: "id: john123", "account: alice_eth", "id = user_01"
        regex=r'(?i)\b(id|account)\s*[=:]\s*["\']?([A-Za-z0-9._@-]{3,})["\']?',
        category="identity",
        severity="high",
        placeholder="[CREDENTIAL]",
    ),
    "password_assignment": PiiPattern(
        name="password_assignment",
        # Added "pw" shorthand alongside the existing keywords
        regex=r'(?i)\b(password|passwd|pwd|pw|secret|token|credential)\s*[=:]\s*["\']?(\S+)["\']?',
        category="secret",
        severity="critical",
        placeholder="[PASSWORD]",
    ),
    "env_var_secret": PiiPattern(
        name="env_var_secret",
        regex=r'(?i)(API_KEY|SECRET_KEY|DATABASE_URL|DB_PASSWORD|PRIVATE_KEY)\s*=\s*["\']?(\S+)["\']?',
        category="secret",
        severity="critical",
        placeholder="[ENV_SECRET]",
    ),
    "street_address": PiiPattern(
        name="street_address",
        # Matches: "742 Evergreen Terrace", "123 Main St", "1600 Pennsylvania Ave"
        # Requires a leading street number + at least one capitalized word + street suffix.
        # Does NOT match plain city/state ("Denver, Colorado", "Austin TX").
        regex=(
            r"\b\d+\s+"
            r"(?:[A-Z][a-zA-Z]+\s+){1,4}"
            r"(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|"
            r"Drive|Dr|Court|Ct|Place|Pl|Way|Circle|Cir|"
            r"Terrace|Terr|Trail|Trl|Highway|Hwy|Parkway|Pkwy)\.?"
            r"\b"
        ),
        category="identity",
        severity="medium",
        placeholder="[ADDRESS]",
    ),
    # ── EVM-compatible chains (Ethereum, Polygon, BNB, Arbitrum, Base, Avalanche, etc.) ──
    "eth_address": PiiPattern(
        name="eth_address",
        # 0x + exactly 40 hex chars — covers all EVM chains identically
        # severity=high (not critical): public wallet address, not a secret — passes in permissive
        regex=r"\b0x[0-9a-fA-F]{40}\b",
        category="financial",
        severity="high",
        placeholder="[ETH_ADDRESS]",
    ),
    "eth_private_key": PiiPattern(
        name="eth_private_key",
        # 0x + exactly 64 hex chars (32-byte private key) — always masked
        regex=r"\b0x[0-9a-fA-F]{64}\b",
        category="secret",
        severity="critical",
        placeholder="[ETH_KEY]",
    ),
    # ── Bitcoin ──
    "btc_address": PiiPattern(
        name="btc_address",
        # P2PKH (starts with 1) / P2SH (starts with 3) / Bech32 (bc1...)
        # severity=high: public address, not a secret — passes in permissive
        regex=(
            r"\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}"
            r"|bc1[a-z0-9]{6,87})\b"
        ),
        category="financial",
        severity="high",
        placeholder="[BTC_ADDRESS]",
    ),
    "btc_private_key": PiiPattern(
        name="btc_private_key",
        # WIF format: uncompressed = 5 + 50 base58 chars (51 total)
        #             compressed   = K/L + 50-51 base58 chars (51-52 total)
        regex=r"\b(?:5[a-km-zA-HJ-NP-Z1-9]{50}|[KL][a-km-zA-HJ-NP-Z1-9]{50,51})\b",
        category="secret",
        severity="critical",
        placeholder="[BTC_KEY]",
    ),
    # ── Solana (context-triggered only — standalone base58 is too ambiguous) ──
    "sol_address": PiiPattern(
        name="sol_address",
        # Matches only when preceded by "solana:", "sol:", "pubkey:", etc.
        # severity=high: public address, not a secret — passes in permissive
        regex=r"(?i)\b(?:solana|sol|pubkey|public[-_]?key)\s*[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})\b",
        category="financial",
        severity="high",
        placeholder="[SOL_ADDRESS]",
    ),
}

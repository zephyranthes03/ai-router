"""User settings with Pydantic validation and local persistence."""

import json
import os
from typing import Literal, Optional

from pydantic import BaseModel

from app.config.constants import DATA_DIR, SETTINGS_FILE, GATEWAY_SERVER_URL, OLLAMA_URL, OLLAMA_MODEL, ZERO_G_BASE_URL, ZERO_G_DEFAULT_MODEL


class UserSettings(BaseModel):
    """User preferences stored locally at ~/.ai-gateway/settings.json."""

    tier: Literal["budget", "standard", "premium"] = "standard"
    speed_quality_weight: int = 50  # 0 = pure speed, 100 = pure quality
    pii_mode: Literal["none", "permissive", "strict", "user_select"] = "user_select"
    max_budget_per_request: float = 0.03
    monthly_max_budget: float = 5.0
    preferred_providers: list[str] = []
    ollama_enabled: bool = True
    extended_thinking: bool = True
    web_search: bool = False
    server_url: str = GATEWAY_SERVER_URL
    ollama_url: str = OLLAMA_URL
    ollama_model: str = OLLAMA_MODEL
    # 0G Compute Network inference
    use_0g_inference: bool = False
    zero_g_api_key: str = ""
    zero_g_model: str = ZERO_G_DEFAULT_MODEL
    zero_g_base_url: str = ZERO_G_BASE_URL

    def save(self) -> None:
        """Persist settings to disk."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SETTINGS_FILE.write_text(self.model_dump_json(indent=2))

    @classmethod
    def load(cls) -> "UserSettings":
        """Load settings from disk or return defaults."""
        if SETTINGS_FILE.exists():
            try:
                data = json.loads(SETTINGS_FILE.read_text())
                # Migrate removed "balanced" mode to "strict"
                if data.get("pii_mode") == "balanced":
                    data["pii_mode"] = "strict"
                return cls(**data)
            except (json.JSONDecodeError, ValueError):
                pass
        return cls()


class UserSettingsUpdate(BaseModel):
    """Partial settings for PUT /settings."""

    tier: Optional[Literal["budget", "standard", "premium"]] = None
    speed_quality_weight: Optional[int] = None
    pii_mode: Optional[Literal["none", "permissive", "strict", "user_select"]] = None
    max_budget_per_request: Optional[float] = None
    monthly_max_budget: Optional[float] = None
    preferred_providers: Optional[list[str]] = None
    ollama_enabled: Optional[bool] = None
    extended_thinking: Optional[bool] = None
    web_search: Optional[bool] = None
    server_url: Optional[str] = None
    use_0g_inference: Optional[bool] = None
    zero_g_api_key: Optional[str] = None
    zero_g_model: Optional[str] = None
    zero_g_base_url: Optional[str] = None


def load_settings() -> UserSettings:
    """Convenience function for loading settings."""
    return UserSettings.load()

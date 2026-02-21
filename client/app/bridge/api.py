"""PyWebView JS API bridge: Python functions callable from JavaScript."""

import logging
import sys

import httpx

from app.agent.file_ops import FileOps
from app.agent.shell import ShellExecutor
from app.agent.system import SystemInfo

logger = logging.getLogger(__name__)


class BridgeApi:
    """Exposed to JavaScript via pywebview js_api.
    This is what makes it an agent PLATFORM, not just a chat app.
    """

    def __init__(self) -> None:
        self._window = None
        self.file_ops = FileOps()
        self.shell = ShellExecutor()
        self.system = SystemInfo()

    def set_window(self, window) -> None:
        """Set the pywebview window reference."""
        self._window = window

    # --- System Info ---

    def get_system_info(self) -> dict:
        """Get system info including Ollama status."""
        info = self.system.info()
        info["ollama_running"] = self.check_ollama()
        return info

    def check_ollama(self) -> bool:
        """Check if Ollama is running with the required model."""
        try:
            resp = httpx.get("http://localhost:11434/api/tags", timeout=2.0)
            models = [m["name"] for m in resp.json().get("models", [])]
            return any("llama3.2" in m for m in models)
        except Exception:
            return False

    # --- File Operations ---

    def read_file(self, path: str) -> dict:
        """Read file contents. Returns {success, content, error}."""
        return self.file_ops.read(path)

    def write_file(self, path: str, content: str) -> dict:
        """Write file. Returns {success, error}."""
        return self.file_ops.write(path, content)

    def list_directory(self, path: str) -> dict:
        """List directory contents. Returns {success, entries, error}."""
        return self.file_ops.list_dir(path)

    # --- Shell ---

    def execute_command(self, command: str, timeout: int = 30) -> dict:
        """Execute shell command. Returns {success, stdout, stderr, return_code}."""
        return self.shell.execute(command, timeout)

    # --- Settings (delegate to FastAPI) ---

    def get_settings(self) -> dict:
        """Get current settings via local API."""
        try:
            resp = httpx.get("http://localhost:8000/settings", timeout=3.0)
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    def save_settings(self, settings: dict) -> dict:
        """Save settings via local API."""
        try:
            resp = httpx.put(
                "http://localhost:8000/settings",
                json=settings,
                timeout=3.0,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

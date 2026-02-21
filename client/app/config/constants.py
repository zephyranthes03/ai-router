"""Application constants and defaults."""

from pathlib import Path

# Remote AI gateway server
GATEWAY_SERVER_URL = "http://localhost:3001"

# Local FastAPI server
LOCAL_API_PORT = 8000

# Ollama (local LLM)
OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:3b"

# Local data storage
DATA_DIR = Path.home() / ".ai-gateway"
SETTINGS_FILE = DATA_DIR / "settings.json"
HISTORY_FILE = DATA_DIR / "history.jsonl"

# Blockchain
BASE_SEPOLIA_CHAIN_ID = 84532

# 0G Compute Network inference
ZERO_G_BASE_URL = "https://api.0g.ai/v1"
ZERO_G_DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"

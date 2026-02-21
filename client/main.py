"""Entry point: FastAPI server + URL guidance."""

import logging
import os
import threading
import time

import uvicorn

from app.api.server import create_app
from app.config.constants import LOCAL_API_PORT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)


def start_fastapi(app, port: int = LOCAL_API_PORT) -> None:
    """Run FastAPI/uvicorn in current thread (blocking)."""
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


def main() -> None:
    """Start the API server and print connection instructions."""
    fastapi_app = create_app()

    server_thread = threading.Thread(
        target=start_fastapi, args=(fastapi_app,), daemon=True
    )
    server_thread.start()
    time.sleep(1)

    dev_mode = os.getenv("DEV", "").lower() in ("1", "true", "yes")
    frontend_url = "http://localhost:5173" if dev_mode else "http://localhost:5173"

    print()
    print("  AI Gateway client running")
    print(f"  Local API : http://localhost:{LOCAL_API_PORT}")
    print(f"  Frontend  : {frontend_url}")
    print()
    print("  Open the frontend URL in your browser to get started.")
    print("  Press Ctrl+C to stop.")
    print()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n  Shutting down.")


if __name__ == "__main__":
    main()

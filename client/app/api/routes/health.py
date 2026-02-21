"""GET /health — check Ollama and gateway server status."""

import httpx
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/")
async def health_check(request: Request):
    """Check local system health: Ollama + gateway reachability."""
    settings = request.app.state.settings

    # Check Ollama
    ollama_available = False
    ollama_model = settings.ollama_model
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.ollama_url}/api/tags", timeout=3.0
            )
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                ollama_available = any(ollama_model in m for m in models)
    except (httpx.ConnectError, httpx.TimeoutException):
        pass

    # Check gateway server
    gateway_reachable = False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.server_url}/health", timeout=3.0
            )
            gateway_reachable = resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        pass

    return {
        "status": "ok",
        "ollama_available": ollama_available,
        "ollama_model": ollama_model,
        "gateway_server": settings.server_url,
        "gateway_reachable": gateway_reachable,
    }

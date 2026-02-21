"""FastAPI application factory for the local API server."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="AI Gateway Client", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api.routes.analyze import router as analyze_router
    from app.api.routes.health import router as health_router
    from app.api.routes.settings import router as settings_router
    from app.api.routes.usage import router as usage_router
    from app.api.routes.wallet import router as wallet_router

    app.include_router(analyze_router, prefix="/analyze", tags=["analyze"])
    app.include_router(health_router, prefix="/health", tags=["health"])
    app.include_router(settings_router, prefix="/settings", tags=["settings"])
    app.include_router(usage_router, prefix="/usage", tags=["usage"])
    app.include_router(wallet_router, prefix="/wallet", tags=["wallet"])

    @app.on_event("startup")
    async def startup():
        from app.config.settings import load_settings
        from app.orchestrator import AnalysisOrchestrator

        settings = load_settings()
        app.state.orchestrator = AnalysisOrchestrator(settings)
        app.state.settings = settings

    return app

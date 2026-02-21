"""GET/PUT /settings — read and update user settings."""

from fastapi import APIRouter, Request

from app.config.settings import UserSettingsUpdate, load_settings
from app.orchestrator import AnalysisOrchestrator

router = APIRouter()


@router.get("/")
async def get_settings(request: Request):
    """Return current user settings."""
    settings = request.app.state.settings
    return settings.model_dump()


@router.put("/")
async def update_settings(body: UserSettingsUpdate, request: Request):
    """Update user settings and recreate the orchestrator."""
    settings = request.app.state.settings

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    settings.save()

    # Recreate orchestrator with new settings
    request.app.state.orchestrator = AnalysisOrchestrator(settings)
    request.app.state.settings = settings

    return settings.model_dump()

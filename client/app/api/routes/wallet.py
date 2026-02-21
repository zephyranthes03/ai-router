"""Wallet keystore endpoints — save / load / delete encrypted keystore."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config.constants import DATA_DIR

logger = logging.getLogger(__name__)

router = APIRouter()

KEYSTORE_FILE = DATA_DIR / "keystore.json"


class KeystorePayload(BaseModel):
    version: int
    address: str
    iv: str
    salt: str
    ciphertext: str
    createdAt: int


@router.get("/keystore")
async def get_keystore():
    """Load the encrypted keystore from disk."""
    if not KEYSTORE_FILE.exists():
        raise HTTPException(status_code=404, detail="No keystore found")

    try:
        data = json.loads(KEYSTORE_FILE.read_text(encoding="utf-8"))
        return data
    except Exception as exc:
        logger.error("Failed to read keystore: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to read keystore")


@router.post("/keystore")
async def save_keystore(payload: KeystorePayload):
    """Persist the encrypted keystore to disk."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        KEYSTORE_FILE.write_text(
            json.dumps(payload.model_dump(), indent=2),
            encoding="utf-8",
        )
        # Restrict file permissions (owner read/write only)
        KEYSTORE_FILE.chmod(0o600)
        return {"success": True}
    except Exception as exc:
        logger.error("Failed to save keystore: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save keystore")


@router.delete("/keystore")
async def delete_keystore():
    """Remove the keystore file."""
    try:
        if KEYSTORE_FILE.exists():
            KEYSTORE_FILE.unlink()
        return {"success": True}
    except Exception as exc:
        logger.error("Failed to delete keystore: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete keystore")

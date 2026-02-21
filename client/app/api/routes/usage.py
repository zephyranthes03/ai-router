"""Usage logging and history retrieval endpoints."""

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.config.constants import DATA_DIR, HISTORY_FILE

router = APIRouter()


class CostInfo(BaseModel):
    input_cost: float
    output_cost: float
    actual_total: float
    charged: float


class TokenInfo(BaseModel):
    input: int
    output: int


class UsageRecord(BaseModel):
    id: Optional[str] = None
    timestamp: int
    provider_id: str
    provider_name: str
    tier: str
    cost: CostInfo
    tokens: TokenInfo
    conversation_id: Optional[str] = None


@router.post("/log")
async def log_usage(record: UsageRecord):
    """Append a usage record to the JSONL history file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not record.id:
        record.id = str(uuid.uuid4())

    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(record.model_dump_json() + "\n")

    return {"status": "ok"}


@router.get("/history")
async def get_history(
    start_ts: Optional[int] = Query(None, description="Start timestamp (unix ms)"),
    end_ts: Optional[int] = Query(None, description="End timestamp (unix ms)"),
    provider_id: Optional[str] = Query(None, description="Filter by provider ID"),
    limit: int = Query(1000, description="Max records to return"),
):
    """Read usage history from JSONL with optional filters."""
    if not HISTORY_FILE.exists():
        return {"records": [], "total": 0}

    records = []
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue

            if start_ts is not None and rec.get("timestamp", 0) < start_ts:
                continue
            if end_ts is not None and rec.get("timestamp", 0) > end_ts:
                continue
            if provider_id is not None and rec.get("provider_id") != provider_id:
                continue

            records.append(rec)

    total = len(records)
    records = records[-limit:]

    return {"records": records, "total": total}

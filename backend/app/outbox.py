from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import OutboxEvent


def enqueue_outbox_event(
    db: Session,
    *,
    event_type: str,
    payload: dict[str, Any],
    available_at: datetime | None = None,
) -> OutboxEvent:
    row = OutboxEvent(
        tenant_id=int(db.info.get("tenant_id", 1) or 1),
        event_type=event_type,
        payload_json=json.dumps(payload, ensure_ascii=True),
        status="PENDING",
        attempts=0,
        max_attempts=8,
        available_at=available_at or datetime.now(UTC),
    )
    db.add(row)
    return row


def claim_outbox_batch(db: Session, *, limit: int = 20) -> list[OutboxEvent]:
    now = datetime.now(UTC)
    candidates = list(
        db.scalars(
            select(OutboxEvent)
            .where(
                and_(
                    OutboxEvent.status.in_(["PENDING", "FAILED"]),
                    OutboxEvent.available_at <= now,
                    OutboxEvent.attempts < OutboxEvent.max_attempts,
                )
            )
            .order_by(OutboxEvent.id.asc())
            .limit(limit)
        )
    )
    rows: list[OutboxEvent] = []
    lock_token = str(uuid.uuid4())
    lock_time = datetime.now(UTC)
    for row in candidates:
        updated = (
            db.query(OutboxEvent)
            .filter(OutboxEvent.id == row.id, OutboxEvent.status.in_(["PENDING", "FAILED"]))
            .update(
                {
                    OutboxEvent.status: "PROCESSING",
                    OutboxEvent.attempts: int(row.attempts or 0) + 1,
                    OutboxEvent.lock_token: lock_token,
                    OutboxEvent.locked_at: lock_time,
                },
                synchronize_session=False,
            )
        )
        if updated:
            claimed = db.get(OutboxEvent, row.id)
            if claimed is not None:
                rows.append(claimed)
    db.commit()
    return rows


def mark_outbox_done(db: Session, row: OutboxEvent) -> None:
    row.status = "DONE"
    row.processed_at = datetime.now(UTC)
    row.last_error = None
    row.locked_at = None
    row.lock_token = None
    db.commit()


def mark_outbox_failed(db: Session, row: OutboxEvent, error_message: str) -> None:
    row.last_error = (error_message or "")[:2000]
    row.status = "FAILED"
    backoff_seconds = min(300, 2 ** min(int(row.attempts or 1), 8))
    row.available_at = datetime.now(UTC) + timedelta(seconds=backoff_seconds)
    row.locked_at = None
    row.lock_token = None
    if int(row.attempts or 0) >= int(row.max_attempts or 8):
        row.status = "DEAD"
    db.commit()

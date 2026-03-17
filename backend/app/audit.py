from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log_audit(
    db: Session,
    user: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    payload = None
    if detail is not None:
        try:
            payload = json.dumps(detail, default=str)[:5000]
        except Exception:
            payload = None
    previous = db.scalar(select(AuditLog).order_by(AuditLog.id.desc()).limit(1))
    prev_hash = previous.entry_hash if previous else None

    basis = "|".join(
        [
            str(user.id if user else ""),
            action,
            entity_type,
            str(entity_id if entity_id is not None else ""),
            payload or "",
            prev_hash or "",
        ]
    )
    entry_hash = hashlib.sha256(basis.encode("utf-8")).hexdigest()

    db.add(
        AuditLog(
            user_id=user.id if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=payload,
            prev_hash=prev_hash,
            entry_hash=entry_hash,
        )
    )

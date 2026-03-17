from __future__ import annotations

import asyncio
import json
from collections import deque
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import DomainEvent
from app.outbox import enqueue_outbox_event


class EventStream:
    def __init__(self) -> None:
        self._connections: set[Any] = set()
        self._recent: deque[dict[str, Any]] = deque(maxlen=300)
        self._loop: asyncio.AbstractEventLoop | None = None

    @property
    def recent(self) -> list[dict[str, Any]]:
        return list(self._recent)

    async def connect(self, websocket: Any) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        self._loop = asyncio.get_running_loop()

    def disconnect(self, websocket: Any) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event: dict[str, Any]) -> None:
        self._recent.append(event)
        if not self._connections:
            return
        dead: list[Any] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def broadcast_sync(self, event: dict[str, Any]) -> None:
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(asyncio.create_task, self.broadcast(event))
        else:
            self._recent.append(event)


event_stream = EventStream()


def emit_domain_event(
    db: Session,
    *,
    event_type: str,
    actor_user_id: int | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    payload_obj = payload or {}
    safe_payload = {
        "event_type": event_type,
        "at": datetime.now(UTC).isoformat(),
        "actor_user_id": actor_user_id,
        "tenant_id": int(db.info.get("tenant_id", 1) or 1),
        "payload": payload_obj,
    }
    row = DomainEvent(
        tenant_id=int(db.info.get("tenant_id", 1) or 1),
        event_type=event_type,
        actor_user_id=actor_user_id,
        payload_json=json.dumps(safe_payload, ensure_ascii=True),
    )
    db.add(row)
    enqueue_outbox_event(
        db,
        event_type=event_type,
        payload=safe_payload,
    )
    db.commit()
    db.refresh(row)
    safe_payload["id"] = row.id
    event_stream.broadcast_sync(safe_payload)

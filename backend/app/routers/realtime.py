from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.event_stream import event_stream
from app.models import DomainEvent


router = APIRouter(tags=["realtime"])


@router.get("/api/events/recent")
def list_recent_events(limit: int = 100) -> dict[str, object]:
    cap = max(1, min(limit, 500))
    db: Session = SessionLocal()
    try:
        rows = db.scalars(select(DomainEvent).order_by(DomainEvent.id.desc()).limit(cap)).all()
        data = []
        for row in rows:
            try:
                payload = json.loads(row.payload_json or "{}")
            except Exception:
                payload = {"event_type": row.event_type, "payload_parse_error": True}
            data.append(payload)
    finally:
        db.close()
    return {"count": len(data), "items": data}


@router.websocket("/ws/stock")
async def stock_events(websocket: WebSocket) -> None:
    await event_stream.connect(websocket)
    try:
        await websocket.send_json({"event_type": "ws_connected", "at": "now", "payload": {"scope": "stock"}})
        for item in event_stream.recent[-20:]:
            await websocket.send_json(item)
        while True:
            # Keep connection alive and allow clients to send pings.
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=25)
                if msg.strip().lower() == "ping":
                    await websocket.send_text("pong")
            except TimeoutError:
                await websocket.send_json({"event_type": "heartbeat", "payload": {"scope": "stock"}})
    except WebSocketDisconnect:
        event_stream.disconnect(websocket)
    except Exception:
        event_stream.disconnect(websocket)

from __future__ import annotations

from app.db import SessionLocal, ensure_schema, engine
from app.models import OutboxEvent
from app.outbox import claim_outbox_batch, enqueue_outbox_event, mark_outbox_done


def test_outbox_claim_and_complete_cycle() -> None:
    ensure_schema(engine)
    db = SessionLocal()
    try:
        db.info["tenant_id"] = 1
        row = enqueue_outbox_event(
            db,
            event_type="test.event",
            payload={"hello": "world"},
        )
        db.commit()
        db.refresh(row)

        batch = claim_outbox_batch(db, limit=5)
        assert any(item.id == row.id for item in batch)
        item = next(item for item in batch if item.id == row.id)
        assert item.status == "PROCESSING"
        assert item.lock_token is not None

        mark_outbox_done(db, item)
        done = db.get(OutboxEvent, row.id)
        assert done is not None
        assert done.status == "DONE"
        assert done.lock_token is None
    finally:
        db.close()

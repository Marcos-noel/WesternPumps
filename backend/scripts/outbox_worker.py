from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import time
from typing import Any
from urllib import request as urlrequest

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal, ensure_schema, engine
from app.models import AppSetting, OutboxEvent
from app.outbox import claim_outbox_batch, mark_outbox_done, mark_outbox_failed

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("westernpumps.outbox")


def _get_setting(db, key: str) -> str:
    row = db.scalar(select(AppSetting).where(AppSetting.key == key).limit(1))
    return (row.value if row else "") or ""


def _send_signed_webhook(url: str, secret: str, payload: dict[str, Any], outbox_id: int) -> None:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    req = urlrequest.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Idempotency-Key", f"outbox-{outbox_id}")
    if secret:
        signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        req.add_header("X-WesternPumps-Signature", signature)
    with urlrequest.urlopen(req, timeout=20) as _:
        pass


def process_event(db, row: OutboxEvent) -> None:
    """
    Integration handler stub.
    Replace with queue sink, webhook, ERP sync, etc.
    """
    db.info["tenant_id"] = int(getattr(row, "tenant_id", 1) or 1)
    payload: dict[str, Any] = json.loads(row.payload_json or "{}")
    enriched_payload = {
        **payload,
        "outbox_id": row.id,
        "event_type": row.event_type,
        "tenant_id": int(getattr(row, "tenant_id", 1) or 1),
    }

    targets: list[tuple[str, str, str]] = [
        (
            _get_setting(db, "integration_finance_webhook").strip(),
            _get_setting(db, "integration_finance_webhook_secret").strip(),
            "finance",
        ),
        (
            _get_setting(db, "integration_erp_webhook").strip(),
            _get_setting(db, "integration_erp_webhook_secret").strip(),
            "erp",
        ),
        (
            _get_setting(db, "integration_accounting_webhook").strip(),
            _get_setting(db, "integration_accounting_webhook_secret").strip(),
            "accounting",
        ),
    ]

    sent = 0
    for url, secret, channel in targets:
        if not url:
            continue
        _send_signed_webhook(url, secret, {**enriched_payload, "channel": channel}, row.id)
        sent += 1
    logger.info(
        "Outbox event %s type=%s tenant=%s dispatched_channels=%s",
        row.id,
        row.event_type,
        getattr(row, "tenant_id", 1),
        sent,
    )


def worker_loop(poll_seconds: int, batch_size: int, once: bool = False) -> None:
    ensure_schema(engine)
    while True:
        db = SessionLocal()
        try:
            batch = claim_outbox_batch(db, limit=batch_size)
            if not batch:
                if once:
                    return
                time.sleep(max(1, poll_seconds))
                continue

            for row in batch:
                try:
                    process_event(db, row)
                    mark_outbox_done(db, row)
                except Exception as exc:  # pragma: no cover - worker resilience path
                    mark_outbox_failed(db, row, str(exc))
                    logger.exception("Outbox processing failed for event id=%s", row.id)
        finally:
            db.close()
        if once:
            return


def main() -> None:
    parser = argparse.ArgumentParser(description="WesternPumps outbox worker")
    parser.add_argument("--once", action="store_true", help="Process one batch and exit")
    parser.add_argument("--poll-seconds", type=int, default=settings.outbox_worker_poll_interval_seconds)
    parser.add_argument("--batch-size", type=int, default=settings.outbox_worker_batch_size)
    args = parser.parse_args()
    worker_loop(
        poll_seconds=max(1, args.poll_seconds),
        batch_size=max(1, args.batch_size),
        once=bool(args.once),
    )


if __name__ == "__main__":
    main()

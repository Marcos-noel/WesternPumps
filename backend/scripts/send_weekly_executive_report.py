from __future__ import annotations

from datetime import UTC, datetime, timedelta
import json

from sqlalchemy import func, select

from app.db import SessionLocal, ensure_schema, engine
from app.models import CycleCount, PurchaseOrder, StockTransaction, StockTransactionType, StockTransfer
from app.outbox import enqueue_outbox_event


def build_weekly_summary(days: int = 7) -> dict[str, object]:
    db = SessionLocal()
    try:
        end_date = datetime.now(UTC).date()
        start_date = end_date - timedelta(days=days - 1)
        start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=UTC)

        summary = {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "purchase_orders_created": int(db.scalar(select(func.count()).select_from(PurchaseOrder).where(PurchaseOrder.created_at >= start_dt)) or 0),
            "purchase_orders_closed": int(
                db.scalar(
                    select(func.count()).select_from(PurchaseOrder).where(
                        PurchaseOrder.closed_at.is_not(None),
                        PurchaseOrder.closed_at >= start_dt,
                    )
                )
                or 0
            ),
            "transfer_orders_completed": int(
                db.scalar(
                    select(func.count()).select_from(StockTransfer).where(
                        StockTransfer.completed_at.is_not(None),
                        StockTransfer.completed_at >= start_dt,
                    )
                )
                or 0
            ),
            "cycle_counts_approved": int(
                db.scalar(
                    select(func.count()).select_from(CycleCount).where(
                        CycleCount.approved_at.is_not(None),
                        CycleCount.approved_at >= start_dt,
                    )
                )
                or 0
            ),
            "outbound_transactions": int(
                db.scalar(
                    select(func.count()).select_from(StockTransaction).where(
                        StockTransaction.transaction_type == StockTransactionType.OUT,
                        StockTransaction.created_at >= start_dt,
                    )
                )
                or 0
            ),
        }
        return summary
    finally:
        db.close()


def main() -> None:
    ensure_schema(engine)
    summary = build_weekly_summary()
    db = SessionLocal()
    try:
        enqueue_outbox_event(
            db,
            event_type="executive.weekly_summary",
            payload=summary,
        )
        db.commit()
    finally:
        db.close()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

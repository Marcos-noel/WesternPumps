from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    IssuedBatchItem,
    ItemInstance,
    ItemStatus,
    Part,
    StockRequest,
    StockRequestLine,
    StockRequestStatus,
    StockTransaction,
    StockTransactionType,
    Supplier,
)


class InventoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_part(self, part_id: int) -> Part | None:
        return self.db.get(Part, part_id)

    def get_supplier(self, supplier_id: int) -> Supplier | None:
        return self.db.get(Supplier, supplier_id)

    def get_request(self, request_id: int) -> StockRequest | None:
        return self.db.get(StockRequest, request_id)

    def get_request_line(self, line_id: int) -> StockRequestLine | None:
        return self.db.get(StockRequestLine, line_id)

    def list_requests(self, status_value: str | None = None, requested_by_user_id: int | None = None) -> list[StockRequest]:
        stmt = select(StockRequest)
        if status_value:
            stmt = stmt.where(StockRequest.status == status_value)
        if requested_by_user_id is not None:
            stmt = stmt.where(StockRequest.requested_by_user_id == requested_by_user_id)
        return self.db.scalars(stmt.order_by(StockRequest.created_at.desc())).all()

    def add(self, instance: object) -> None:
        self.db.add(instance)

    def get_item_instance(self, instance_id: int) -> ItemInstance | None:
        return self.db.get(ItemInstance, instance_id)

    def list_available_instances(self, part_id: int, limit: int) -> list[ItemInstance]:
        stmt = (
            select(ItemInstance)
            .where(ItemInstance.part_id == part_id, ItemInstance.status == ItemStatus.AVAILABLE)
            .limit(limit)
        )
        return self.db.scalars(stmt).all()

    def count_available_instances(self, part_id: int) -> int:
        stmt = select(func.count(ItemInstance.id)).where(
            ItemInstance.part_id == part_id,
            ItemInstance.status == ItemStatus.AVAILABLE,
        )
        return int(self.db.scalar(stmt) or 0)

    def get_latest_issue_transaction(self, item_instance_id: int, technician_id: int) -> StockTransaction | None:
        stmt = (
            select(StockTransaction)
            .where(
                StockTransaction.item_instance_id == item_instance_id,
                StockTransaction.technician_id == technician_id,
                StockTransaction.transaction_type == StockTransactionType.OUT,
            )
            .order_by(StockTransaction.created_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def get_latest_issue_transaction_any(self, item_instance_id: int) -> StockTransaction | None:
        stmt = (
            select(StockTransaction)
            .where(
                StockTransaction.item_instance_id == item_instance_id,
                StockTransaction.transaction_type == StockTransactionType.OUT,
            )
            .order_by(StockTransaction.created_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def get_latest_issued_batch(
        self,
        part_id: int,
        technician_id: int,
        request_id: int | None = None,
    ) -> IssuedBatchItem | None:
        stmt = select(IssuedBatchItem).where(
            IssuedBatchItem.part_id == part_id,
            IssuedBatchItem.technician_id == technician_id,
            IssuedBatchItem.quantity_remaining > 0,
        )
        if request_id is not None:
            stmt = stmt.where(IssuedBatchItem.request_id == request_id)
        stmt = stmt.order_by(IssuedBatchItem.created_at.desc()).limit(1)
        return self.db.scalars(stmt).first()

    def find_issued_batch_for_return(
        self,
        part_id: int,
        request_id: int | None = None,
        technician_id: int | None = None,
    ) -> IssuedBatchItem | None:
        stmt = select(IssuedBatchItem).where(IssuedBatchItem.part_id == part_id)
        if request_id is not None:
            stmt = stmt.where(IssuedBatchItem.request_id == request_id)
        if technician_id is not None:
            stmt = stmt.where(IssuedBatchItem.technician_id == technician_id)
        stmt = stmt.order_by(IssuedBatchItem.created_at.desc()).limit(1)
        return self.db.scalars(stmt).first()

    def list_outbound_instance_transactions_for_request(self, request_id: int):
        stmt = (
            select(StockTransaction)
            .where(
                StockTransaction.request_id == request_id,
                StockTransaction.transaction_type == StockTransactionType.OUT,
                StockTransaction.item_instance_id.is_not(None),
            )
            .order_by(StockTransaction.created_at.desc())
        )
        return self.db.scalars(stmt).all()

    def list_outbound_instance_transactions_for_technician(self, technician_id: int) -> list[StockTransaction]:
        stmt = (
            select(StockTransaction)
            .where(
                StockTransaction.technician_id == technician_id,
                StockTransaction.transaction_type == StockTransactionType.OUT,
                StockTransaction.item_instance_id.is_not(None),
            )
            .order_by(StockTransaction.created_at.desc())
        )
        return self.db.scalars(stmt).all()

    def list_issued_batches_for_technician(self, technician_id: int) -> list[IssuedBatchItem]:
        stmt = (
            select(IssuedBatchItem)
            .where(
                IssuedBatchItem.technician_id == technician_id,
                IssuedBatchItem.quantity_remaining > 0,
            )
            .order_by(IssuedBatchItem.created_at.desc())
        )
        return self.db.scalars(stmt).all()

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: object) -> None:
        self.db.refresh(instance)

    def rollback(self) -> None:
        self.db.rollback()

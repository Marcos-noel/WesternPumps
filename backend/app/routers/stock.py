from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, desc, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.event_stream import emit_domain_event
from app.models import StockTransaction, StockTransactionType as ModelStockTransactionType, User
from app.repositories import InventoryRepository
from app.schemas import StockTransactionCreate, StockTransactionRead, StockTrendPoint, StockUsageRead
from app.services import ServiceError, StockService


router = APIRouter(prefix="/api/stock", tags=["stock"])


class ReturnPayload(BaseModel):
    part_id: int | None = None
    item_instance_id: int | None = None
    quantity: int = 1
    condition: str = "GOOD"
    notes: str | None = None
    request_id: int | None = None
    technician_id: int | None = None
    return_proof_token: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ReturnDecisionPayload(BaseModel):
    comment: str | None = Field(default=None, max_length=1000)
    reason: str | None = Field(default=None, min_length=2, max_length=1000)


class PendingReturnRead(BaseModel):
    id: int
    part_id: int
    part_sku: str
    part_name: str
    item_instance_id: int | None = None
    quantity: int
    condition: str
    request_id: int | None = None
    technician_id: int | None = None
    submitted_by_user_id: int | None = None
    submitted_by_email: str | None = None
    notes: str = ""
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime


class ReturnSubmissionRead(BaseModel):
    id: int
    status: str
    part_id: int
    part_sku: str
    part_name: str
    item_instance_id: int | None = None
    quantity: int
    condition: str
    request_id: int | None = None
    notes: str = ""
    created_at: datetime


def _service(db: Session) -> StockService:
    return StockService(InventoryRepository(db))


def _handle_service_error(exc: ServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get(
    "/transactions",
    response_model=list[StockTransactionRead],
    dependencies=[Depends(require_roles("store_manager", "manager", "approver"))],
)
def list_transactions(
    db: Session = Depends(get_db),
    part_id: int | None = Query(None, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> list[StockTransactionRead]:
    stmt = select(StockTransaction)
    if part_id is not None:
        stmt = stmt.where(StockTransaction.part_id == part_id)
    transactions = db.scalars(stmt.order_by(StockTransaction.created_at.desc()).limit(limit)).all()
    return [StockTransactionRead.model_validate(t, from_attributes=True) for t in transactions]


@router.get(
    "/lifecycle",
    response_model=list[StockTransactionRead],
)
def list_lifecycle_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    technician_id: int | None = Query(None, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> list[StockTransactionRead]:
    role = (current_user.role or "").strip().lower()
    is_privileged = role in {"admin", "manager", "store_manager", "approver"}
    target_technician_id = technician_id if is_privileged else current_user.id

    if not is_privileged and technician_id is not None and technician_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own lifecycle activity")

    stmt = select(StockTransaction).where(StockTransaction.movement_type.in_(["ISSUE", "RETURN", "FAULTY_RETURN"]))
    if target_technician_id is not None:
        stmt = stmt.where(StockTransaction.technician_id == target_technician_id)
    transactions = db.scalars(stmt.order_by(StockTransaction.created_at.desc()).limit(limit)).all()
    return [StockTransactionRead.model_validate(t, from_attributes=True) for t in transactions]


@router.get(
    "/usage",
    response_model=list[StockUsageRead],
    dependencies=[Depends(require_roles("store_manager", "manager", "approver"))],
)
def list_usage(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(5, ge=1, le=50),
) -> list[StockUsageRead]:
    start = datetime.utcnow() - timedelta(days=days - 1)
    stmt = (
        select(
            StockTransaction.part_id,
            func.sum(func.abs(StockTransaction.quantity_delta)).label("total"),
        )
        .where(StockTransaction.transaction_type == ModelStockTransactionType.OUT)
        .where(StockTransaction.created_at >= start)
        .group_by(StockTransaction.part_id)
        .order_by(desc("total"))
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [StockUsageRead(part_id=row.part_id, total=int(row.total or 0)) for row in rows]


@router.get(
    "/trend",
    response_model=list[StockTrendPoint],
    dependencies=[Depends(require_roles("store_manager", "manager", "approver"))],
)
def list_trend(
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=365),
) -> list[StockTrendPoint]:
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days - 1)
    start_dt = datetime.combine(start_date, datetime.min.time())

    bucket = func.date(StockTransaction.created_at)
    stmt = (
        select(
            bucket.label("bucket"),
            func.sum(StockTransaction.quantity_delta).label("net"),
            func.sum(
                case(
                    (StockTransaction.quantity_delta > 0, StockTransaction.quantity_delta),
                    else_=0,
                )
            ).label("inbound"),
            func.sum(
                case(
                    (StockTransaction.quantity_delta < 0, -StockTransaction.quantity_delta),
                    else_=0,
                )
            ).label("outbound"),
        )
        .where(StockTransaction.created_at >= start_dt)
        .group_by(bucket)
        .order_by(bucket)
    )
    rows = db.execute(stmt).all()
    by_bucket = {}
    for row in rows:
        key = row.bucket.isoformat() if hasattr(row.bucket, "isoformat") else str(row.bucket)
        by_bucket[key] = {
            "net": int(row.net or 0),
            "inbound": int(row.inbound or 0),
            "outbound": int(row.outbound or 0),
        }

    points: list[StockTrendPoint] = []
    cursor = start_date
    while cursor <= end_date:
        key = cursor.isoformat()
        values = by_bucket.get(key, {"net": 0, "inbound": 0, "outbound": 0})
        points.append(
            StockTrendPoint(
                date=key,
                net=values["net"],
                inbound=values["inbound"],
                outbound=values["outbound"],
            )
        )
        cursor += timedelta(days=1)

    return points


@router.post(
    "/transactions",
    response_model=StockTransactionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("store_manager", "manager"))],
)
def create_transaction(
    payload: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockTransactionRead:
    service = _service(db)
    try:
        tx = service.create_transaction(
            current_user=current_user,
            part_id=payload.part_id,
            transaction_type=payload.transaction_type.value,
            quantity_delta=payload.quantity_delta,
            supplier_id=payload.supplier_id,
            notes=payload.notes,
            request_id=payload.request_id,
            technician_id=payload.technician_id,
            customer_id=payload.customer_id,
            job_id=payload.job_id,
            item_instance_id=payload.item_instance_id,
            movement_type=payload.movement_type,
            grn_number=payload.grn_number,
        )
    except ServiceError as exc:
        _handle_service_error(exc)
    emit_domain_event(
        db,
        event_type="stock.transaction_created",
        actor_user_id=current_user.id,
        payload={"transaction_id": tx.id, "part_id": tx.part_id, "quantity_delta": tx.quantity_delta, "transaction_type": tx.transaction_type.value},
    )
    return StockTransactionRead.model_validate(tx, from_attributes=True)


@router.post(
    "/return",
    response_model=StockTransactionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("technician", "lead_technician", "store_manager", "manager"))],
)
def return_stock(
    payload: ReturnPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockTransactionRead:
    service = _service(db)
    try:
        tx = service.return_stock(
            current_user=current_user,
            part_id=payload.part_id,
            item_instance_id=payload.item_instance_id,
            quantity=payload.quantity,
            condition=payload.condition,
            notes=payload.notes,
            request_id=payload.request_id,
            technician_id=payload.technician_id,
            return_proof_token=payload.return_proof_token,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
    except ServiceError as exc:
        _handle_service_error(exc)
    emit_domain_event(
        db,
        event_type="stock.return_submitted_or_recorded",
        actor_user_id=current_user.id,
        payload={"transaction_id": tx.id, "part_id": tx.part_id, "request_id": tx.request_id},
    )
    return StockTransactionRead.model_validate(tx, from_attributes=True)


@router.get(
    "/returns/pending",
    response_model=list[PendingReturnRead],
    dependencies=[Depends(require_roles("store_manager", "manager", "approver", "admin"))],
)
def list_pending_returns(
    db: Session = Depends(get_db),
) -> list[PendingReturnRead]:
    service = _service(db)
    rows = service.list_pending_returns()
    return [PendingReturnRead.model_validate(row) for row in rows]


@router.get(
    "/returns/mine",
    response_model=list[ReturnSubmissionRead],
    dependencies=[Depends(require_roles("technician", "lead_technician", "staff", "store_manager", "manager", "approver", "finance", "admin"))],
)
def list_my_return_submissions(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReturnSubmissionRead]:
    service = _service(db)
    rows = service.list_my_return_submissions(current_user=current_user, limit=limit)
    return [ReturnSubmissionRead.model_validate(row) for row in rows]


@router.post(
    "/returns/{pending_return_id}/approve",
    response_model=StockTransactionRead,
    dependencies=[Depends(require_roles("store_manager", "manager", "approver", "admin"))],
)
def approve_pending_return(
    pending_return_id: int,
    payload: ReturnDecisionPayload | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockTransactionRead:
    service = _service(db)
    try:
        tx = service.approve_pending_return(
            pending_transaction_id=pending_return_id,
            approver=current_user,
            manager_remark=payload.comment if payload else None,
        )
    except ServiceError as exc:
        _handle_service_error(exc)
    emit_domain_event(
        db,
        event_type="stock.return_approved",
        actor_user_id=current_user.id,
        payload={"transaction_id": tx.id, "part_id": tx.part_id, "request_id": tx.request_id},
    )
    return StockTransactionRead.model_validate(tx, from_attributes=True)


@router.post(
    "/returns/{pending_return_id}/reject",
    response_model=StockTransactionRead,
    dependencies=[Depends(require_roles("store_manager", "manager", "approver", "admin"))],
)
def reject_pending_return(
    pending_return_id: int,
    payload: ReturnDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockTransactionRead:
    reason = (payload.reason or payload.comment or "").strip()
    if len(reason) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rejection reason is required")
    service = _service(db)
    try:
        tx = service.reject_pending_return(
            pending_transaction_id=pending_return_id,
            approver=current_user,
            reason=reason,
        )
    except ServiceError as exc:
        _handle_service_error(exc)
    emit_domain_event(
        db,
        event_type="stock.return_rejected",
        actor_user_id=current_user.id,
        payload={"pending_transaction_id": pending_return_id, "reason": reason},
    )
    return StockTransactionRead.model_validate(tx, from_attributes=True)

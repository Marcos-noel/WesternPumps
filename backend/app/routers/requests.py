from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_approver, require_roles
from app.models import (
    ItemInstance,
    ItemStatus,
    Part,
    StockRequest,
    StockRequestLine,
    StockRequestStatus,
    StockTransaction,
    StockTransactionType as ModelStockTransactionType,
    UsageRecord,
    User,
)
from app.schemas import StockRequestCreate, StockRequestRead, UsageRecordCreate, UsageRecordRead


router = APIRouter(prefix="/api/requests", tags=["requests"])


def get_required_role(total_value: float | None) -> str:
    if total_value is None:
        return "manager"
    if total_value <= settings.approval_threshold_manager:
        return "manager"
    return "admin"


@router.post("", response_model=StockRequestRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("technician"))])
def create_request(payload: StockRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> StockRequestRead:
    if not payload.lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one line item is required")

    total_value = 0.0
    lines: list[StockRequestLine] = []
    for line in payload.lines:
        part = db.get(Part, line.part_id)
        if not part:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid part_id {line.part_id}")
        unit_cost = float(part.unit_price or 0)
        total_value += unit_cost * line.quantity
        lines.append(
            StockRequestLine(
                part_id=part.id,
                quantity=line.quantity,
                unit_cost=unit_cost,
                tracking_type=part.tracking_type,
            )
        )

    request = StockRequest(
        requested_by_user_id=current_user.id,
        customer_id=payload.customer_id,
        job_id=payload.job_id,
        status=StockRequestStatus.PENDING,
        total_value=total_value,
        required_approval_role=get_required_role(total_value),
    )
    request.lines = lines
    db.add(request)
    db.commit()
    db.refresh(request)
    return StockRequestRead.model_validate(request, from_attributes=True)


@router.get("", response_model=list[StockRequestRead], dependencies=[Depends(get_current_user)])
def list_requests(
    db: Session = Depends(get_db),
    status: str | None = Query(None, max_length=20),
    mine: bool = Query(False),
    current_user: User = Depends(get_current_user),
) -> list[StockRequestRead]:
    stmt = select(StockRequest)
    if status:
        stmt = stmt.where(StockRequest.status == status)
    if mine:
        stmt = stmt.where(StockRequest.requested_by_user_id == current_user.id)
    requests = db.scalars(stmt.order_by(StockRequest.created_at.desc())).all()
    return [StockRequestRead.model_validate(r, from_attributes=True) for r in requests]


@router.post("/{request_id}/approve", response_model=StockRequestRead, dependencies=[Depends(require_approver)])
def approve_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockRequestRead:
    request = db.get(StockRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if request.status != StockRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    if request.required_approval_role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin approval required")

    request.status = StockRequestStatus.APPROVED
    request.approved_by_user_id = current_user.id
    request.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return StockRequestRead.model_validate(request, from_attributes=True)


class RejectPayload(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


@router.post("/{request_id}/reject", response_model=StockRequestRead, dependencies=[Depends(require_approver)])
def reject_request(
    request_id: int,
    payload: RejectPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockRequestRead:
    request = db.get(StockRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if request.status != StockRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    if request.required_approval_role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin approval required")

    request.status = StockRequestStatus.REJECTED
    request.rejected_reason = payload.reason
    request.approved_by_user_id = current_user.id
    request.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return StockRequestRead.model_validate(request, from_attributes=True)


class IssueLine(BaseModel):
    line_id: int
    quantity: int = Field(default=1, ge=1)
    item_instance_ids: list[int] = Field(default_factory=list)


class IssuePayload(BaseModel):
    lines: list[IssueLine]


@router.post("/{request_id}/issue", response_model=StockRequestRead, dependencies=[Depends(require_roles("store_manager"))])
def issue_request(
    request_id: int,
    payload: IssuePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockRequestRead:
    request = db.get(StockRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if request.status != StockRequestStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not approved")

    technician_id = request.requested_by_user_id
    for line in payload.lines:
        req_line = db.get(StockRequestLine, line.line_id)
        if not req_line or req_line.request_id != request.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request line")
        part = db.get(Part, req_line.part_id)
        if not part:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid part")

        if part.tracking_type == "INDIVIDUAL":
            instance_ids = line.item_instance_ids
            if not instance_ids:
                instance_ids = [
                    i.id
                    for i in db.scalars(
                        select(ItemInstance)
                        .where(ItemInstance.part_id == part.id, ItemInstance.status == ItemStatus.AVAILABLE)
                        .limit(req_line.quantity)
                    ).all()
                ]
            if len(instance_ids) != req_line.quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough available instances")
            for instance_id in instance_ids:
                inst = db.get(ItemInstance, instance_id)
                if not inst or inst.part_id != part.id:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid item instance")
                if inst.status != ItemStatus.AVAILABLE:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item instance not available")
                inst.status = ItemStatus.ISSUED
                part.quantity_on_hand -= 1
                db.add(
                    StockTransaction(
                        part_id=part.id,
                        created_by_user_id=current_user.id,
                        technician_id=technician_id,
                        customer_id=request.customer_id,
                        job_id=request.job_id,
                        request_id=request.id,
                        item_instance_id=inst.id,
                        transaction_type=ModelStockTransactionType.OUT,
                        quantity_delta=-1,
                        movement_type="ISSUE",
                    )
                )
        else:
            if line.quantity <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be positive")
            if part.quantity_on_hand < line.quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock")
            part.quantity_on_hand -= line.quantity
            db.add(
                StockTransaction(
                    part_id=part.id,
                    created_by_user_id=current_user.id,
                    technician_id=technician_id,
                    customer_id=request.customer_id,
                    job_id=request.job_id,
                    request_id=request.id,
                    transaction_type=ModelStockTransactionType.OUT,
                    quantity_delta=-line.quantity,
                    movement_type="ISSUE",
                )
            )

    request.status = StockRequestStatus.ISSUED
    db.commit()
    db.refresh(request)
    return StockRequestRead.model_validate(request, from_attributes=True)


@router.post("/usage", response_model=UsageRecordRead, dependencies=[Depends(require_roles("technician"))])
def record_usage(
    payload: UsageRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UsageRecordRead:
    instance = db.get(ItemInstance, payload.item_instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid item_instance_id")
    if instance.status not in {ItemStatus.ISSUED, ItemStatus.AVAILABLE}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item is not in a usable state")

    instance.status = ItemStatus.USED
    usage = UsageRecord(
        item_instance_id=payload.item_instance_id,
        request_id=payload.request_id,
        technician_id=current_user.id,
        customer_id=payload.customer_id,
        job_id=payload.job_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(usage)
    db.commit()
    db.refresh(usage)
    return UsageRecordRead.model_validate(usage, from_attributes=True)

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.event_stream import emit_domain_event
from app.models import DeliveryRequest, DeliveryRequestStatus, StockRequest, User
from app.notifications import dispatch_alert
from app.schemas import DeliveryRequestAssign, DeliveryRequestCancel, DeliveryRequestCreate, DeliveryRequestRead, DeliveryRequestReject


router = APIRouter(prefix="/api/deliveries", tags=["deliveries"])


def _is_store_role(role: str) -> bool:
    return role in {"admin", "manager", "store_manager"}


def _is_courier_role(role: str) -> bool:
    return role in {"rider", "driver"}


@router.post(
    "",
    response_model=DeliveryRequestRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("technician", "lead_technician", "staff", "manager", "store_manager", "admin"))],
)
def create_delivery_request(
    payload: DeliveryRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    technician_id = int(payload.technician_id or current_user.id)
    if current_user.role in {"technician", "lead_technician", "staff"} and technician_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only request delivery for yourself.")
    technician = db.get(User, technician_id)
    if not technician or not technician.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid technician.")

    request: StockRequest | None = None
    if payload.stock_request_id is not None:
        request = db.get(StockRequest, int(payload.stock_request_id))
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock request not found.")
        if current_user.role in {"technician", "lead_technician", "staff"} and request.requested_by_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create delivery for another technician request.")
    equipment_summary = payload.equipment_summary.strip()
    if len(equipment_summary) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Equipment summary is required.")

    row = DeliveryRequest(
        stock_request_id=payload.stock_request_id,
        technician_id=technician_id,
        requested_by_user_id=current_user.id,
        delivery_mode=payload.delivery_mode,
        status=DeliveryRequestStatus.PENDING,
        pickup_location=(payload.pickup_location or "").strip() or "Store",
        dropoff_location=(payload.dropoff_location or "").strip() or None,
        equipment_summary=equipment_summary,
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    log_audit(
        db,
        current_user,
        action="create",
        entity_type="delivery_request",
        detail={"stock_request_id": payload.stock_request_id, "delivery_mode": payload.delivery_mode},
    )
    db.commit()
    db.refresh(row)

    dispatch_alert(
        db,
        actor=current_user,
        event="delivery_request_created",
        subject=f"Delivery request #{row.id} created",
        body=f"{current_user.email} requested {row.delivery_mode.lower()} support for technician user #{row.technician_id}. Awaiting approval.",
    )
    emit_domain_event(
        db,
        event_type="delivery.requested",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status), "mode": row.delivery_mode},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


@router.post("/{delivery_id}/approve", response_model=DeliveryRequestRead, dependencies=[Depends(require_roles("admin", "manager", "store_manager", "approver"))])
def approve_delivery_request(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    if row.status != DeliveryRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending deliveries can be approved.")
    if row.approved_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery is already approved.")

    row.status = DeliveryRequestStatus.PENDING
    row.approved_by_user_id = current_user.id
    row.approved_at = datetime.now(UTC)
    row.rejected_reason = None
    log_audit(db, current_user, action="approve", entity_type="delivery_request", entity_id=row.id)
    db.commit()
    db.refresh(row)
    dispatch_alert(
        db,
        actor=current_user,
        event="delivery_request_approved",
        subject=f"Delivery request #{row.id} approved",
        body=f"Delivery request #{row.id} is approved and ready for rider/driver assignment.",
    )
    emit_domain_event(
        db,
        event_type="delivery.approved",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status), "approved": True},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


@router.post("/{delivery_id}/reject", response_model=DeliveryRequestRead, dependencies=[Depends(require_roles("admin", "manager", "store_manager", "approver"))])
def reject_delivery_request(
    delivery_id: int,
    payload: DeliveryRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    if row.status != DeliveryRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending deliveries can be rejected.")
    if row.approved_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approved delivery cannot be rejected. Cancel it instead.")

    row.status = DeliveryRequestStatus.CANCELED
    row.rejected_reason = payload.reason.strip()
    row.approved_by_user_id = current_user.id
    row.approved_at = datetime.now(UTC)
    log_audit(db, current_user, action="reject", entity_type="delivery_request", entity_id=row.id, detail={"reason": row.rejected_reason})
    db.commit()
    db.refresh(row)
    emit_domain_event(
        db,
        event_type="delivery.rejected",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status), "rejected": True},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


@router.get("", response_model=list[DeliveryRequestRead], dependencies=[Depends(get_current_user)])
def list_delivery_requests(
    mine: bool = Query(False),
    status_value: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DeliveryRequestRead]:
    stmt = select(DeliveryRequest).order_by(DeliveryRequest.created_at.desc())
    if _is_store_role(current_user.role):
        if mine:
            stmt = stmt.where(DeliveryRequest.requested_by_user_id == current_user.id)
    elif _is_courier_role(current_user.role):
        stmt = stmt.where(
            or_(
                DeliveryRequest.assigned_to_user_id == current_user.id,
                (DeliveryRequest.status == DeliveryRequestStatus.PENDING) & DeliveryRequest.approved_at.is_not(None),
            )
        )
    else:
        stmt = stmt.where(DeliveryRequest.technician_id == current_user.id)

    if status_value:
        normalized = status_value.strip().upper()
        if normalized in {s.value for s in DeliveryRequestStatus}:
            stmt = stmt.where(DeliveryRequest.status == DeliveryRequestStatus(normalized))

    rows = db.scalars(stmt).all()
    return [DeliveryRequestRead.model_validate(row, from_attributes=True) for row in rows]


@router.post("/{delivery_id}/assign", response_model=DeliveryRequestRead, dependencies=[Depends(require_roles("admin", "manager", "store_manager"))])
def assign_delivery_request(
    delivery_id: int,
    payload: DeliveryRequestAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    assignee = db.get(User, payload.assignee_user_id)
    if not assignee or not assignee.is_active or assignee.role not in {"rider", "driver"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignee must be an active rider/driver.")
    if row.status in {DeliveryRequestStatus.DELIVERED, DeliveryRequestStatus.CANCELED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery is already closed.")
    if row.status != DeliveryRequestStatus.PENDING or row.approved_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery must be approved before assignment.")

    row.assigned_to_user_id = assignee.id
    row.status = DeliveryRequestStatus.ACCEPTED
    row.accepted_at = datetime.now(UTC)
    log_audit(db, current_user, action="assign", entity_type="delivery_request", entity_id=row.id, detail={"assignee": assignee.id})
    db.commit()
    db.refresh(row)
    emit_domain_event(
        db,
        event_type="delivery.assigned",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "assignee_user_id": assignee.id, "status": str(row.status)},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


@router.post("/{delivery_id}/claim", response_model=DeliveryRequestRead, dependencies=[Depends(require_roles("rider", "driver"))])
def claim_delivery_request(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    if row.status != DeliveryRequestStatus.PENDING or row.approved_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved deliveries can be claimed.")

    row.assigned_to_user_id = current_user.id
    row.status = DeliveryRequestStatus.ACCEPTED
    row.accepted_at = datetime.now(UTC)
    log_audit(db, current_user, action="claim", entity_type="delivery_request", entity_id=row.id)
    db.commit()
    db.refresh(row)
    emit_domain_event(
        db,
        event_type="delivery.claimed",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status)},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


def _ensure_delivery_owner(row: DeliveryRequest, current_user: User) -> None:
    if _is_store_role(current_user.role):
        return
    if row.assigned_to_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Delivery is assigned to another user.")


@router.post("/{delivery_id}/pickup", response_model=DeliveryRequestRead, dependencies=[Depends(require_roles("rider", "driver", "admin", "manager", "store_manager"))])
def mark_delivery_picked_up(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    _ensure_delivery_owner(row, current_user)
    if row.status not in {DeliveryRequestStatus.ACCEPTED, DeliveryRequestStatus.PICKED_UP}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery must be accepted before pickup.")
    row.status = DeliveryRequestStatus.PICKED_UP
    row.picked_up_at = datetime.now(UTC)
    log_audit(db, current_user, action="pickup", entity_type="delivery_request", entity_id=row.id)
    db.commit()
    db.refresh(row)
    emit_domain_event(
        db,
        event_type="delivery.picked_up",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status)},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


@router.post("/{delivery_id}/deliver", response_model=DeliveryRequestRead, dependencies=[Depends(require_roles("rider", "driver", "admin", "manager", "store_manager"))])
def mark_delivery_delivered(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    _ensure_delivery_owner(row, current_user)
    if row.status not in {DeliveryRequestStatus.ACCEPTED, DeliveryRequestStatus.PICKED_UP}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery must be accepted before completion.")

    row.status = DeliveryRequestStatus.DELIVERED
    row.delivered_at = datetime.now(UTC)
    if row.picked_up_at is None:
        row.picked_up_at = row.delivered_at
    log_audit(db, current_user, action="deliver", entity_type="delivery_request", entity_id=row.id)
    db.commit()
    db.refresh(row)
    dispatch_alert(
        db,
        actor=current_user,
        event="delivery_request_delivered",
        subject=f"Delivery request #{row.id} delivered",
        body=f"Delivery #{row.id} has been completed.",
    )
    emit_domain_event(
        db,
        event_type="delivery.delivered",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status)},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)


@router.post("/{delivery_id}/cancel", response_model=DeliveryRequestRead, dependencies=[Depends(get_current_user)])
def cancel_delivery_request(
    delivery_id: int,
    payload: DeliveryRequestCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRequestRead:
    row = db.get(DeliveryRequest, delivery_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found.")
    if row.status in {DeliveryRequestStatus.DELIVERED, DeliveryRequestStatus.CANCELED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery is already closed.")
    if not _is_store_role(current_user.role) and row.requested_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to cancel this delivery.")

    row.status = DeliveryRequestStatus.CANCELED
    row.canceled_reason = payload.reason.strip()
    log_audit(db, current_user, action="cancel", entity_type="delivery_request", entity_id=row.id, detail={"reason": row.canceled_reason})
    db.commit()
    db.refresh(row)
    emit_domain_event(
        db,
        event_type="delivery.canceled",
        actor_user_id=current_user.id,
        payload={"delivery_id": row.id, "status": str(row.status)},
    )
    return DeliveryRequestRead.model_validate(row, from_attributes=True)

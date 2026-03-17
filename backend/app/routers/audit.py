"""
Audit Log API - View system audit trail with tamper-evident hash verification
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import AuditLog, User

router = APIRouter(prefix="/api/audit", tags=["Audit"])


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity_type: str
    entity_id: Optional[int]
    detail: Optional[str]
    prev_hash: Optional[str]
    entry_hash: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


class HashVerificationResponse(BaseModel):
    is_valid: bool
    verified_entries: int
    total_entries: int
    first_invalid_hash: Optional[str]
    details: Optional[str]


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List audit logs with filtering and pagination"""
    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    # Apply filters
    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if action:
        filters.append(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)
    if start_date:
        filters.append(AuditLog.created_at >= start_date)
    if end_date:
        filters.append(AuditLog.created_at <= end_date)

    if filters:
        query = query.where(and_(*filters))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_query) or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    logs = db.scalars(query).all()

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log, from_attributes=True) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/verify-hash", response_model=HashVerificationResponse)
def verify_audit_hash_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify the integrity of the audit log hash chain.
    Returns verification status and details.
    """
    import hashlib

    logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()

    if not logs:
        return HashVerificationResponse(
            is_valid=True,
            verified_entries=0,
            total_entries=0,
            first_invalid_hash=None,
            details="No audit logs to verify",
        )

    verified = 0
    first_invalid = None

    for log in logs:
        # Build the basis for this entry
        basis = "|".join(
            [
                str(log.user_id or ""),
                log.action,
                log.entity_type,
                str(log.entity_id if log.entity_id is not None else ""),
                log.detail or "",
                log.prev_hash or "",
            ]
        )
        computed_hash = hashlib.sha256(basis.encode("utf-8")).hexdigest()

        if computed_hash == log.entry_hash:
            verified += 1
        else:
            first_invalid = f"Entry {log.id}: expected {computed_hash}, got {log.entry_hash}"
            break

    is_valid = verified == len(logs)

    return HashVerificationResponse(
        is_valid=is_valid,
        verified_entries=verified,
        total_entries=len(logs),
        first_invalid_hash=first_invalid,
        details="Hash chain verification complete" if is_valid else f"Hash mismatch at entry {log.id}",
    )


@router.get("/entity/{entity_type}/{entity_id}")
def get_entity_audit_trail(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get audit trail for a specific entity"""
    logs = (
        db.query(AuditLog)
        .filter(
            and_(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id,
            )
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    return [
        {
            "id": log.id,
            "action": log.action,
            "user_id": log.user_id,
            "detail": log.detail,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/actions")
def get_distinct_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of distinct action types in audit logs"""
    actions = db.query(AuditLog.action).distinct().all()
    return [a[0] for a in actions]


@router.get("/entity-types")
def get_distinct_entity_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of distinct entity types in audit logs"""
    types = db.query(AuditLog.entity_type).distinct().all()
    return [t[0] for t in types]

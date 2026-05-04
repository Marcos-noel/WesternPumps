from __future__ import annotations

from datetime import datetime, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import or_, select, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.audit import log_audit
from app.models import Supplier, Part, StockTransaction
from app.schemas import SupplierCreate, SupplierRead, SupplierUpdate


router = APIRouter(prefix="/api/suppliers", tags=["suppliers"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[SupplierRead])
def list_suppliers(
    db: Session = Depends(get_db),
    q: str | None = Query(None, max_length=200),
    include_inactive: bool = False,
) -> list[SupplierRead]:
    q_value = q.strip() if q else None

    stmt = select(Supplier)
    if not include_inactive:
        stmt = stmt.where(Supplier.is_active.is_(True))
    if q_value:
        like = f"%{q_value}%"
        stmt = stmt.where(or_(Supplier.name.like(like), Supplier.contact_name.like(like)))

    suppliers = db.scalars(stmt.order_by(Supplier.name.asc())).all()
    return [SupplierRead.model_validate(s, from_attributes=True) for s in suppliers]


@router.post("", response_model=SupplierRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> SupplierRead:
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    log_audit(db, current_user, "create", "supplier", detail=payload.model_dump())
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier name already exists")
    db.refresh(supplier)
    return SupplierRead.model_validate(supplier, from_attributes=True)


@router.patch("/{supplier_id}", response_model=SupplierRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> SupplierRead:
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, k, v)
    log_audit(db, current_user, "update", "supplier", entity_id=supplier_id, detail=payload.model_dump(exclude_unset=True))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier name already exists")
    db.refresh(supplier)
    return SupplierRead.model_validate(supplier, from_attributes=True)


@router.delete("/{supplier_id}", status_code=status.HTTP_200_OK, response_class=Response, dependencies=[Depends(require_roles("store_manager", "manager"))])
def deactivate_supplier(supplier_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> None:
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    supplier.is_active = False
    log_audit(db, current_user, "deactivate", "supplier", entity_id=supplier_id)
    db.commit()
    return None


# ============================================
# Supplier Report Endpoint
# ============================================

class SupplierReportResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    contact_name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    is_active: bool
    # Supply history
    total_parts_supplied: int
    total_transactions: int
    total_stock_in_value: float
    # Performance metrics
    avg_lead_time_days: Optional[float]
    # Recent transactions
    recent_transactions: list[dict]


@router.get("/{supplier_id}/report")
def get_supplier_report(
    supplier_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> SupplierReportResponse:
    """Get detailed supplier report with supply history and performance metrics"""
    if current_user.role not in ["store_manager", "manager", "admin", "finance"]:
        raise HTTPException(status_code=403, detail="Access denied")

    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Default date range: last 90 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = (datetime.combine(end_date, datetime.min.time()) - timedelta(days=90)).date()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Get parts from this supplier
    parts = db.query(Part).filter(Part.supplier_id == supplier_id).all()
    part_ids = [p.id for p in parts]

    # Get stock transactions for these parts
    transactions = []
    total_stock_in_value = 0
    if part_ids:
        txns = db.query(StockTransaction).filter(
            and_(
                StockTransaction.part_id.in_(part_ids),
                StockTransaction.transaction_type == "IN",
                StockTransaction.created_at >= start_dt,
                StockTransaction.created_at <= end_dt
            )
        ).order_by(StockTransaction.created_at.desc()).limit(20).all()

        for t in txns:
            qty = abs(t.quantity_change or 0)
            value = qty * (t.part.unit_price or 0) if t.part else 0
            total_stock_in_value += value
            transactions.append({
                "id": t.id,
                "part_name": t.part.name if t.part else "Unknown",
                "part_sku": t.part.sku if t.part else "Unknown",
                "quantity": qty,
                "value": value,
                "date": t.created_at.isoformat(),
            })

    # Calculate average lead time (from part.lead_time_days)
    lead_times = [p.lead_time_days for p in parts if p.lead_time_days]
    avg_lead_time = sum(lead_times) / len(lead_times) if lead_times else None

    return SupplierReportResponse(
        supplier_id=supplier.id,
        supplier_name=supplier.name,
        contact_name=supplier.contact_name,
        phone=supplier.phone,
        email=supplier.email,
        address=supplier.address,
        is_active=supplier.is_active,
        total_parts_supplied=len(parts),
        total_transactions=len(transactions),
        total_stock_in_value=round(total_stock_in_value, 2),
        avg_lead_time_days=avg_lead_time,
        recent_transactions=transactions,
    )


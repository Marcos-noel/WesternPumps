from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Supplier
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


@router.post("", response_model=SupplierRead)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)) -> SupplierRead:
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier name already exists")
    db.refresh(supplier)
    return SupplierRead.model_validate(supplier, from_attributes=True)


@router.patch("/{supplier_id}", response_model=SupplierRead)
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db)) -> SupplierRead:
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier name already exists")
    db.refresh(supplier)
    return SupplierRead.model_validate(supplier, from_attributes=True)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_supplier(supplier_id: int, db: Session = Depends(get_db)) -> None:
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    supplier.is_active = False
    db.commit()
    return None


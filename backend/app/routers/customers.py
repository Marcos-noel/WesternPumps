from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.audit import log_audit
from app.models import Customer
from app.schemas import CustomerCreate, CustomerRead, CustomerUpdate


router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerRead], dependencies=[Depends(get_current_user)])
def list_customers(db: Session = Depends(get_db)) -> list[CustomerRead]:
    customers = db.scalars(select(Customer).order_by(Customer.name.asc())).all()
    return [CustomerRead.model_validate(c, from_attributes=True) for c in customers]


@router.post("", response_model=CustomerRead, dependencies=[Depends(require_roles("technician", "store_manager", "manager"))])
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> CustomerRead:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    log_audit(db, current_user, "create", "customer", detail=payload.model_dump())
    db.commit()
    db.refresh(customer)
    return CustomerRead.model_validate(customer, from_attributes=True)


@router.get("/{customer_id}", response_model=CustomerRead, dependencies=[Depends(get_current_user)])
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> CustomerRead:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return CustomerRead.model_validate(customer, from_attributes=True)


@router.patch("/{customer_id}", response_model=CustomerRead, dependencies=[Depends(require_roles("technician", "store_manager", "manager"))])
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> CustomerRead:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(customer, k, v)
    log_audit(db, current_user, "update", "customer", entity_id=customer_id, detail=payload.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(customer)
    return CustomerRead.model_validate(customer, from_attributes=True)


@router.delete("/{customer_id}", status_code=status.HTTP_200_OK, response_class=Response, dependencies=[Depends(require_roles("manager"))])
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> None:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    db.delete(customer)
    log_audit(db, current_user, "delete", "customer", entity_id=customer_id)
    db.commit()
    return None


from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Part, StockTransaction, StockTransactionType as ModelStockTransactionType, Supplier, User
from app.schemas import StockTransactionCreate, StockTransactionRead


router = APIRouter(prefix="/api/stock", tags=["stock"])


@router.get("/transactions", response_model=list[StockTransactionRead], dependencies=[Depends(get_current_user)])
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


@router.post(
    "/transactions",
    response_model=StockTransactionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    payload: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockTransactionRead:
    part = db.get(Part, payload.part_id)
    if not part:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid part_id")

    if payload.supplier_id is not None and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid supplier_id")

    if payload.quantity_delta == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="quantity_delta must be non-zero")

    delta = payload.quantity_delta
    if payload.transaction_type.value == "IN":
        if delta < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IN transactions must be positive")
    elif payload.transaction_type.value == "OUT":
        if delta > 0:
            delta = -delta
    # ADJUST can be positive or negative.

    new_qoh = part.quantity_on_hand + delta
    if new_qoh < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock for this transaction")

    part.quantity_on_hand = new_qoh

    tx = StockTransaction(
        part_id=payload.part_id,
        supplier_id=payload.supplier_id,
        created_by_user_id=current_user.id,
        transaction_type=ModelStockTransactionType(payload.transaction_type.value),
        quantity_delta=delta,
        notes=payload.notes,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return StockTransactionRead.model_validate(tx, from_attributes=True)

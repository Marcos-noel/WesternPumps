from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.audit import log_audit
from app.deps import get_current_user, require_roles
from app.models import Category
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate


router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead], dependencies=[Depends(get_current_user)])
def list_categories(
    db: Session = Depends(get_db),
    include_inactive: bool = Query(False),
) -> list[CategoryRead]:
    stmt = select(Category)
    if not include_inactive:
        stmt = stmt.where(Category.is_active.is_(True))
    categories = db.scalars(stmt.order_by(Category.name.asc())).all()
    return [CategoryRead.model_validate(c, from_attributes=True) for c in categories]


@router.post("", response_model=CategoryRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> CategoryRead:
    if payload.parent_id and not db.get(Category, payload.parent_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent_id")

    category = Category(**payload.model_dump())
    db.add(category)
    log_audit(db, current_user, "create", "category", detail=payload.model_dump())
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    db.refresh(category)
    return CategoryRead.model_validate(category, from_attributes=True)


@router.patch("/{category_id}", response_model=CategoryRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> CategoryRead:
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    changes = payload.model_dump(exclude_unset=True)
    if "parent_id" in changes and changes["parent_id"] is not None and not db.get(Category, changes["parent_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent_id")

    for k, v in changes.items():
        setattr(category, k, v)
    log_audit(db, current_user, "update", "category", entity_id=category_id, detail=changes)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    db.refresh(category)
    return CategoryRead.model_validate(category, from_attributes=True)

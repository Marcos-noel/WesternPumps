from __future__ import annotations

import io
import uuid

import segno
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import Category, ItemInstance, Location, Part, Supplier
from app.schemas import (
    ItemCreate,
    ItemInstanceCreate,
    ItemInstanceRead,
    ItemRead,
    ItemUpdate,
    PaginatedItems,
    PartCreate,
    PartRead,
    PartUpdate,
)


router = APIRouter(prefix="/parts", tags=["parts"])
api_router = APIRouter(prefix="/api", tags=["inventory"])


@router.get("", response_model=list[PartRead], dependencies=[Depends(get_current_user)])
def list_parts(db: Session = Depends(get_db)) -> list[PartRead]:
    parts = db.scalars(select(Part).order_by(Part.name.asc())).all()
    return [PartRead.model_validate(p, from_attributes=True) for p in parts]


@router.post("", response_model=PartRead, dependencies=[Depends(get_current_user)])
def create_part(payload: PartCreate, db: Session = Depends(get_db)) -> PartRead:
    if payload.tracking_type not in {"BATCH", "INDIVIDUAL"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tracking_type")
    if payload.supplier_id is not None and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid supplier_id")
    if payload.category_id is not None and not db.get(Category, payload.category_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")
    if payload.location_id is not None and not db.get(Location, payload.location_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid location_id")

    part = Part(**payload.model_dump())
    db.add(part)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    db.refresh(part)
    return PartRead.model_validate(part, from_attributes=True)


@router.get("/{part_id}", response_model=PartRead, dependencies=[Depends(get_current_user)])
def get_part(part_id: int, db: Session = Depends(get_db)) -> PartRead:
    part = db.get(Part, part_id)
    if not part:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")
    return PartRead.model_validate(part, from_attributes=True)


@router.patch("/{part_id}", response_model=PartRead, dependencies=[Depends(get_current_user)])
def update_part(part_id: int, payload: PartUpdate, db: Session = Depends(get_db)) -> PartRead:
    part = db.get(Part, part_id)
    if not part:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")

    changes = payload.model_dump(exclude_unset=True)
    if "supplier_id" in changes and changes["supplier_id"] is not None and not db.get(Supplier, changes["supplier_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid supplier_id")
    if "category_id" in changes and changes["category_id"] is not None and not db.get(Category, changes["category_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")
    if "location_id" in changes and changes["location_id"] is not None and not db.get(Location, changes["location_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid location_id")
    if "tracking_type" in changes and changes["tracking_type"] not in {"BATCH", "INDIVIDUAL"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tracking_type")

    for k, v in changes.items():
        setattr(part, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    db.refresh(part)
    return PartRead.model_validate(part, from_attributes=True)


@router.delete("/{part_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user)])
def delete_part(part_id: int, db: Session = Depends(get_db)) -> None:
    part = db.get(Part, part_id)
    if not part:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")
    db.delete(part)
    db.commit()
    return None


@api_router.get("/items", response_model=PaginatedItems, dependencies=[Depends(get_current_user)])
def list_items(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=200),
    sort: str = Query("name", max_length=50),
    direction: str = Query("asc", max_length=4),
) -> PaginatedItems:
    q_value = q.strip() if q else None

    stmt = select(Part)
    count_stmt = select(func.count()).select_from(Part)

    if q_value:
        like = f"%{q_value}%"
        where = or_(Part.sku.like(like), Part.name.like(like))
        stmt = stmt.where(where)
        count_stmt = count_stmt.where(where)

    sort_map = {
        "name": Part.name,
        "sku": Part.sku,
        "quantity_on_hand": Part.quantity_on_hand,
        "min_quantity": Part.min_quantity,
        "created_at": Part.created_at,
        "updated_at": Part.updated_at,
    }
    if sort not in sort_map:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sort field")
    if direction not in {"asc", "desc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sort direction")

    order_by = sort_map[sort].asc() if direction == "asc" else sort_map[sort].desc()
    stmt = stmt.order_by(order_by).offset((page - 1) * page_size).limit(page_size)

    total = int(db.scalar(count_stmt) or 0)
    items = db.scalars(stmt).all()

    return PaginatedItems(
        items=[ItemRead.model_validate(p, from_attributes=True) for p in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@api_router.post("/items", response_model=ItemRead, dependencies=[Depends(get_current_user)])
def create_item(payload: ItemCreate, db: Session = Depends(get_db)) -> ItemRead:
    if payload.tracking_type not in {"BATCH", "INDIVIDUAL"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tracking_type")
    if payload.supplier_id is not None and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid supplier_id")
    if payload.category_id is not None and not db.get(Category, payload.category_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")
    if payload.location_id is not None and not db.get(Location, payload.location_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid location_id")

    item = Part(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    db.refresh(item)
    return ItemRead.model_validate(item, from_attributes=True)


@api_router.put("/items/{item_id}", response_model=ItemRead, dependencies=[Depends(get_current_user)])
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)) -> ItemRead:
    item = db.get(Part, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    changes = payload.model_dump(exclude_unset=True)
    if "supplier_id" in changes and changes["supplier_id"] is not None and not db.get(Supplier, changes["supplier_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid supplier_id")
    if "category_id" in changes and changes["category_id"] is not None and not db.get(Category, changes["category_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")
    if "location_id" in changes and changes["location_id"] is not None and not db.get(Location, changes["location_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid location_id")
    if "tracking_type" in changes and changes["tracking_type"] not in {"BATCH", "INDIVIDUAL"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tracking_type")

    for k, v in changes.items():
        setattr(item, k, v)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")

    db.refresh(item)
    return ItemRead.model_validate(item, from_attributes=True)


@api_router.get("/items/{item_id}/instances", response_model=list[ItemInstanceRead], dependencies=[Depends(get_current_user)])
def list_item_instances(
    item_id: int,
    db: Session = Depends(get_db),
    status: str | None = Query(None, max_length=20),
) -> list[ItemInstanceRead]:
    item = db.get(Part, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    stmt = select(ItemInstance).where(ItemInstance.part_id == item_id)
    if status:
        stmt = stmt.where(ItemInstance.status == status)
    instances = db.scalars(stmt.order_by(ItemInstance.created_at.desc())).all()
    return [ItemInstanceRead.model_validate(i, from_attributes=True) for i in instances]


@api_router.post(
    "/items/{item_id}/instances",
    response_model=ItemInstanceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("store_manager"))],
)
def create_item_instance(item_id: int, payload: ItemInstanceCreate, db: Session = Depends(get_db)) -> ItemInstanceRead:
    item = db.get(Part, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if item.tracking_type != "INDIVIDUAL":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item is not individually tracked")

    instance = ItemInstance(
        part_id=item_id,
        serial_number=payload.serial_number,
        status=payload.status,
        location_id=payload.location_id,
    )
    db.add(instance)
    item.quantity_on_hand += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Serial number already exists")
    db.refresh(instance)
    return ItemInstanceRead.model_validate(instance, from_attributes=True)


@api_router.post(
    "/items/{item_id}/instances/bulk",
    response_model=list[ItemInstanceRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("store_manager"))],
)
def create_item_instances_bulk(
    item_id: int,
    db: Session = Depends(get_db),
    quantity: int = Query(1, ge=1, le=200),
    prefix: str | None = Query(None, max_length=30),
) -> list[ItemInstanceRead]:
    item = db.get(Part, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if item.tracking_type != "INDIVIDUAL":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item is not individually tracked")

    created: list[ItemInstance] = []
    for _ in range(quantity):
        token = uuid.uuid4().hex[:8].upper()
        serial = f"{prefix or item.sku}-{token}"
        created.append(ItemInstance(part_id=item_id, serial_number=serial, status="AVAILABLE", location_id=item.location_id))

    db.add_all(created)
    item.quantity_on_hand += quantity
    db.commit()
    return [ItemInstanceRead.model_validate(i, from_attributes=True) for i in created]


@api_router.get("/items/{item_id}/qr", dependencies=[Depends(get_current_user)])
def get_item_qr(
    item_id: int,
    db: Session = Depends(get_db),
    data: str | None = Query(None, max_length=400),
    scale: int = Query(6, ge=2, le=16),
) -> Response:
    item = db.get(Part, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    payload = data.strip() if data else f"SKU:{item.sku}"
    qr = segno.make(payload, error="m")
    buf = io.StringIO()
    qr.save(buf, kind="svg", scale=scale, xmldecl=False)
    return Response(content=buf.getvalue(), media_type="image/svg+xml")


@api_router.get("/stock/low", response_model=list[ItemRead], dependencies=[Depends(get_current_user)])
def list_low_stock(
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=500),
    q: str | None = Query(None, max_length=200),
) -> list[ItemRead]:
    q_value = q.strip() if q else None

    stmt = select(Part).where(Part.quantity_on_hand <= Part.min_quantity)
    if q_value:
        like = f"%{q_value}%"
        stmt = stmt.where(or_(Part.sku.like(like), Part.name.like(like)))

    items = db.scalars(stmt.order_by(Part.quantity_on_hand.asc()).limit(limit)).all()
    return [ItemRead.model_validate(p, from_attributes=True) for p in items]

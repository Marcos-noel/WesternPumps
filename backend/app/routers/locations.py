from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import Location
from app.schemas import LocationCreate, LocationRead, LocationUpdate


router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=list[LocationRead], dependencies=[Depends(get_current_user)])
def list_locations(
    db: Session = Depends(get_db),
    include_inactive: bool = Query(False),
) -> list[LocationRead]:
    stmt = select(Location)
    if not include_inactive:
        stmt = stmt.where(Location.is_active.is_(True))
    locations = db.scalars(stmt.order_by(Location.name.asc())).all()
    return [LocationRead.model_validate(l, from_attributes=True) for l in locations]


@router.post("", response_model=LocationRead, dependencies=[Depends(require_roles("store_manager"))])
def create_location(payload: LocationCreate, db: Session = Depends(get_db)) -> LocationRead:
    location = Location(**payload.model_dump())
    db.add(location)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Location already exists")
    db.refresh(location)
    return LocationRead.model_validate(location, from_attributes=True)


@router.patch("/{location_id}", response_model=LocationRead, dependencies=[Depends(require_roles("store_manager"))])
def update_location(location_id: int, payload: LocationUpdate, db: Session = Depends(get_db)) -> LocationRead:
    location = db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(location, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Location already exists")
    db.refresh(location)
    return LocationRead.model_validate(location, from_attributes=True)

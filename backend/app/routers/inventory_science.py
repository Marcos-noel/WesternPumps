"""Inventory science endpoints: ABC analysis, forecasting, wave picking, RMA, cost layers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db import get_db
from app.deps import get_current_user
from app.models import (
    DemandForecast,
    InventoryMovementCost,
    Part,
    PartAnalysis,
    PickWave,
    ReturnAuthorization,
    User,
)
from app.schemas import (
    DemandForecastCreate,
    DemandForecastRead,
    InventoryMovementCostCreate,
    InventoryMovementCostRead,
    PartAnalysisRead,
    PartAnalysisUpdate,
    PickWaveCreate,
    PickWaveRead,
    PickWaveUpdate,
    ReturnAuthorizationCreate,
    ReturnAuthorizationRead,
    ReturnAuthorizationUpdate,
)

router = APIRouter(prefix="/api/inventory-science", tags=["inventory-science"])


# --- ABC Analysis Endpoints ---

@router.get("/part-analysis/{part_id}", response_model=PartAnalysisRead, dependencies=[Depends(get_current_user)])
def get_part_analysis(part_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PartAnalysisRead:
    """Get ABC analysis for a specific part."""
    analysis = db.execute(
        select(PartAnalysis).where(PartAnalysis.part_id == part_id)
    ).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part analysis not found")
    return PartAnalysisRead.model_validate(analysis, from_attributes=True)


@router.patch("/part-analysis/{part_id}", response_model=PartAnalysisRead)
def update_part_analysis(
    part_id: int,
    payload: PartAnalysisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PartAnalysisRead:
    """Update ABC analysis for a part."""
    analysis = db.execute(
        select(PartAnalysis).where(PartAnalysis.part_id == part_id)
    ).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part analysis not found")
    
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(analysis, key, value)
    
    db.commit()
    log_audit(db, current_user, "update", "part_analysis", detail={"part_id": part_id})
    db.refresh(analysis)
    return PartAnalysisRead.model_validate(analysis, from_attributes=True)


# --- Demand Forecast Endpoints ---

@router.get("/forecasts", response_model=list[DemandForecastRead], dependencies=[Depends(get_current_user)])
def list_forecasts(
    part_id: int | None = Query(None),
    period: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DemandForecastRead]:
    """List demand forecasts with optional filtering."""
    stmt = select(DemandForecast)
    if part_id:
        stmt = stmt.where(DemandForecast.part_id == part_id)
    if period:
        stmt = stmt.where(DemandForecast.forecast_period == period)
    stmt = stmt.limit(limit)
    forecasts = db.scalars(stmt).all()
    return [DemandForecastRead.model_validate(f, from_attributes=True) for f in forecasts]


@router.post("/forecasts", response_model=DemandForecastRead)
def create_forecast(
    payload: DemandForecastCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandForecastRead:
    """Create a new demand forecast."""
    forecast = DemandForecast(**payload.model_dump())
    db.add(forecast)
    db.commit()
    log_audit(db, current_user, "create", "demand_forecast", detail=payload.model_dump())
    db.refresh(forecast)
    return DemandForecastRead.model_validate(forecast, from_attributes=True)


# --- Pick Wave Endpoints ---

@router.get("/pick-waves", response_model=list[PickWaveRead], dependencies=[Depends(get_current_user)])
def list_pick_waves(
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PickWaveRead]:
    """List pick waves with optional status filter."""
    stmt = select(PickWave)
    if status:
        stmt = stmt.where(PickWave.status == status)
    stmt = stmt.order_by(PickWave.created_at.desc()).limit(limit)
    waves = db.scalars(stmt).all()
    return [PickWaveRead.model_validate(w, from_attributes=True) for w in waves]


@router.post("/pick-waves", response_model=PickWaveRead)
def create_pick_wave(
    payload: PickWaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PickWaveRead:
    """Create a new pick wave to batch requests."""
    wave = PickWave(**payload.model_dump())
    db.add(wave)
    db.commit()
    log_audit(db, current_user, "create", "pick_wave", detail=payload.model_dump())
    db.refresh(wave)
    return PickWaveRead.model_validate(wave, from_attributes=True)


@router.patch("/pick-waves/{wave_id}", response_model=PickWaveRead)
def update_pick_wave(
    wave_id: int,
    payload: PickWaveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PickWaveRead:
    """Update pick wave status and details."""
    wave = db.get(PickWave, wave_id)
    if not wave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pick wave not found")
    
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(wave, key, value)
    
    db.commit()
    log_audit(db, current_user, "update", "pick_wave", detail={"wave_id": wave_id})
    db.refresh(wave)
    return PickWaveRead.model_validate(wave, from_attributes=True)


# --- Return Authorization (RMA) Endpoints ---

@router.get("/returns", response_model=list[ReturnAuthorizationRead], dependencies=[Depends(get_current_user)])
def list_returns(
    status: str | None = Query(None),
    part_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReturnAuthorizationRead]:
    """List return authorizations with optional filtering."""
    stmt = select(ReturnAuthorization)
    if status:
        stmt = stmt.where(ReturnAuthorization.status == status)
    if part_id:
        stmt = stmt.where(ReturnAuthorization.part_id == part_id)
    stmt = stmt.order_by(ReturnAuthorization.created_at.desc()).limit(limit)
    returns = db.scalars(stmt).all()
    return [ReturnAuthorizationRead.model_validate(r, from_attributes=True) for r in returns]


@router.post("/returns", response_model=ReturnAuthorizationRead)
def create_return(
    payload: ReturnAuthorizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReturnAuthorizationRead:
    """Create a new return authorization (RMA)."""
    rma_number = f"RMA-{current_user.tenant_id}-{int(__import__('time').time() * 1000) % 1000000:06d}"
    rma = ReturnAuthorization(
        **payload.model_dump(),
        rma_number=rma_number,
        requested_by_user_id=current_user.id,
    )
    db.add(rma)
    db.commit()
    log_audit(db, current_user, "create", "return_authorization", detail={"rma_number": rma_number})
    db.refresh(rma)
    return ReturnAuthorizationRead.model_validate(rma, from_attributes=True)


@router.patch("/returns/{rma_id}", response_model=ReturnAuthorizationRead)
def update_return(
    rma_id: int,
    payload: ReturnAuthorizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReturnAuthorizationRead:
    """Update return authorization status and details."""
    rma = db.get(ReturnAuthorization, rma_id)
    if not rma:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return authorization not found")
    
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rma, key, value)
    
    db.commit()
    log_audit(db, current_user, "update", "return_authorization", detail={"rma_id": rma_id})
    db.refresh(rma)
    return ReturnAuthorizationRead.model_validate(rma, from_attributes=True)


# --- Cost Layer (FIFO/LIFO) Endpoints ---

@router.get("/cost-layers", response_model=list[InventoryMovementCostRead], dependencies=[Depends(get_current_user)])
def list_cost_layers(
    part_id: int | None = Query(None),
    method: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InventoryMovementCostRead]:
    """List inventory movement cost layers for FIFO/LIFO tracking."""
    stmt = select(InventoryMovementCost)
    if part_id:
        stmt = stmt.where(InventoryMovementCost.part_id == part_id)
    if method:
        stmt = stmt.where(InventoryMovementCost.cost_method == method)
    stmt = stmt.order_by(InventoryMovementCost.layer_date.asc()).limit(limit)
    layers = db.scalars(stmt).all()
    return [InventoryMovementCostRead.model_validate(l, from_attributes=True) for l in layers]


@router.post("/cost-layers", response_model=InventoryMovementCostRead)
def create_cost_layer(
    payload: InventoryMovementCostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryMovementCostRead:
    """Create a new cost layer for inventory movement tracking."""
    layer = InventoryMovementCost(**payload.model_dump())
    db.add(layer)
    db.commit()
    log_audit(db, current_user, "create", "inventory_movement_cost", detail=payload.model_dump())
    db.refresh(layer)
    return InventoryMovementCostRead.model_validate(layer, from_attributes=True)

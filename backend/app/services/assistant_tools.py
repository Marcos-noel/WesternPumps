from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.models import Part, StockTransaction, StockTransactionType, User
from app.services import ServiceError, StockService
from app.repositories import InventoryRepository


def _normalize_role(role: str) -> str:
    value = (role or "technician").strip().lower()
    if value == "staff":
        return "technician"
    return value


class CreateProductArgs(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    unit_price: float | None = Field(default=None, ge=0)
    quantity_on_hand: int = Field(default=0, ge=0)
    min_quantity: int = Field(default=0, ge=0)
    tracking_type: str = Field(default="BATCH", pattern="^(BATCH|INDIVIDUAL)$")
    category_id: int | None = Field(default=None, ge=1)
    location_id: int | None = Field(default=None, ge=1)
    supplier_id: int | None = Field(default=None, ge=1)
    image_url: str = Field(default="/assets/image.png", min_length=1, max_length=500)


class UpdateStockArgs(BaseModel):
    part_id: int = Field(ge=1)
    quantity_delta: int = Field(ne=0)
    notes: str | None = Field(default=None, max_length=1000)
    movement_type: str = Field(default="AI_ADJUST")


class DeleteProductArgs(BaseModel):
    part_id: int = Field(ge=1)


class GenerateReportArgs(BaseModel):
    report_type: str = Field(pattern="^(stock_level|stock_movement|audit_trail|forecast|item_traceability)$")
    format: str = Field(default="excel", pattern="^(excel|csv|pdf|docx)$")
    part_id: int | None = Field(default=None, ge=1)
    days: int = Field(default=30, ge=7, le=365)
    serial_number: str | None = Field(default=None, max_length=100)


class BulkUpdateLine(BaseModel):
    part_id: int = Field(ge=1)
    quantity_delta: int = Field(ne=0)
    notes: str | None = Field(default=None, max_length=1000)


class BulkUpdateStockArgs(BaseModel):
    updates: list[BulkUpdateLine] = Field(min_length=1, max_length=200)


class SetReorderThresholdArgs(BaseModel):
    part_id: int = Field(ge=1)
    min_quantity: int = Field(ge=0)


class ToolCall(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolExecutionResult(BaseModel):
    name: str
    success: bool
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    executed_at: str


def _service(db: Session) -> StockService:
    return StockService(InventoryRepository(db))


def _ensure_part(db: Session, part_id: int) -> Part:
    part = db.get(Part, part_id)
    if not part:
        raise ValueError("Product not found")
    return part


def _tool_create_product(db: Session, actor: User, args: CreateProductArgs) -> ToolExecutionResult:
    from app.sku import generate_system_sku

    part = Part(
        sku=generate_system_sku(db),
        name=args.name.strip(),
        description=args.description,
        unit_price=args.unit_price,
        quantity_on_hand=args.quantity_on_hand,
        min_quantity=args.min_quantity,
        tracking_type=args.tracking_type,
        category_id=args.category_id,
        location_id=args.location_id,
        supplier_id=args.supplier_id,
        image_url=args.image_url,
        is_active=True,
    )
    db.add(part)
    db.flush()
    if args.quantity_on_hand > 0:
        db.add(
            StockTransaction(
                part_id=part.id,
                created_by_user_id=actor.id,
                transaction_type=StockTransactionType.IN,
                quantity_delta=int(args.quantity_on_hand),
                movement_type="AI_INITIAL_STOCK",
                notes="AI product creation initial stock",
            )
        )
    log_audit(
        db,
        actor,
        action="ai_tool_create_product",
        entity_type="item",
        entity_id=part.id,
        detail=args.model_dump(),
    )
    db.commit()
    return ToolExecutionResult(
        name="createProduct",
        success=True,
        message=f"Product created: {part.name} ({part.sku})",
        data={"part_id": part.id, "sku": part.sku, "name": part.name},
        executed_at=datetime.utcnow().isoformat(),
    )


def _tool_update_stock(db: Session, actor: User, args: UpdateStockArgs) -> ToolExecutionResult:
    part = _ensure_part(db, args.part_id)
    tx = _service(db).create_transaction(
        current_user=actor,
        part_id=args.part_id,
        transaction_type=StockTransactionType.ADJUST.value,
        quantity_delta=args.quantity_delta,
        supplier_id=None,
        notes=args.notes or "AI stock update",
        request_id=None,
        technician_id=None,
        customer_id=None,
        job_id=None,
        item_instance_id=None,
        movement_type=args.movement_type,
        grn_number=None,
    )
    log_audit(
        db,
        actor,
        action="ai_tool_update_stock",
        entity_type="item",
        entity_id=args.part_id,
        detail={"quantity_delta": args.quantity_delta, "transaction_id": tx.id},
    )
    db.commit()
    db.refresh(part)
    return ToolExecutionResult(
        name="updateStock",
        success=True,
        message=f"Stock updated for {part.sku}: {args.quantity_delta:+d}",
        data={"part_id": args.part_id, "quantity_on_hand": int(part.quantity_on_hand)},
        executed_at=datetime.utcnow().isoformat(),
    )


def _tool_delete_product(db: Session, actor: User, args: DeleteProductArgs) -> ToolExecutionResult:
    part = _ensure_part(db, args.part_id)
    part.is_active = False
    log_audit(db, actor, action="ai_tool_delete_product", entity_type="item", entity_id=part.id, detail={"deactivated": True})
    db.commit()
    return ToolExecutionResult(
        name="deleteProduct",
        success=True,
        message=f"Product deactivated: {part.sku}",
        data={"part_id": part.id, "is_active": False},
        executed_at=datetime.utcnow().isoformat(),
    )


def _tool_generate_report(db: Session, actor: User, args: GenerateReportArgs) -> ToolExecutionResult:
    base = "/api/reports"
    if args.report_type == "stock_level":
        path = f"{base}/stock-level?format={args.format}"
    elif args.report_type == "stock_movement":
        path = f"{base}/stock-movement?format={args.format}"
    elif args.report_type == "audit_trail":
        path = f"{base}/audit-trail?format={args.format}"
    elif args.report_type == "forecast":
        path = f"{base}/forecast?days={args.days}"
    else:
        if not args.serial_number and not args.part_id:
            raise ValueError("item_traceability requires serial_number or part_id")
        serial_q = f"&serial_number={args.serial_number}" if args.serial_number else ""
        path = f"{base}/item-traceability?format={args.format}{serial_q}"
    log_audit(
        db,
        actor,
        action="ai_tool_generate_report",
        entity_type="report",
        detail=args.model_dump(),
    )
    db.commit()
    return ToolExecutionResult(
        name="generateReport",
        success=True,
        message="Report prepared. Use generated endpoint to download.",
        data={"endpoint": path, "report_type": args.report_type, "format": args.format},
        executed_at=datetime.utcnow().isoformat(),
    )


def _tool_bulk_update_stock(db: Session, actor: User, args: BulkUpdateStockArgs) -> ToolExecutionResult:
    tx_service = _service(db)
    applied: list[dict[str, Any]] = []
    for line in args.updates:
        part = _ensure_part(db, line.part_id)
        tx_service.create_transaction(
            current_user=actor,
            part_id=line.part_id,
            transaction_type=StockTransactionType.ADJUST.value,
            quantity_delta=line.quantity_delta,
            supplier_id=None,
            notes=line.notes or "AI bulk stock update",
            request_id=None,
            technician_id=None,
            customer_id=None,
            job_id=None,
            item_instance_id=None,
            movement_type="AI_BULK_ADJUST",
            grn_number=None,
        )
        db.refresh(part)
        applied.append(
            {
                "part_id": line.part_id,
                "sku": part.sku,
                "quantity_delta": line.quantity_delta,
                "quantity_on_hand": int(part.quantity_on_hand),
            }
        )
    log_audit(
        db,
        actor,
        action="ai_tool_bulk_update_stock",
        entity_type="item",
        detail={"count": len(applied), "updates": applied[:25]},
    )
    db.commit()
    return ToolExecutionResult(
        name="bulkUpdateStock",
        success=True,
        message=f"Bulk stock update completed for {len(applied)} product(s).",
        data={"updates": applied},
        executed_at=datetime.utcnow().isoformat(),
    )


def _tool_set_reorder_threshold(db: Session, actor: User, args: SetReorderThresholdArgs) -> ToolExecutionResult:
    part = _ensure_part(db, args.part_id)
    part.min_quantity = args.min_quantity
    log_audit(
        db,
        actor,
        action="ai_tool_set_reorder_threshold",
        entity_type="item",
        entity_id=part.id,
        detail={"min_quantity": args.min_quantity},
    )
    db.commit()
    return ToolExecutionResult(
        name="setReorderThreshold",
        success=True,
        message=f"Reorder threshold updated for {part.sku}",
        data={"part_id": part.id, "min_quantity": int(part.min_quantity)},
        executed_at=datetime.utcnow().isoformat(),
    )


@dataclass(frozen=True)
class ToolSpec:
    arg_model: type[BaseModel]
    allowed_roles: set[str]
    handler: Callable[[Session, User, BaseModel], ToolExecutionResult]


TOOL_REGISTRY: dict[str, ToolSpec] = {
    "createProduct": ToolSpec(
        arg_model=CreateProductArgs,
        allowed_roles={"admin", "manager", "store_manager"},
        handler=_tool_create_product,
    ),
    "updateStock": ToolSpec(
        arg_model=UpdateStockArgs,
        allowed_roles={"admin", "manager", "store_manager", "approver"},
        handler=_tool_update_stock,
    ),
    "deleteProduct": ToolSpec(
        arg_model=DeleteProductArgs,
        allowed_roles={"admin", "manager", "store_manager", "approver"},
        handler=_tool_delete_product,
    ),
    "generateReport": ToolSpec(
        arg_model=GenerateReportArgs,
        allowed_roles={"admin", "manager", "finance"},
        handler=_tool_generate_report,
    ),
    "bulkUpdateStock": ToolSpec(
        arg_model=BulkUpdateStockArgs,
        allowed_roles={"admin", "manager", "store_manager", "approver"},
        handler=_tool_bulk_update_stock,
    ),
    "setReorderThreshold": ToolSpec(
        arg_model=SetReorderThresholdArgs,
        allowed_roles={"manager", "finance"},
        handler=_tool_set_reorder_threshold,
    ),
}


def list_tool_permissions_for_role(role: str) -> dict[str, bool]:
    role_n = _normalize_role(role)
    return {name: role_n in spec.allowed_roles for name, spec in TOOL_REGISTRY.items()}


def execute_tool_call(db: Session, actor: User, tool_call: ToolCall) -> ToolExecutionResult:
    tool_name = (tool_call.name or "").strip()
    spec = TOOL_REGISTRY.get(tool_name)
    if not spec:
        raise ValueError(f"Unknown tool: {tool_name}")

    actor_role = _normalize_role(actor.role or "")
    if actor_role not in spec.allowed_roles:
        log_audit(
            db,
            actor,
            action="ai_tool_denied",
            entity_type="assistant",
            detail={"tool": tool_name, "reason": "insufficient_role", "role": actor_role},
        )
        db.commit()
        raise PermissionError(f"Role '{actor_role}' cannot execute '{tool_name}'")

    try:
        args = spec.arg_model.model_validate(tool_call.arguments or {})
    except ValidationError as exc:
        raise ValueError(f"Invalid arguments for tool '{tool_name}': {exc.errors()}") from exc

    try:
        result = spec.handler(db, actor, args)
    except ServiceError as exc:
        raise ValueError(exc.message) from exc
    except Exception:
        db.rollback()
        raise

    log_audit(
        db,
        actor,
        action="ai_tool_executed",
        entity_type="assistant",
        detail={"tool": tool_name, "success": result.success, "data": result.data},
    )
    db.commit()
    return result


def list_products_for_restock_candidates(db: Session, limit: int = 50, part_ids: set[int] | None = None) -> list[dict[str, Any]]:
    stmt = (
        select(Part.id, Part.sku, Part.name, Part.quantity_on_hand, Part.min_quantity)
        .where(Part.is_active.is_(True), Part.quantity_on_hand <= Part.min_quantity)
        .order_by((Part.min_quantity - Part.quantity_on_hand).desc(), Part.name.asc())
        .limit(limit)
    )
    if part_ids is not None:
        if not part_ids:
            return []
        stmt = stmt.where(Part.id.in_(sorted(part_ids)))
    rows = db.execute(stmt).all()
    return [
        {
            "id": int(r.id),
            "sku": r.sku,
            "name": r.name,
            "qoh": int(r.quantity_on_hand),
            "min": int(r.min_quantity),
            "recommended_restock_qty": max(int(r.min_quantity) - int(r.quantity_on_hand), 0) + max(5, int(r.min_quantity // 2)),
        }
        for r in rows
    ]

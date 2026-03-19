from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.audit import log_audit
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.notifications import send_direct_email
from app.models import (
    CycleCount,
    CycleCountLine,
    CycleCountStatus,
    GoodsReceipt,
    GoodsReceiptLine,
    Part,
    PartLocationStock,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    ReservationStatus,
    StockRequest,
    StockReservation,
    StockTransaction,
    StockTransactionType,
    StockTransfer,
    StockTransferLine,
    Supplier,
    TransferStatus,
    User,
)
from app.schemas import (
    CycleCountCreate,
    CycleCountDecision,
    CycleCountRead,
    CycleCountSubmit,
    ExecutiveSummary,
    GoodsReceiptCreate,
    GoodsReceiptRead,
    KpiSummary,
    PurchaseOrderCreate,
    PurchaseOrderDispatchRequest,
    PurchaseOrderDispatchResult,
    PurchaseOrderRead,
    PurchaseOrderStatusUpdate,
    ReplenishmentSuggestion,
    ReservationCreate,
    ReservationRead,
    StockTransferCreate,
    StockTransferRead,
)

router = APIRouter(prefix="/api/operations", tags=["operations"])


def _get_or_create_location_stock(db: Session, *, part_id: int, location_id: int) -> PartLocationStock:
    row = db.scalar(
        select(PartLocationStock).where(
            PartLocationStock.part_id == part_id,
            PartLocationStock.location_id == location_id,
        )
    )
    if row is None:
        row = PartLocationStock(part_id=part_id, location_id=location_id, quantity_on_hand=0)
        db.add(row)
        db.flush()
    return row


def _po_query():
    return select(PurchaseOrder).options(selectinload(PurchaseOrder.lines), selectinload(PurchaseOrder.supplier))


def _build_po_email_body(*, po: PurchaseOrder, parts_by_id: dict[int, Part], sender_name: str, custom_message: str | None) -> str:
    lines: list[str] = [
        f"Purchase Order PO-{po.id}",
        f"Order Date: {po.order_date.isoformat()}",
        f"Expected Date: {po.expected_date.isoformat() if po.expected_date else '-'}",
        "",
        "Line Items:",
    ]
    total_cost = 0.0
    for idx, line in enumerate(po.lines, start=1):
        part = parts_by_id.get(int(line.part_id))
        part_label = f"{part.sku} - {part.name}" if part else f"Part #{line.part_id}"
        unit_cost = float(line.unit_cost or 0.0)
        line_total = float(line.ordered_quantity or 0) * unit_cost
        total_cost += line_total
        lines.append(
            f"{idx}. {part_label} | Qty: {int(line.ordered_quantity or 0)} | Unit Cost: {unit_cost:.2f} | Line Total: {line_total:.2f}"
        )

    lines.extend(["", f"Estimated Total: {total_cost:.2f}"])
    if po.notes:
        lines.extend(["", "PO Notes:", po.notes.strip()])
    if custom_message:
        lines.extend(["", "Message:", custom_message.strip()])

    lines.extend(["", f"Dispatched by: {sender_name}", "System: WesternPumps"])
    return "\n".join(lines)


def _transfer_query():
    return select(StockTransfer).options(selectinload(StockTransfer.lines))


def _cycle_query():
    return select(CycleCount).options(selectinload(CycleCount.lines))


@router.get("/purchase-orders", response_model=list[PurchaseOrderRead], dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def list_purchase_orders(db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=500)) -> list[PurchaseOrderRead]:
    rows = db.scalars(_po_query().order_by(PurchaseOrder.created_at.desc()).limit(limit)).all()
    return [PurchaseOrderRead.model_validate(row, from_attributes=True) for row in rows]


@router.post("/purchase-orders", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("store_manager", "manager"))])
def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PurchaseOrderRead:
    po = PurchaseOrder(supplier_id=payload.supplier_id, expected_date=payload.expected_date, notes=payload.notes, status=PurchaseOrderStatus.DRAFT)
    db.add(po)
    db.flush()
    for line in payload.lines:
        if not db.get(Part, line.part_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid part_id {line.part_id}")
        db.add(PurchaseOrderLine(purchase_order_id=po.id, part_id=line.part_id, ordered_quantity=line.ordered_quantity, unit_cost=line.unit_cost))

    log_audit(db, current_user, "create", "purchase_order", entity_id=po.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_po_query().where(PurchaseOrder.id == po.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load purchase order")
    return PurchaseOrderRead.model_validate(row, from_attributes=True)


@router.post("/purchase-orders/{po_id}/status", response_model=PurchaseOrderRead, dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def update_purchase_order_status(po_id: int, payload: PurchaseOrderStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PurchaseOrderRead:
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    next_status = PurchaseOrderStatus(payload.status)
    if next_status == PurchaseOrderStatus.APPROVED:
        po.approved_by_user_id = current_user.id
        po.approved_at = datetime.now(UTC)
    if next_status == PurchaseOrderStatus.SENT:
        po.sent_at = datetime.now(UTC)
    if next_status == PurchaseOrderStatus.CLOSED:
        po.closed_at = datetime.now(UTC)
    po.status = next_status
    if payload.notes:
        po.notes = (po.notes or "") + f"\n{payload.notes}" if po.notes else payload.notes

    log_audit(db, current_user, "update_status", "purchase_order", entity_id=po.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_po_query().where(PurchaseOrder.id == po.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load purchase order")
    return PurchaseOrderRead.model_validate(row, from_attributes=True)


@router.post("/purchase-orders/{po_id}/dispatch", response_model=PurchaseOrderDispatchResult, dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def dispatch_purchase_order(
    po_id: int,
    payload: PurchaseOrderDispatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderDispatchResult:
    po = db.scalar(_po_query().where(PurchaseOrder.id == po_id))
    if po is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if po.status in {PurchaseOrderStatus.CANCELED, PurchaseOrderStatus.CLOSED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order cannot be dispatched")

    supplier = db.get(Supplier, po.supplier_id)
    default_email = (supplier.email or "").strip() if supplier else ""
    recipient = (str(payload.recipient_email).strip() if payload.recipient_email else default_email).strip()
    if not recipient:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier email is required")

    part_ids = [int(line.part_id) for line in po.lines]
    parts = db.scalars(select(Part).where(Part.id.in_(part_ids))).all() if part_ids else []
    parts_by_id = {int(row.id): row for row in parts}
    sender_name = current_user.full_name or current_user.email
    subject = f"Purchase Order PO-{po.id} from WesternPumps"
    body = _build_po_email_body(po=po, parts_by_id=parts_by_id, sender_name=sender_name, custom_message=payload.message)

    log_audit(
        db,
        current_user,
        "dispatch_attempt",
        "purchase_order",
        entity_id=po.id,
        detail={"recipient_email": recipient, "status_before": po.status.value},
    )
    dispatched, detail = send_direct_email(db, recipients=[recipient], subject=subject, body=body)
    if not dispatched:
        log_audit(
            db,
            current_user,
            "dispatch_failed",
            "purchase_order",
            entity_id=po.id,
            detail={"recipient_email": recipient, "detail": detail},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Dispatch failed: {detail}")

    po.status = PurchaseOrderStatus.SENT
    po.sent_at = datetime.now(UTC)
    if payload.message:
        po.notes = (po.notes or "") + f"\nDispatch note: {payload.message}" if po.notes else f"Dispatch note: {payload.message}"

    log_audit(
        db,
        current_user,
        "dispatch_success",
        "purchase_order",
        entity_id=po.id,
        detail={"recipient_email": recipient, "detail": detail},
    )
    db.commit()
    row = db.scalar(_po_query().where(PurchaseOrder.id == po.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load purchase order")
    return PurchaseOrderDispatchResult(
        purchase_order=PurchaseOrderRead.model_validate(row, from_attributes=True),
        dispatched=True,
        detail=detail,
        recipient_email=recipient,
    )


@router.post("/purchase-orders/{po_id}/receipts", response_model=GoodsReceiptRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("store_manager", "manager"))])
def receive_purchase_order(po_id: int, payload: GoodsReceiptCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GoodsReceiptRead:
    po = db.scalar(_po_query().where(PurchaseOrder.id == po_id))
    if po is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if po.status in {PurchaseOrderStatus.CLOSED, PurchaseOrderStatus.CANCELED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order is closed")

    notes = payload.notes.strip()
    if not notes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Receiving audit notes are required")

    receipt = GoodsReceipt(purchase_order_id=po_id, received_by_user_id=current_user.id, grn_number=payload.grn_number.strip(), notes=notes)
    db.add(receipt)
    db.flush()

    line_by_id = {line.id: line for line in po.lines}
    for line in payload.lines:
        po_line = line_by_id.get(line.purchase_order_line_id)
        if po_line is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid purchase_order_line_id {line.purchase_order_line_id}")
        if line.accepted_quantity + line.rejected_quantity != line.received_quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="accepted_quantity + rejected_quantity must equal received_quantity")
        if line.received_quantity > 0 and line.accepted_quantity != line.received_quantity and not (line.variance_reason or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="variance_reason is required when accepted differs from received")

        db.add(
            GoodsReceiptLine(
                goods_receipt_id=receipt.id,
                purchase_order_line_id=po_line.id,
                part_id=po_line.part_id,
                received_quantity=line.received_quantity,
                accepted_quantity=line.accepted_quantity,
                rejected_quantity=line.rejected_quantity,
                variance_reason=(line.variance_reason or "").strip() or None,
                lot_code=(line.lot_code or "").strip() or None,
                expiry_date=line.expiry_date,
            )
        )

        if line.accepted_quantity > 0:
            part = db.get(Part, po_line.part_id)
            if part is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid part_id {po_line.part_id}")
            part.quantity_on_hand = int(part.quantity_on_hand or 0) + int(line.accepted_quantity)
            po_line.received_quantity = int(po_line.received_quantity or 0) + int(line.accepted_quantity)
            db.add(StockTransaction(part_id=part.id, created_by_user_id=current_user.id, supplier_id=po.supplier_id, transaction_type=StockTransactionType.IN, quantity_delta=int(line.accepted_quantity), movement_type="PO_RECEIPT", grn_number=receipt.grn_number, notes=f"PO#{po.id} line#{po_line.id}: {notes}"))
            if part.location_id is not None:
                loc_row = _get_or_create_location_stock(db, part_id=part.id, location_id=part.location_id)
                loc_row.quantity_on_hand = int(loc_row.quantity_on_hand or 0) + int(line.accepted_quantity)

    total_ordered = sum(int(line.ordered_quantity or 0) for line in po.lines)
    total_received = sum(int(line.received_quantity or 0) for line in po.lines)
    po.status = PurchaseOrderStatus.CLOSED if total_received >= total_ordered and total_ordered > 0 else PurchaseOrderStatus.RECEIVING
    if po.status == PurchaseOrderStatus.CLOSED and po.closed_at is None:
        po.closed_at = datetime.now(UTC)

    log_audit(db, current_user, "receive", "purchase_order", entity_id=po.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(select(GoodsReceipt).options(selectinload(GoodsReceipt.lines)).where(GoodsReceipt.id == receipt.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load goods receipt")
    return GoodsReceiptRead.model_validate(row, from_attributes=True)


@router.post("/reservations", response_model=ReservationRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("store_manager", "manager", "approver"))])
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ReservationRead:
    part = db.get(Part, payload.part_id)
    if part is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")
    available = int(part.quantity_on_hand or 0) - int(part.allocated_quantity or 0)
    if payload.quantity > available:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient available stock")

    reservation = StockReservation(part_id=payload.part_id, request_id=payload.request_id, quantity=payload.quantity, status=ReservationStatus.ACTIVE, notes=payload.notes)
    part.allocated_quantity = int(part.allocated_quantity or 0) + int(payload.quantity)
    db.add(reservation)
    log_audit(db, current_user, "create", "stock_reservation", detail=payload.model_dump())
    db.commit()
    db.refresh(reservation)
    return ReservationRead.model_validate(reservation, from_attributes=True)


@router.post("/reservations/{reservation_id}/release", response_model=ReservationRead, dependencies=[Depends(require_roles("store_manager", "manager", "approver"))])
def release_reservation(reservation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ReservationRead:
    reservation = db.get(StockReservation, reservation_id)
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reservation is not active")

    part = db.get(Part, reservation.part_id)
    if part is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Part not found")
    part.allocated_quantity = max(0, int(part.allocated_quantity or 0) - int(reservation.quantity or 0))
    reservation.status = ReservationStatus.RELEASED

    log_audit(db, current_user, "release", "stock_reservation", entity_id=reservation.id)
    db.commit()
    db.refresh(reservation)
    return ReservationRead.model_validate(reservation, from_attributes=True)


@router.get("/transfers", response_model=list[StockTransferRead], dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def list_transfers(db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=500)) -> list[StockTransferRead]:
    rows = db.scalars(_transfer_query().order_by(StockTransfer.created_at.desc()).limit(limit)).all()
    return [StockTransferRead.model_validate(row, from_attributes=True) for row in rows]


@router.post("/transfers", response_model=StockTransferRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("store_manager", "manager"))])
def create_transfer(payload: StockTransferCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> StockTransferRead:
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="from_location_id and to_location_id must differ")

    transfer = StockTransfer(from_location_id=payload.from_location_id, to_location_id=payload.to_location_id, status=TransferStatus.DRAFT, notes=payload.notes)
    db.add(transfer)
    db.flush()
    for line in payload.lines:
        db.add(StockTransferLine(stock_transfer_id=transfer.id, part_id=line.part_id, quantity=line.quantity))

    log_audit(db, current_user, "create", "stock_transfer", entity_id=transfer.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_transfer_query().where(StockTransfer.id == transfer.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load transfer")
    return StockTransferRead.model_validate(row, from_attributes=True)

@router.post("/transfers/{transfer_id}/approve", response_model=StockTransferRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def approve_transfer(transfer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> StockTransferRead:
    transfer = db.scalar(_transfer_query().where(StockTransfer.id == transfer_id))
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    if transfer.status != TransferStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer is not in draft")

    for line in transfer.lines:
        source = _get_or_create_location_stock(db, part_id=line.part_id, location_id=transfer.from_location_id)
        if int(source.quantity_on_hand or 0) < int(line.quantity or 0):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient source stock for part_id {line.part_id}")

    transfer.status = TransferStatus.APPROVED
    transfer.approved_by_user_id = current_user.id
    transfer.approved_at = datetime.now(UTC)
    log_audit(db, current_user, "approve", "stock_transfer", entity_id=transfer.id)
    db.commit()
    row = db.scalar(_transfer_query().where(StockTransfer.id == transfer.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load transfer")
    return StockTransferRead.model_validate(row, from_attributes=True)


@router.post("/transfers/{transfer_id}/complete", response_model=StockTransferRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def complete_transfer(transfer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> StockTransferRead:
    transfer = db.scalar(_transfer_query().where(StockTransfer.id == transfer_id))
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    if transfer.status not in {TransferStatus.APPROVED, TransferStatus.IN_TRANSIT}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer is not approved")

    for line in transfer.lines:
        source = _get_or_create_location_stock(db, part_id=line.part_id, location_id=transfer.from_location_id)
        target = _get_or_create_location_stock(db, part_id=line.part_id, location_id=transfer.to_location_id)
        if int(source.quantity_on_hand or 0) < int(line.quantity or 0):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient source stock for part_id {line.part_id}")

        source.quantity_on_hand = int(source.quantity_on_hand or 0) - int(line.quantity or 0)
        target.quantity_on_hand = int(target.quantity_on_hand or 0) + int(line.quantity or 0)
        db.add(StockTransaction(part_id=line.part_id, created_by_user_id=current_user.id, transaction_type=StockTransactionType.ADJUST, quantity_delta=0, movement_type="TRANSFER", notes=f"Transfer #{transfer.id}: {line.quantity} from {transfer.from_location_id} to {transfer.to_location_id}"))

    transfer.status = TransferStatus.COMPLETED
    transfer.completed_at = datetime.now(UTC)

    log_audit(db, current_user, "complete", "stock_transfer", entity_id=transfer.id)
    db.commit()
    row = db.scalar(_transfer_query().where(StockTransfer.id == transfer.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load transfer")
    return StockTransferRead.model_validate(row, from_attributes=True)


@router.get("/cycle-counts", response_model=list[CycleCountRead], dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def list_cycle_counts(db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=500)) -> list[CycleCountRead]:
    rows = db.scalars(_cycle_query().order_by(CycleCount.created_at.desc()).limit(limit)).all()
    return [CycleCountRead.model_validate(row, from_attributes=True) for row in rows]


@router.post("/cycle-counts", response_model=CycleCountRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("store_manager", "manager"))])
def create_cycle_count(payload: CycleCountCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> CycleCountRead:
    cycle = CycleCount(location_id=payload.location_id, status=CycleCountStatus.OPEN, notes=payload.notes)
    db.add(cycle)
    db.flush()

    stock_rows = db.scalars(select(PartLocationStock).where(PartLocationStock.location_id == payload.location_id)).all()
    for row in stock_rows:
        db.add(CycleCountLine(cycle_count_id=cycle.id, part_id=row.part_id, expected_quantity=int(row.quantity_on_hand or 0), counted_quantity=None, variance_quantity=0))

    log_audit(db, current_user, "create", "cycle_count", entity_id=cycle.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_cycle_query().where(CycleCount.id == cycle.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load cycle count")
    return CycleCountRead.model_validate(row, from_attributes=True)


@router.post("/cycle-counts/{cycle_id}/submit", response_model=CycleCountRead, dependencies=[Depends(require_roles("store_manager", "manager"))])
def submit_cycle_count(cycle_id: int, payload: CycleCountSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> CycleCountRead:
    cycle = db.scalar(_cycle_query().where(CycleCount.id == cycle_id))
    if cycle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle count not found")
    if cycle.status != CycleCountStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cycle count is not open")

    lines_by_id = {line.id: line for line in cycle.lines}
    for input_line in payload.lines:
        line = lines_by_id.get(input_line.id)
        if line is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid line id {input_line.id}")
        line.counted_quantity = input_line.counted_quantity
        line.variance_quantity = int(input_line.counted_quantity) - int(line.expected_quantity)
        line.reason = input_line.reason

    if any(line.counted_quantity is None for line in cycle.lines):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All cycle count lines must be counted before submit")

    cycle.status = CycleCountStatus.SUBMITTED
    cycle.submitted_by_user_id = current_user.id
    cycle.submitted_at = datetime.now(UTC)

    log_audit(db, current_user, "submit", "cycle_count", entity_id=cycle.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_cycle_query().where(CycleCount.id == cycle.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load cycle count")
    return CycleCountRead.model_validate(row, from_attributes=True)

@router.post("/cycle-counts/{cycle_id}/approve", response_model=CycleCountRead, dependencies=[Depends(require_roles("manager", "finance"))])
def approve_cycle_count(cycle_id: int, payload: CycleCountDecision, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> CycleCountRead:
    cycle = db.scalar(_cycle_query().where(CycleCount.id == cycle_id))
    if cycle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle count not found")
    if cycle.status != CycleCountStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cycle count is not submitted")

    for line in cycle.lines:
        if line.counted_quantity is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All lines must be counted")
        loc = _get_or_create_location_stock(db, part_id=line.part_id, location_id=cycle.location_id)
        delta = int(line.counted_quantity) - int(loc.quantity_on_hand or 0)
        if delta != 0:
            loc.quantity_on_hand = int(line.counted_quantity)
            part = db.get(Part, line.part_id)
            if part:
                part.quantity_on_hand = max(0, int(part.quantity_on_hand or 0) + delta)
                db.add(StockTransaction(part_id=part.id, created_by_user_id=current_user.id, transaction_type=StockTransactionType.ADJUST, quantity_delta=delta, movement_type="CYCLE_COUNT", notes=f"CycleCount#{cycle.id}: {payload.notes}"))

    cycle.status = CycleCountStatus.APPROVED
    cycle.approved_by_user_id = current_user.id
    cycle.approved_at = datetime.now(UTC)
    cycle.notes = payload.notes

    log_audit(db, current_user, "approve", "cycle_count", entity_id=cycle.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_cycle_query().where(CycleCount.id == cycle.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load cycle count")
    return CycleCountRead.model_validate(row, from_attributes=True)


@router.post("/cycle-counts/{cycle_id}/reject", response_model=CycleCountRead, dependencies=[Depends(require_roles("manager", "finance"))])
def reject_cycle_count(cycle_id: int, payload: CycleCountDecision, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> CycleCountRead:
    cycle = db.scalar(_cycle_query().where(CycleCount.id == cycle_id))
    if cycle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle count not found")
    if cycle.status != CycleCountStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cycle count is not submitted")

    cycle.status = CycleCountStatus.REJECTED
    cycle.rejected_reason = payload.notes
    cycle.approved_by_user_id = current_user.id
    cycle.approved_at = datetime.now(UTC)

    log_audit(db, current_user, "reject", "cycle_count", entity_id=cycle.id, detail=payload.model_dump())
    db.commit()
    row = db.scalar(_cycle_query().where(CycleCount.id == cycle.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load cycle count")
    return CycleCountRead.model_validate(row, from_attributes=True)


@router.get("/replenishment/suggestions", response_model=list[ReplenishmentSuggestion], dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def replenishment_suggestions(db: Session = Depends(get_db), lookback_days: int = Query(30, ge=7, le=365)) -> list[ReplenishmentSuggestion]:
    since = datetime.now(UTC) - timedelta(days=lookback_days)
    tx_rows = db.execute(
        select(StockTransaction.part_id, func.sum(func.abs(StockTransaction.quantity_delta)).label("out_qty"))
        .where(StockTransaction.transaction_type == StockTransactionType.OUT)
        .where(StockTransaction.created_at >= since)
        .group_by(StockTransaction.part_id)
    ).all()
    outbound_by_part = {int(row.part_id): float(row.out_qty or 0) for row in tx_rows}

    parts = db.scalars(select(Part).where(Part.is_active.is_(True))).all()
    suggestions: list[ReplenishmentSuggestion] = []
    for part in parts:
        out_qty = outbound_by_part.get(int(part.id), 0.0)
        avg_daily = out_qty / float(lookback_days)
        lead_time = max(0, int(part.lead_time_days or 0))
        safety = max(0, int(part.safety_stock or 0))
        projected = avg_daily * float(lead_time)
        target_level = int(round(projected + safety + int(part.min_quantity or 0)))
        available = int(part.quantity_on_hand or 0) - int(part.allocated_quantity or 0)

        configured_reorder = int(part.reorder_quantity or 0)
        delta = max(0, target_level - available)
        suggested_qty = max(configured_reorder if delta > 0 and configured_reorder > 0 else 0, delta)
        if suggested_qty <= 0:
            continue

        risk = "LOW"
        if available <= 0:
            risk = "CRITICAL"
        elif available <= int(part.min_quantity or 0):
            risk = "HIGH"
        elif available <= int(part.min_quantity or 0) + safety:
            risk = "MEDIUM"

        suggestions.append(ReplenishmentSuggestion(part_id=part.id, sku=part.sku, name=part.name, quantity_on_hand=int(part.quantity_on_hand or 0), allocated_quantity=int(part.allocated_quantity or 0), available_quantity=available, min_quantity=int(part.min_quantity or 0), safety_stock=safety, lead_time_days=lead_time, average_daily_outbound=round(avg_daily, 3), projected_demand_during_lead_time=round(projected, 3), suggested_order_quantity=int(suggested_qty), risk_level=risk))

    risk_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    suggestions.sort(key=lambda row: (risk_rank.get(row.risk_level, 9), -row.suggested_order_quantity))
    return suggestions


@router.get("/kpi/summary", response_model=KpiSummary, dependencies=[Depends(require_roles("store_manager", "manager", "finance"))])
def kpi_summary(db: Session = Depends(get_db), lookback_days: int = Query(90, ge=30, le=365)) -> KpiSummary:
    total_items = int(db.scalar(select(func.count()).select_from(Part).where(Part.is_active.is_(True))) or 0)
    low_stock_items = int(db.scalar(select(func.count()).select_from(Part).where(and_(Part.is_active.is_(True), Part.quantity_on_hand <= Part.min_quantity))) or 0)
    stockout_items = int(db.scalar(select(func.count()).select_from(Part).where(and_(Part.is_active.is_(True), Part.quantity_on_hand <= 0))) or 0)

    total_requests = int(db.scalar(select(func.count()).select_from(StockRequest)) or 0)
    fulfilled_requests = int(db.scalar(select(func.count()).select_from(StockRequest).where(StockRequest.status.in_(["ISSUED", "CLOSED"]))) or 0)
    fill_rate = round((fulfilled_requests / total_requests * 100.0), 2) if total_requests else 100.0
    stockout_rate = round((stockout_items / total_items * 100.0), 2) if total_items else 0.0

    period_start = datetime.now(UTC) - timedelta(days=lookback_days)
    outbound = db.execute(
        select(StockTransaction.part_id, func.sum(func.abs(StockTransaction.quantity_delta)).label("qty"))
        .where(StockTransaction.transaction_type == StockTransactionType.OUT)
        .where(StockTransaction.created_at >= period_start)
        .group_by(StockTransaction.part_id)
    ).all()
    part_rows = db.scalars(select(Part)).all()
    part_prices = {int(p.id): float(p.unit_price or 0.0) for p in part_rows}
    cogs = sum(float(row.qty or 0.0) * float(part_prices.get(int(row.part_id), 0.0)) for row in outbound)

    avg_inventory = float(sum((float(p.quantity_on_hand or 0.0) * float(p.unit_price or 0.0)) for p in part_rows))
    turns = round(cogs / avg_inventory, 3) if avg_inventory > 0 else 0.0

    last_tx_subq = select(StockTransaction.part_id, func.max(StockTransaction.created_at).label("last_tx")).group_by(StockTransaction.part_id).subquery()
    last_tx_rows = db.execute(select(last_tx_subq.c.part_id, last_tx_subq.c.last_tx)).all()
    now_aware = datetime.now(UTC)
    now_naive = now_aware.replace(tzinfo=None)
    over_30 = over_60 = over_90 = 0
    for row in last_tx_rows:
        last_tx = row.last_tx
        if not last_tx:
            continue
        if getattr(last_tx, "tzinfo", None) is None:
            age_days = (now_naive - last_tx).days
        else:
            age_days = (now_aware - last_tx).days
        if age_days >= 30:
            over_30 += 1
        if age_days >= 60:
            over_60 += 1
        if age_days >= 90:
            over_90 += 1

    return KpiSummary(total_items=total_items, low_stock_items=low_stock_items, stockout_items=stockout_items, fill_rate_percent=fill_rate, stockout_rate_percent=stockout_rate, inventory_turns_estimate=turns, aging_over_30_days=over_30, aging_over_60_days=over_60, aging_over_90_days=over_90)


@router.get("/executive/summary", response_model=ExecutiveSummary, dependencies=[Depends(require_roles("manager", "finance", "admin"))])
def executive_summary(db: Session = Depends(get_db), days: int = Query(7, ge=1, le=90)) -> ExecutiveSummary:
    period_end = datetime.now(UTC).date()
    period_start = period_end - timedelta(days=days - 1)
    start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=UTC)

    po_created = int(db.scalar(select(func.count()).select_from(PurchaseOrder).where(PurchaseOrder.created_at >= start_dt)) or 0)
    po_closed = int(db.scalar(select(func.count()).select_from(PurchaseOrder).where(PurchaseOrder.closed_at.is_not(None), PurchaseOrder.closed_at >= start_dt)) or 0)
    transfer_completed = int(db.scalar(select(func.count()).select_from(StockTransfer).where(StockTransfer.completed_at.is_not(None), StockTransfer.completed_at >= start_dt)) or 0)
    cycle_approved = int(db.scalar(select(func.count()).select_from(CycleCount).where(CycleCount.approved_at.is_not(None), CycleCount.approved_at >= start_dt)) or 0)

    top_out = db.execute(
        select(Part.sku, func.sum(func.abs(StockTransaction.quantity_delta)).label("qty"))
        .join(Part, Part.id == StockTransaction.part_id)
        .where(StockTransaction.transaction_type == StockTransactionType.OUT)
        .where(StockTransaction.created_at >= start_dt)
        .group_by(Part.sku)
        .order_by(func.sum(func.abs(StockTransaction.quantity_delta)).desc())
        .limit(5)
    ).all()

    return ExecutiveSummary(period_start=period_start, period_end=period_end, purchase_orders_created=po_created, purchase_orders_closed=po_closed, transfer_orders_completed=transfer_completed, cycle_counts_approved=cycle_approved, top_outbound_skus=[str(row.sku) for row in top_out])

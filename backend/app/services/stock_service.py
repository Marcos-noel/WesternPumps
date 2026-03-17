from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from jose import JWTError, jwt
from sqlalchemy import func, select

from app.audit import log_audit
from app.config import settings
from app.models import Location
from app.models import IssuedBatchItem, ItemInstance, ItemStatus, Job, PartLocationStock, StockRequest, StockRequestStatus, StockTransaction, StockTransactionType, User
from app.notifications import dispatch_alert
from app.repositories import InventoryRepository
from app.services.errors import ServiceError
from app.system_settings import get_effective_settings


class StockService:
    def __init__(self, repo: InventoryRepository) -> None:
        self.repo = repo

    def create_transaction(
        self,
        *,
        current_user: User,
        part_id: int,
        transaction_type: str,
        quantity_delta: int,
        supplier_id: int | None,
        notes: str | None,
        request_id: int | None,
        technician_id: int | None,
        customer_id: int | None,
        job_id: int | None,
        item_instance_id: int | None,
        movement_type: str | None,
        grn_number: str | None,
    ) -> StockTransaction:
        part = self.repo.get_part(part_id)
        if not part:
            raise ServiceError("Invalid part_id", 400)
        if not part.is_active:
            raise ServiceError("Cannot transact against inactive part", 400)

        if supplier_id is not None and not self.repo.get_supplier(supplier_id):
            raise ServiceError("Invalid supplier_id", 400)

        if quantity_delta == 0:
            raise ServiceError("quantity_delta must be non-zero", 400)

        item_instance = None
        if item_instance_id is not None:
            item_instance = self.repo.get_item_instance(item_instance_id)
            if not item_instance or item_instance.part_id != part_id:
                raise ServiceError("Invalid item_instance_id", 400)
            if not item_instance.barcode_value:
                item_instance.barcode_value = self._next_instance_barcode(item_instance.serial_number)

        delta = quantity_delta
        if transaction_type == StockTransactionType.IN.value:
            if delta < 0:
                raise ServiceError("IN transactions must be positive", 400)
            if supplier_id is None:
                raise ServiceError("supplier_id is required for IN transactions", 400)
        elif transaction_type == StockTransactionType.OUT.value:
            if delta > 0:
                delta = -delta
            if part.tracking_type == "INDIVIDUAL" and item_instance_id is None:
                raise ServiceError("item_instance_id is required for INDIVIDUAL OUT transactions", 400)

        resolved_grn_number = (grn_number or "").strip().upper() or None
        if transaction_type == StockTransactionType.IN.value and not resolved_grn_number:
            resolved_grn_number = self._next_grn_number()

        previous_qoh = part.quantity_on_hand
        new_qoh = previous_qoh + delta
        if new_qoh < 0:
            raise ServiceError("Insufficient stock for this transaction", 400)

        auto_created_instances: list[ItemInstance] = []
        if (
            transaction_type == StockTransactionType.IN.value
            and part.tracking_type == "INDIVIDUAL"
            and item_instance_id is None
        ):
            for _ in range(delta):
                serial = self._next_serial(part.sku)
                instance = ItemInstance(
                    part_id=part.id,
                    serial_number=serial,
                    barcode_value=self._next_instance_barcode(serial),
                    status=ItemStatus.AVAILABLE,
                    location_id=part.location_id,
                )
                self.repo.add(instance)
                auto_created_instances.append(instance)

        part.quantity_on_hand = new_qoh

        if item_instance:
            if transaction_type == StockTransactionType.OUT.value:
                item_instance.status = ItemStatus.ISSUED
            elif transaction_type == StockTransactionType.IN.value:
                item_instance.status = ItemStatus.AVAILABLE

        tx = StockTransaction(
            part_id=part_id,
            supplier_id=supplier_id,
            created_by_user_id=current_user.id,
            request_id=request_id,
            technician_id=technician_id,
            customer_id=customer_id,
            job_id=job_id,
            item_instance_id=item_instance_id,
            movement_type=movement_type,
            grn_number=resolved_grn_number,
            transaction_type=StockTransactionType(transaction_type),
            quantity_delta=delta,
            notes=notes,
        )
        self.repo.add(tx)
        if auto_created_instances:
            self.repo.db.flush()
            for instance in auto_created_instances:
                self.repo.add(
                    StockTransaction(
                        part_id=part_id,
                        supplier_id=supplier_id,
                        created_by_user_id=current_user.id,
                        request_id=request_id,
                        technician_id=technician_id,
                        customer_id=customer_id,
                        job_id=job_id,
                        item_instance_id=instance.id,
                        movement_type=(movement_type or "RECEIPT_AUTO_INSTANCE"),
                        grn_number=resolved_grn_number,
                        transaction_type=StockTransactionType.IN,
                        quantity_delta=0,
                        notes=f"Auto-generated individual receipt instance {instance.serial_number}",
                    )
                )
        log_audit(
            self.repo.db,
            current_user,
            action="create",
            entity_type="stock_transaction",
            detail={
                "part_id": part_id,
                "transaction_type": transaction_type,
                "quantity_delta": delta,
                "auto_created_instances": len(auto_created_instances),
                "grn_number": resolved_grn_number,
            },
        )
        self.repo.commit()
        self.repo.refresh(tx)
        if (
            part.min_quantity > 0
            and previous_qoh > part.min_quantity
            and part.quantity_on_hand <= part.min_quantity
        ):
            dispatch_alert(
                self.repo.db,
                actor=current_user,
                event="low_stock_alert",
                subject=f"Low Stock Alert: {part.sku}",
                body=(
                    f"{part.sku} - {part.name} has reached low stock. "
                    f"On hand: {part.quantity_on_hand}, minimum: {part.min_quantity}."
                ),
            )
        return tx

    def return_stock(
        self,
        *,
        current_user: User,
        part_id: int | None,
        item_instance_id: int | None,
        quantity: int,
        condition: str,
        notes: str | None,
        request_id: int | None,
        technician_id: int | None,
        return_proof_token: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> StockTransaction:
        if item_instance_id is None and part_id is None:
            raise ServiceError("part_id or item_instance_id is required", 400)
        if condition not in {"GOOD", "FAULTY"}:
            raise ServiceError("condition must be GOOD or FAULTY", 400)
        if quantity < 1:
            raise ServiceError("quantity must be >= 1", 400)

        is_technician = current_user.role in {"technician", "lead_technician", "staff"}
        if is_technician and technician_id is not None and technician_id != current_user.id:
            raise ServiceError("Technicians can only return items issued to themselves", 403)
        resolved_technician_id = current_user.id if is_technician else technician_id

        if is_technician:
            return self._submit_return_for_approval(
                current_user=current_user,
                part_id=part_id,
                item_instance_id=item_instance_id,
                quantity=quantity,
                condition=condition,
                notes=notes,
                request_id=request_id,
                technician_id=resolved_technician_id,
                return_proof_token=return_proof_token,
                latitude=latitude,
                longitude=longitude,
            )

        if item_instance_id is not None:
            return self._return_individual(
                current_user=current_user,
                item_instance_id=item_instance_id,
                condition=condition,
                notes=notes,
                request_id=request_id,
                technician_id=resolved_technician_id,
            )

        if part_id is None:
            raise ServiceError("part_id is required", 400)
        return self._return_batch(
            current_user=current_user,
            part_id=part_id,
            quantity=quantity,
            condition=condition,
            notes=notes,
            request_id=request_id,
            technician_id=resolved_technician_id,
        )

    def list_pending_returns(self) -> list[dict]:
        stmt = (
            select(StockTransaction)
            .where(StockTransaction.movement_type == "RETURN_PENDING")
            .order_by(StockTransaction.created_at.desc())
        )
        rows = self.repo.db.scalars(stmt).all()
        result: list[dict] = []
        for tx in rows:
            part = self.repo.get_part(tx.part_id)
            if not part:
                continue
            meta = self._decode_return_meta(tx.notes)
            submitter = self.repo.db.get(User, tx.created_by_user_id) if tx.created_by_user_id else None
            result.append(
                {
                    "id": tx.id,
                    "part_id": tx.part_id,
                    "part_sku": part.sku,
                    "part_name": part.name,
                    "item_instance_id": tx.item_instance_id,
                    "quantity": int(meta.get("quantity") or 1),
                    "condition": str(meta.get("condition") or "GOOD"),
                    "request_id": tx.request_id,
                    "technician_id": tx.technician_id,
                    "submitted_by_user_id": tx.created_by_user_id,
                    "submitted_by_email": submitter.email if submitter else None,
                    "notes": str(meta.get("notes") or ""),
                    "latitude": meta.get("latitude"),
                    "longitude": meta.get("longitude"),
                    "created_at": tx.created_at,
                }
            )
        return result

    def list_my_return_submissions(self, *, current_user: User, limit: int = 50) -> list[dict]:
        stmt = (
            select(StockTransaction)
            .where(
                StockTransaction.created_by_user_id == current_user.id,
                StockTransaction.movement_type.in_(["RETURN_PENDING", "RETURN_APPROVED", "RETURN_REJECTED"]),
            )
            .order_by(StockTransaction.created_at.desc())
            .limit(limit)
        )
        rows = self.repo.db.scalars(stmt).all()
        result: list[dict] = []
        for tx in rows:
            part = self.repo.get_part(tx.part_id)
            if not part:
                continue
            meta = self._decode_return_meta(tx.notes)
            result.append(
                {
                    "id": tx.id,
                    "status": tx.movement_type,
                    "part_id": tx.part_id,
                    "part_sku": part.sku,
                    "part_name": part.name,
                    "item_instance_id": tx.item_instance_id,
                    "quantity": int(meta.get("quantity") or 1),
                    "condition": str(meta.get("condition") or "GOOD"),
                    "request_id": tx.request_id,
                    "notes": str(meta.get("notes") or ""),
                    "created_at": tx.created_at,
                }
            )
        return result

    def approve_pending_return(self, *, pending_transaction_id: int, approver: User, manager_remark: str | None = None) -> StockTransaction:
        pending_tx = self.repo.db.get(StockTransaction, pending_transaction_id)
        if not pending_tx or pending_tx.movement_type != "RETURN_PENDING":
            raise ServiceError("Pending return not found", 404)
        meta = self._decode_return_meta(pending_tx.notes)
        condition = str(meta.get("condition") or "GOOD")
        quantity = int(meta.get("quantity") or 1)
        request_id = int(meta["request_id"]) if meta.get("request_id") is not None else pending_tx.request_id
        technician_id = int(meta["technician_id"]) if meta.get("technician_id") is not None else pending_tx.technician_id
        original_notes = str(meta.get("notes") or "")
        approved_notes = f"{original_notes}\n[Manager Approval] {manager_remark.strip()}" if manager_remark and manager_remark.strip() else original_notes

        if pending_tx.item_instance_id is not None:
            approved_tx = self._return_individual(
                current_user=approver,
                item_instance_id=pending_tx.item_instance_id,
                condition=condition,
                notes=approved_notes or None,
                request_id=request_id,
                technician_id=technician_id,
            )
        else:
            approved_tx = self._return_batch(
                current_user=approver,
                part_id=pending_tx.part_id,
                quantity=quantity,
                condition=condition,
                notes=approved_notes or None,
                request_id=request_id,
                technician_id=technician_id,
            )

        pending_meta = {
            **meta,
            "status": "APPROVED",
            "approved_at": datetime.now(UTC).isoformat(),
            "approved_by_user_id": approver.id,
            "approved_tx_id": approved_tx.id,
            "manager_remark": (manager_remark or "").strip() or None,
        }
        pending_tx.movement_type = "RETURN_APPROVED"
        pending_tx.notes = self._encode_return_meta(pending_meta)
        log_audit(self.repo.db, approver, action="approve", entity_type="return_submission", entity_id=pending_tx.id)
        self.repo.commit()
        self.repo.refresh(approved_tx)

        extra_recipients: list[str] = []
        submitter = self.repo.db.get(User, pending_tx.created_by_user_id) if pending_tx.created_by_user_id else None
        if submitter and submitter.email:
            extra_recipients.append(submitter.email)
        dispatch_alert(
            self.repo.db,
            actor=approver,
            event="return_approved",
            subject=f"Return Approved: Part #{pending_tx.part_id}",
            body=f"Return submission #{pending_tx.id} has been approved by {approver.email}.",
            extra_recipients=extra_recipients or None,
        )
        return approved_tx

    def reject_pending_return(self, *, pending_transaction_id: int, approver: User, reason: str) -> StockTransaction:
        pending_tx = self.repo.db.get(StockTransaction, pending_transaction_id)
        if not pending_tx or pending_tx.movement_type != "RETURN_PENDING":
            raise ServiceError("Pending return not found", 404)
        meta = self._decode_return_meta(pending_tx.notes)
        meta.update({"status": "REJECTED", "rejected_at": datetime.now(UTC).isoformat(), "rejected_by_user_id": approver.id, "rejected_reason": reason})
        pending_tx.movement_type = "RETURN_REJECTED"
        pending_tx.notes = self._encode_return_meta(meta)
        log_audit(self.repo.db, approver, action="reject", entity_type="return_submission", entity_id=pending_tx.id, detail={"reason": reason})
        self.repo.commit()
        self.repo.refresh(pending_tx)

        extra_recipients: list[str] = []
        submitter = self.repo.db.get(User, pending_tx.created_by_user_id) if pending_tx.created_by_user_id else None
        if submitter and submitter.email:
            extra_recipients.append(submitter.email)
        dispatch_alert(
            self.repo.db,
            actor=approver,
            event="return_rejected",
            subject=f"Return Rejected: Part #{pending_tx.part_id}",
            body=f"Return submission #{pending_tx.id} was rejected by {approver.email}. Reason: {reason}",
            extra_recipients=extra_recipients or None,
        )
        return pending_tx

    def _submit_return_for_approval(
        self,
        *,
        current_user: User,
        part_id: int | None,
        item_instance_id: int | None,
        quantity: int,
        condition: str,
        notes: str | None,
        request_id: int | None,
        technician_id: int | None,
        return_proof_token: str | None,
        latitude: float | None,
        longitude: float | None,
    ) -> StockTransaction:
        resolved_part_id = part_id
        resolved_request_id = request_id
        resolved_technician_id = technician_id or current_user.id
        resolved_customer_id: int | None = None
        resolved_job_id: int | None = None

        if item_instance_id is not None:
            instance = self.repo.get_item_instance(item_instance_id)
            if not instance:
                raise ServiceError("Invalid item_instance_id", 400)
            if instance.status not in {ItemStatus.ISSUED, ItemStatus.USED}:
                raise ServiceError("Item must be ISSUED or USED to return", 400)
            resolved_part_id = instance.part_id
            latest_issue_tx = self.repo.get_latest_issue_transaction(item_instance_id, resolved_technician_id)
            if not latest_issue_tx:
                raise ServiceError("Item is not currently issued to you", 403)
            self._validate_return_proof_token(
                token=return_proof_token,
                technician_id=resolved_technician_id,
                item_instance_id=item_instance_id,
            )
            resolved_request_id = request_id or latest_issue_tx.request_id
            resolved_customer_id = latest_issue_tx.customer_id
            resolved_job_id = latest_issue_tx.job_id
            quantity = 1
        else:
            if resolved_part_id is None:
                raise ServiceError("part_id is required", 400)
            issued_batch = self.repo.find_issued_batch_for_return(
                part_id=resolved_part_id,
                request_id=request_id,
                technician_id=resolved_technician_id,
            )
            if not issued_batch:
                raise ServiceError("No issued batch allocation found for this return", 400)
            if quantity > issued_batch.quantity_remaining:
                raise ServiceError("Return exceeds issued balance", 400)
            resolved_request_id = request_id or issued_batch.request_id
            resolved_customer_id = issued_batch.customer_id
            resolved_job_id = issued_batch.job_id

        if resolved_part_id is None:
            raise ServiceError("part_id is required", 400)

        pending_meta = {
            "kind": "return_submission",
            "status": "PENDING",
            "condition": condition,
            "quantity": int(quantity),
            "notes": (notes or "").strip(),
            "latitude": latitude,
            "longitude": longitude,
            "return_proof_token_present": bool(return_proof_token),
            "request_id": resolved_request_id,
            "technician_id": resolved_technician_id,
            "customer_id": resolved_customer_id,
            "job_id": resolved_job_id,
            "submitted_at": datetime.now(UTC).isoformat(),
        }

        tx = StockTransaction(
            part_id=resolved_part_id,
            created_by_user_id=current_user.id,
            request_id=resolved_request_id,
            technician_id=resolved_technician_id,
            customer_id=resolved_customer_id,
            job_id=resolved_job_id,
            item_instance_id=item_instance_id,
            transaction_type=StockTransactionType.ADJUST,
            quantity_delta=0,
            movement_type="RETURN_PENDING",
            notes=self._encode_return_meta(pending_meta),
        )
        self.repo.add(tx)
        log_audit(
            self.repo.db,
            current_user,
            action="submit",
            entity_type="return_submission",
            detail={"part_id": resolved_part_id, "item_instance_id": item_instance_id, "condition": condition, "quantity": quantity},
        )
        self.repo.commit()
        self.repo.refresh(tx)
        dispatch_alert(
            self.repo.db,
            actor=current_user,
            event="return_submitted",
            subject=f"Return Submitted: Part #{resolved_part_id}",
            body=f"Technician {current_user.email} submitted return #{tx.id} for manager approval.",
        )
        return tx

    def _validate_return_proof_token(self, *, token: str | None, technician_id: int, item_instance_id: int) -> None:
        if not token:
            raise ServiceError("Scan proof token is required for individual item returns", 400)
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except JWTError as exc:
            raise ServiceError("Invalid or expired return scan proof token", 400) from exc
        if payload.get("sub") != "usage_scan":
            raise ServiceError("Invalid return scan proof token subject", 400)
        if int(payload.get("uid", 0) or 0) != technician_id:
            raise ServiceError("Return scan proof token user mismatch", 403)
        if int(payload.get("iid", 0) or 0) != item_instance_id:
            raise ServiceError("Return scan proof token item mismatch", 400)

    def _encode_return_meta(self, meta: dict) -> str:
        return "RETURN_META:" + json.dumps(meta, separators=(",", ":"), ensure_ascii=True)

    def _decode_return_meta(self, notes: str | None) -> dict:
        raw = (notes or "").strip()
        if not raw:
            return {}
        if raw.startswith("RETURN_META:"):
            raw = raw[len("RETURN_META:") :]
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _return_individual(
        self,
        *,
        current_user: User,
        item_instance_id: int,
        condition: str,
        notes: str | None,
        request_id: int | None,
        technician_id: int | None,
    ) -> StockTransaction:
        instance = self.repo.get_item_instance(item_instance_id)
        if not instance:
            raise ServiceError("Invalid item_instance_id", 400)
        part = self.repo.get_part(instance.part_id)
        if not part:
            raise ServiceError("Invalid part", 400)
        if instance.status not in {ItemStatus.ISSUED, ItemStatus.USED}:
            raise ServiceError("Item must be ISSUED or USED to return", 400)

        latest_issue_tx = (
            self.repo.get_latest_issue_transaction(item_instance_id, technician_id)
            if technician_id is not None
            else self.repo.get_latest_issue_transaction_any(item_instance_id)
        )
        if current_user.role in {"technician", "staff"} and not latest_issue_tx:
            raise ServiceError("Item is not currently issued to you", 403)

        resolved_request_id = request_id or (latest_issue_tx.request_id if latest_issue_tx else None)
        resolved_technician_id = technician_id or (latest_issue_tx.technician_id if latest_issue_tx else None)
        resolved_customer_id = latest_issue_tx.customer_id if latest_issue_tx else None
        resolved_job_id = latest_issue_tx.job_id if latest_issue_tx else None

        if condition == "GOOD":
            instance.status = ItemStatus.AVAILABLE
            part.quantity_on_hand += 1
            tx = StockTransaction(
                part_id=part.id,
                created_by_user_id=current_user.id,
                request_id=resolved_request_id,
                technician_id=resolved_technician_id,
                customer_id=resolved_customer_id,
                job_id=resolved_job_id,
                item_instance_id=instance.id,
                transaction_type=StockTransactionType.IN,
                quantity_delta=1,
                movement_type="RETURN",
                notes=notes,
            )
        else:
            instance.status = ItemStatus.FAULTY
            effective = get_effective_settings(self.repo.db)
            if effective.faulty_quarantine_location_id is not None:
                quarantine = self.repo.db.get(Location, effective.faulty_quarantine_location_id)
                if quarantine:
                    instance.location_id = quarantine.id
            tx = StockTransaction(
                part_id=part.id,
                created_by_user_id=current_user.id,
                request_id=resolved_request_id,
                technician_id=resolved_technician_id,
                customer_id=resolved_customer_id,
                job_id=resolved_job_id,
                item_instance_id=instance.id,
                transaction_type=StockTransactionType.ADJUST,
                quantity_delta=0,
                movement_type="FAULTY_RETURN",
                notes=notes,
            )

        self.repo.add(tx)
        log_audit(
            self.repo.db,
            current_user,
            action="return",
            entity_type="item_instance",
            entity_id=instance.id,
            detail={"condition": condition},
        )
        self.repo.commit()
        self.repo.refresh(tx)
        self._sync_request_and_job(resolved_request_id)
        if condition == "FAULTY":
            dispatch_alert(
                self.repo.db,
                actor=current_user,
                event="faulty_return",
                subject=f"Faulty Return: {instance.serial_number}",
                body=f"Item {instance.serial_number} ({part.sku}) was marked FAULTY by {current_user.email}.",
            )
        return tx

    def _return_batch(
        self,
        *,
        current_user: User,
        part_id: int,
        quantity: int,
        condition: str,
        notes: str | None,
        request_id: int | None,
        technician_id: int | None,
    ) -> StockTransaction:
        part = self.repo.get_part(part_id)
        if not part:
            raise ServiceError("Invalid part_id", 400)
        if not part.is_active:
            raise ServiceError("Cannot return against inactive part", 400)

        issued_batch = None
        if request_id is not None or technician_id is not None:
            issued_batch = self.repo.find_issued_batch_for_return(
                part_id=part.id,
                request_id=request_id,
                technician_id=technician_id,
            )
            if issued_batch:
                if quantity > issued_batch.quantity_remaining:
                    raise ServiceError("Return exceeds issued balance", 400)
                issued_batch.quantity_remaining -= quantity
            elif current_user.role in {"technician", "lead_technician", "staff"}:
                raise ServiceError("No issued batch allocation found for this return", 400)

        resolved_request_id = request_id or (issued_batch.request_id if issued_batch else None)
        resolved_technician_id = technician_id or (issued_batch.technician_id if issued_batch else None)
        resolved_customer_id = issued_batch.customer_id if issued_batch else None
        resolved_job_id = issued_batch.job_id if issued_batch else None

        if condition == "GOOD":
            part.quantity_on_hand += quantity
            tx = StockTransaction(
                part_id=part.id,
                created_by_user_id=current_user.id,
                request_id=resolved_request_id,
                technician_id=resolved_technician_id,
                customer_id=resolved_customer_id,
                job_id=resolved_job_id,
                transaction_type=StockTransactionType.IN,
                quantity_delta=quantity,
                movement_type="RETURN",
                notes=notes,
            )
        else:
            effective = get_effective_settings(self.repo.db)
            if effective.faulty_quarantine_location_id is not None:
                quarantine = self.repo.db.get(Location, effective.faulty_quarantine_location_id)
                if quarantine:
                    existing = self.repo.db.scalar(
                        select(PartLocationStock)
                        .where(
                            PartLocationStock.part_id == part.id,
                            PartLocationStock.location_id == quarantine.id,
                        )
                        .limit(1)
                    )
                    if existing:
                        existing.quantity_on_hand += quantity
                    else:
                        self.repo.add(
                            PartLocationStock(
                                part_id=part.id,
                                location_id=quarantine.id,
                                quantity_on_hand=quantity,
                            )
                        )
            tx = StockTransaction(
                part_id=part.id,
                created_by_user_id=current_user.id,
                request_id=resolved_request_id,
                technician_id=resolved_technician_id,
                customer_id=resolved_customer_id,
                job_id=resolved_job_id,
                transaction_type=StockTransactionType.ADJUST,
                quantity_delta=0,
                movement_type="FAULTY_RETURN",
                notes=notes,
            )

        self.repo.add(tx)
        log_audit(
            self.repo.db,
            current_user,
            action="return",
            entity_type="batch_item",
            entity_id=part.id,
            detail={"condition": condition, "quantity": quantity},
        )
        self.repo.commit()
        self.repo.refresh(tx)
        self._sync_request_and_job(resolved_request_id)
        if condition == "FAULTY":
            dispatch_alert(
                self.repo.db,
                actor=current_user,
                event="faulty_return",
                subject=f"Faulty Batch Return: Part #{part.id}",
                body=f"Part {part.sku} was returned as FAULTY in quantity {quantity} by {current_user.email}.",
            )
        return tx

    def _next_serial(self, sku: str) -> str:
        prefix = (sku or "ITEM").upper().replace(" ", "-")[:30]
        while True:
            token = uuid.uuid4().hex[:8].upper()
            serial = f"{prefix}-{token}"
            exists = self.repo.db.scalar(select(ItemInstance.id).where(ItemInstance.serial_number == serial).limit(1))
            if exists is None:
                return serial

    def _sync_request_and_job(self, request_id: int | None) -> None:
        if request_id is None:
            return
        request = self.repo.get_request(request_id)
        if not request:
            return
        if request.status not in {StockRequestStatus.ISSUED, StockRequestStatus.CLOSED}:
            return

        pending_returns = int(
            self.repo.db.scalar(
                select(func.count(StockTransaction.id)).where(
                    StockTransaction.request_id == request_id,
                    StockTransaction.movement_type == "RETURN_PENDING",
                )
            )
            or 0
        )
        if pending_returns > 0:
            request.status = StockRequestStatus.ISSUED
            request.closure_type = None
            request.closed_at = None
            self.repo.commit()
            return

        issued_txs = self.repo.list_outbound_instance_transactions_for_request(request_id)
        instance_ids = {tx.item_instance_id for tx in issued_txs if tx.item_instance_id is not None}
        has_open_individual = False
        for instance_id in instance_ids:
            instance = self.repo.get_item_instance(int(instance_id))
            if instance and instance.status == ItemStatus.ISSUED:
                has_open_individual = True
                break

        batch_remaining = int(
            self.repo.db.scalar(
                select(func.coalesce(func.sum(IssuedBatchItem.quantity_remaining), 0)).where(
                    IssuedBatchItem.request_id == request_id,
                    IssuedBatchItem.quantity_remaining > 0,
                )
            )
            or 0
        )
        if has_open_individual or batch_remaining > 0:
            request.status = StockRequestStatus.ISSUED
            request.closure_type = None
            request.closed_at = None
            self.repo.commit()
            return

        has_return_activity = int(
            self.repo.db.scalar(
                select(func.count(StockTransaction.id)).where(
                    StockTransaction.request_id == request_id,
                    StockTransaction.movement_type.in_(["RETURN", "FAULTY_RETURN"]),
                )
            )
            or 0
        ) > 0
        request.status = StockRequestStatus.CLOSED
        request.closure_type = "RETURNED" if has_return_activity else "SOLD"
        request.closed_at = datetime.now(UTC)

        if request.job_id is not None:
            job = self.repo.db.get(Job, request.job_id)
            if job:
                active_requests = int(
                    self.repo.db.scalar(
                        select(func.count(StockRequest.id)).where(
                            StockRequest.job_id == request.job_id,
                            StockRequest.status.in_(
                                [
                                    StockRequestStatus.PENDING,
                                    StockRequestStatus.APPROVED,
                                    StockRequestStatus.ISSUED,
                                ]
                            ),
                        )
                    )
                    or 0
                )
                if active_requests == 0 and (job.status or "").lower() != "completed":
                    job.status = "completed"
        self.repo.commit()

    def _next_instance_barcode(self, serial_number: str) -> str:
        base = f"WP-I-{serial_number.strip().upper().replace(' ', '-')[:48]}"
        candidate = base
        suffix = 1
        while True:
            exists = self.repo.db.scalar(select(ItemInstance.id).where(ItemInstance.barcode_value == candidate).limit(1))
            if exists is None:
                return candidate
            suffix += 1
            candidate = f"{base}-{suffix}"

    def _next_grn_number(self) -> str:
        while True:
            token = uuid.uuid4().hex[:8].upper()
            candidate = f"GRN-{token}"
            exists = self.repo.db.scalar(select(StockTransaction.id).where(StockTransaction.grn_number == candidate).limit(1))
            if exists is None:
                return candidate

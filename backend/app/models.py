from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="technician")  # admin | technician | store_manager | manager | approver
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)

    created_jobs: Mapped[list["Job"]] = relationship(
        back_populates="created_by",
        foreign_keys="Job.created_by_user_id",
    )
    assigned_jobs: Mapped[list["Job"]] = relationship(
        back_populates="assigned_to",
        foreign_keys="Job.assigned_to_user_id",
    )
    stock_requests: Mapped[list["StockRequest"]] = relationship(
        back_populates="requested_by",
        foreign_keys="StockRequest.requested_by_user_id",
    )
    approvals: Mapped[list["StockRequest"]] = relationship(
        back_populates="approved_by",
        foreign_keys="StockRequest.approved_by_user_id",
    )


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent: Mapped[Optional["Category"]] = relationship(remote_side=[id])
    parts: Mapped[list["Part"]] = relationship(back_populates="category")


class Location(Base, TimestampMixin):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parts: Mapped[list["Part"]] = relationship(back_populates="location")
    item_instances: Mapped[list["ItemInstance"]] = relationship(back_populates="location")


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    jobs: Mapped[list["Job"]] = relationship(back_populates="customer")


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="open")  # open|in_progress|completed|canceled
    priority: Mapped[str] = mapped_column(String(50), default="medium")  # low|medium|high

    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_to_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="jobs")
    created_by: Mapped[Optional["User"]] = relationship(
        back_populates="created_jobs",
        foreign_keys=[created_by_user_id],
    )
    assigned_to: Mapped[Optional["User"]] = relationship(
        back_populates="assigned_jobs",
        foreign_keys=[assigned_to_user_id],
    )


class Part(Base, TimestampMixin):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    min_quantity: Mapped[int] = mapped_column(Integer, default=0)
    tracking_type: Mapped[str] = mapped_column(String(20), default="BATCH")  # BATCH | INDIVIDUAL
    unit_of_measure: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id"), nullable=True, index=True)

    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)

    category: Mapped[Optional["Category"]] = relationship(back_populates="parts")
    location: Mapped[Optional["Location"]] = relationship(back_populates="parts")
    supplier: Mapped[Optional["Supplier"]] = relationship(back_populates="parts")
    stock_transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="part")
    item_instances: Mapped[list["ItemInstance"]] = relationship(back_populates="part")


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parts: Mapped[list["Part"]] = relationship(back_populates="supplier")


class StockTransactionType(str, Enum):
    IN = "IN"
    OUT = "OUT"
    ADJUST = "ADJUST"


class StockTransaction(Base, TimestampMixin):
    __tablename__ = "stock_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    request_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stock_requests.id"), nullable=True, index=True)
    technician_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    item_instance_id: Mapped[Optional[int]] = mapped_column(ForeignKey("item_instances.id"), nullable=True, index=True)
    movement_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    transaction_type: Mapped[StockTransactionType] = mapped_column(
        SAEnum(StockTransactionType, name="stock_transaction_type"),
    )
    quantity_delta: Mapped[int] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    part: Mapped["Part"] = relationship(back_populates="stock_transactions")
    supplier: Mapped[Optional["Supplier"]] = relationship()
    created_by: Mapped[Optional["User"]] = relationship()
    request: Mapped[Optional["StockRequest"]] = relationship(back_populates="transactions")
    item_instance: Mapped[Optional["ItemInstance"]] = relationship(back_populates="transactions")


class ItemStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ISSUED = "ISSUED"
    USED = "USED"
    RETURNED = "RETURNED"
    FAULTY = "FAULTY"


class ItemInstance(Base, TimestampMixin):
    __tablename__ = "item_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[ItemStatus] = mapped_column(SAEnum(ItemStatus, name="item_status"), default=ItemStatus.AVAILABLE)
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id"), nullable=True, index=True)

    part: Mapped["Part"] = relationship(back_populates="item_instances")
    location: Mapped[Optional["Location"]] = relationship(back_populates="item_instances")
    transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="item_instance")
    usage_records: Mapped[list["UsageRecord"]] = relationship(back_populates="item_instance")


class StockRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ISSUED = "ISSUED"
    CLOSED = "CLOSED"


class StockRequest(Base, TimestampMixin):
    __tablename__ = "stock_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requested_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    status: Mapped[StockRequestStatus] = mapped_column(SAEnum(StockRequestStatus, name="stock_request_status"))
    total_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    required_approval_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    approved_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    requested_by: Mapped["User"] = relationship(back_populates="stock_requests", foreign_keys=[requested_by_user_id])
    approved_by: Mapped[Optional["User"]] = relationship(back_populates="approvals", foreign_keys=[approved_by_user_id])
    lines: Mapped[list["StockRequestLine"]] = relationship(back_populates="request", cascade="all, delete-orphan")
    transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="request")


class StockRequestLine(Base, TimestampMixin):
    __tablename__ = "stock_request_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("stock_requests.id"), index=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    tracking_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    request: Mapped["StockRequest"] = relationship(back_populates="lines")
    part: Mapped["Part"] = relationship()


class UsageRecord(Base, TimestampMixin):
    __tablename__ = "usage_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_instance_id: Mapped[int] = mapped_column(ForeignKey("item_instances.id"), index=True)
    request_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stock_requests.id"), nullable=True, index=True)
    technician_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)

    item_instance: Mapped["ItemInstance"] = relationship(back_populates="usage_records")


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

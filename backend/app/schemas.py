from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "staff"
    is_active: bool = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: Optional[str] = None
    role: str = "staff"


class UserRead(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime


class CustomerBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerRead(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime


class JobBase(BaseModel):
    customer_id: int
    title: str
    description: Optional[str] = None
    status: str = "open"
    priority: str = "medium"
    assigned_to_user_id: Optional[int] = None


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    customer_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_user_id: Optional[int] = None


class JobRead(JobBase):
    id: int
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class PartBase(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    unit_price: Optional[float] = Field(default=None, ge=0)
    quantity_on_hand: int = Field(default=0, ge=0)
    min_quantity: int = Field(default=0, ge=0)
    supplier_id: Optional[int] = None


class PartCreate(PartBase):
    pass


class PartUpdate(BaseModel):
    sku: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    unit_price: Optional[float] = Field(default=None, ge=0)
    quantity_on_hand: Optional[int] = Field(default=None, ge=0)
    min_quantity: Optional[int] = Field(default=None, ge=0)
    supplier_id: Optional[int] = None


class PartRead(PartBase):
    id: int
    created_at: datetime
    updated_at: datetime


class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierRead(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime


class StockTransactionType(str, Enum):
    IN = "IN"
    OUT = "OUT"
    ADJUST = "ADJUST"


class StockTransactionBase(BaseModel):
    part_id: int
    transaction_type: StockTransactionType
    quantity_delta: int
    supplier_id: Optional[int] = None
    notes: Optional[str] = None


class StockTransactionCreate(StockTransactionBase):
    pass


class StockTransactionRead(StockTransactionBase):
    id: int
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ItemCreate(PartCreate):
    pass


class ItemUpdate(PartUpdate):
    pass


class ItemRead(PartRead):
    pass


class PaginatedItems(BaseModel):
    items: list[ItemRead]
    page: int
    page_size: int
    total: int

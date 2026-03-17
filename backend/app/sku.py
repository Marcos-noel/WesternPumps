from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Part


SKU_PREFIX = "WPS"


def _next_system_sku_number(db: Session) -> int:
    rows = db.scalars(select(Part.sku)).all()
    max_num = 0
    for sku in rows:
        value = (sku or "").strip().upper()
        if not value.startswith(f"{SKU_PREFIX}-"):
            continue
        tail = value.split("-", 1)[1].strip()
        if tail.isdigit():
            max_num = max(max_num, int(tail))
    return max_num + 1


def generate_system_sku(db: Session) -> str:
    next_num = _next_system_sku_number(db)
    candidate = f"{SKU_PREFIX}-{next_num:06d}"
    while db.scalar(select(Part.id).where(Part.sku == candidate).limit(1)) is not None:
        next_num += 1
        candidate = f"{SKU_PREFIX}-{next_num:06d}"
    return candidate

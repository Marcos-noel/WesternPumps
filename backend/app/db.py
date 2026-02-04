from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    engine_kwargs = {"connect_args": {"check_same_thread": False}}

engine = create_engine(settings.database_url, **engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def ensure_schema(engine: Engine) -> None:
    """
    Best-effort schema setup for development.

    This project currently does not use Alembic migrations. `create_all()` only
    creates missing tables and does not add new columns to existing tables, so
    we patch forward a small set of additive changes required by the app.
    """

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if not inspector.has_table("parts"):
        return

    existing_columns = {c["name"] for c in inspector.get_columns("parts")}

    with engine.begin() as conn:
        if "min_quantity" not in existing_columns:
            conn.execute(text("ALTER TABLE parts ADD COLUMN min_quantity INTEGER NOT NULL DEFAULT 0"))
        if "supplier_id" not in existing_columns:
            conn.execute(text("ALTER TABLE parts ADD COLUMN supplier_id INTEGER NULL"))
        if "tracking_type" not in existing_columns:
            conn.execute(text("ALTER TABLE parts ADD COLUMN tracking_type VARCHAR(20) NOT NULL DEFAULT 'BATCH'"))
        if "unit_of_measure" not in existing_columns:
            conn.execute(text("ALTER TABLE parts ADD COLUMN unit_of_measure VARCHAR(50) NULL"))
        if "category_id" not in existing_columns:
            conn.execute(text("ALTER TABLE parts ADD COLUMN category_id INTEGER NULL"))
        if "location_id" not in existing_columns:
            conn.execute(text("ALTER TABLE parts ADD COLUMN location_id INTEGER NULL"))

    # Create an index for supplier_id if missing (matches SQLAlchemy default name).
    indexes = inspector.get_indexes("parts")
    has_supplier_index = any("supplier_id" in (idx.get("column_names") or []) for idx in indexes)
    if not has_supplier_index:
        with engine.begin() as conn:
            conn.execute(text("CREATE INDEX ix_parts_supplier_id ON parts (supplier_id)"))

    # Patch forward stock_transactions columns for request workflows.
    if not inspector.has_table("stock_transactions"):
        return

    tx_columns = {c["name"] for c in inspector.get_columns("stock_transactions")}
    with engine.begin() as conn:
        if "request_id" not in tx_columns:
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN request_id INTEGER NULL"))
        if "technician_id" not in tx_columns:
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN technician_id INTEGER NULL"))
        if "customer_id" not in tx_columns:
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN customer_id INTEGER NULL"))
        if "job_id" not in tx_columns:
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN job_id INTEGER NULL"))
        if "item_instance_id" not in tx_columns:
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN item_instance_id INTEGER NULL"))
        if "movement_type" not in tx_columns:
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN movement_type VARCHAR(20) NULL"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

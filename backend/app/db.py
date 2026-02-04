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

    # Create an index for supplier_id if missing (matches SQLAlchemy default name).
    indexes = inspector.get_indexes("parts")
    has_supplier_index = any("supplier_id" in (idx.get("column_names") or []) for idx in indexes)
    if not has_supplier_index:
        with engine.begin() as conn:
            conn.execute(text("CREATE INDEX ix_parts_supplier_id ON parts (supplier_id)"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

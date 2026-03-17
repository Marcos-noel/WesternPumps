from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import select


def _inject_database_url_from_args() -> None:
    if "--database-url" not in sys.argv:
        return
    idx = sys.argv.index("--database-url")
    if idx + 1 >= len(sys.argv):
        return
    os.environ["DATABASE_URL"] = sys.argv[idx + 1]


_inject_database_url_from_args()

from app.db import SessionLocal, ensure_schema, engine
from app.models import Part


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate all Part SKU values to system format WPS-XXXXXX."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes. Without this flag, the script runs in dry-run mode.",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="Optional DATABASE_URL override, e.g. sqlite:///./westernpumps.db",
    )
    args = parser.parse_args()

    ensure_schema(engine)
    db = SessionLocal()
    try:
        parts = db.scalars(select(Part).order_by(Part.id.asc())).all()
        planned: list[tuple[int, str, str]] = []
        for index, part in enumerate(parts, start=1):
            new_sku = f"WPS-{index:06d}"
            if (part.sku or "").strip().upper() != new_sku:
                planned.append((part.id, part.sku or "", new_sku))

        print(f"Total parts: {len(parts)}")
        print(f"SKU changes needed: {len(planned)}")
        for part_id, old_sku, new_sku in planned[:25]:
            print(f"Part #{part_id}: {old_sku} -> {new_sku}")
        if len(planned) > 25:
            print(f"... and {len(planned) - 25} more")

        if not args.apply:
            print("Dry run complete. Re-run with --apply to write changes.")
            return 0

        for part_id, _old_sku, new_sku in planned:
            part = db.get(Part, part_id)
            if part is None:
                continue
            part.sku = new_sku
        db.commit()
        print("SKU regeneration applied successfully.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

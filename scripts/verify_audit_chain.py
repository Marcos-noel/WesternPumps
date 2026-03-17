#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sqlite3
import sys


def verify_sqlite(db_path: pathlib.Path, limit: int) -> dict[str, object]:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id,user_id,action,entity_type,entity_id,detail,prev_hash,entry_hash FROM audit_logs ORDER BY id ASC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()

    previous_hash = None
    broken: list[int] = []
    for row in rows:
        if (row["prev_hash"] or None) != (previous_hash or None):
            broken.append(int(row["id"]))
        basis = "|".join(
            [
                str(row["user_id"] if row["user_id"] is not None else ""),
                row["action"] or "",
                row["entity_type"] or "",
                str(row["entity_id"] if row["entity_id"] is not None else ""),
                row["detail"] or "",
                row["prev_hash"] or "",
            ]
        )
        expected = hashlib.sha256(basis.encode("utf-8")).hexdigest()
        if (row["entry_hash"] or "") != expected:
            broken.append(int(row["id"]))
        previous_hash = row["entry_hash"]

    return {
        "checked": len(rows),
        "valid": len(broken) == 0,
        "broken_ids": sorted(set(broken))[:200],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify audit log hash chain integrity for SQLite DB.")
    parser.add_argument("--sqlite-path", required=True, help="Path to SQLite DB")
    parser.add_argument("--limit", type=int, default=200000, help="Max rows to check")
    args = parser.parse_args()

    db_path = pathlib.Path(args.sqlite_path).resolve()
    if not db_path.exists():
        print(f"DB not found: {db_path}", file=sys.stderr)
        sys.exit(1)
    result = verify_sqlite(db_path, args.limit)
    print(json.dumps(result, indent=2))
    if not result["valid"]:
        sys.exit(2)


if __name__ == "__main__":
    main()

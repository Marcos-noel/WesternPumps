#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


REQUIRED_INDEXES = {
    "parts": ["sku", "name", "barcode_value"],
    "item_instances": ["serial_number", "barcode_value", "part_id"],
    "stock_transactions": ["part_id", "created_at", "item_instance_id", "request_id"],
    "audit_logs": ["created_at", "entry_hash"],
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Check SQLite index coverage for scaling readiness.")
    parser.add_argument("--sqlite-path", required=True, help="Path to sqlite database")
    args = parser.parse_args()

    db_path = Path(args.sqlite_path).resolve()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    failures: list[str] = []
    table_reports: dict[str, dict[str, object]] = {}

    for table, required_cols in REQUIRED_INDEXES.items():
        indexes = conn.execute(f"PRAGMA index_list({table})").fetchall()
        indexed_cols: set[str] = set()
        for idx in indexes:
            cols = conn.execute(f"PRAGMA index_info({idx['name']})").fetchall()
            indexed_cols.update(str(c["name"]) for c in cols if c["name"])
        missing = [c for c in required_cols if c not in indexed_cols]
        table_reports[table] = {"indexed_columns": sorted(indexed_cols), "missing_required": missing}
        for col in missing:
            failures.append(f"{table}.{col}")

    conn.close()
    payload = {"pass": len(failures) == 0, "missing": failures, "tables": table_reports}
    print(json.dumps(payload, indent=2))
    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()

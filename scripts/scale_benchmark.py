#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
import time
from pathlib import Path


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            quantity_on_hand INTEGER NOT NULL DEFAULT 0,
            min_quantity INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS item_instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_id INTEGER NOT NULL,
            serial_number TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'AVAILABLE',
            FOREIGN KEY(part_id) REFERENCES parts(id)
        );
        CREATE INDEX IF NOT EXISTS ix_parts_name ON parts(name);
        CREATE INDEX IF NOT EXISTS ix_item_instances_part_id ON item_instances(part_id);
        CREATE INDEX IF NOT EXISTS ix_item_instances_serial ON item_instances(serial_number);
        """
    )
    conn.commit()


def seed_data(conn: sqlite3.Connection, sku_count: int, instance_count: int) -> None:
    parts = []
    for i in range(1, sku_count + 1):
        sku = f"SKU-{i:05d}"
        name = f"Benchmark Item {i:05d}"
        qoh = i % 201
        min_q = i % 21
        parts.append((sku, name, qoh, min_q))
    conn.executemany("INSERT INTO parts (sku,name,quantity_on_hand,min_quantity) VALUES (?,?,?,?)", parts)
    conn.commit()

    serial_rows = []
    for i in range(1, instance_count + 1):
        part_id = ((i - 1) % sku_count) + 1
        serial_rows.append((part_id, f"SER-{i:06d}", "AVAILABLE"))
        if len(serial_rows) >= 5000:
            conn.executemany(
                "INSERT INTO item_instances (part_id,serial_number,status) VALUES (?,?,?)",
                serial_rows,
            )
            conn.commit()
            serial_rows.clear()
    if serial_rows:
        conn.executemany(
            "INSERT INTO item_instances (part_id,serial_number,status) VALUES (?,?,?)",
            serial_rows,
        )
        conn.commit()


def timed_query(conn: sqlite3.Connection, sql: str, params: tuple = (), runs: int = 10) -> float:
    samples: list[float] = []
    for _ in range(runs):
        started = time.perf_counter()
        _ = conn.execute(sql, params).fetchall()
        samples.append((time.perf_counter() - started) * 1000.0)
    samples.sort()
    idx = min(int(len(samples) * 0.95), len(samples) - 1)
    return samples[idx]


def main() -> None:
    parser = argparse.ArgumentParser(description="Scale benchmark for 10k SKU and 100k instance targets.")
    parser.add_argument("--sku-count", type=int, default=10000)
    parser.add_argument("--instance-count", type=int, default=100000)
    parser.add_argument("--max-query-p95-ms", type=float, default=250.0)
    parser.add_argument("--db-path", default="", help="Optional sqlite file path; default uses temp file")
    args = parser.parse_args()

    if args.db_path.strip():
        db_path = Path(args.db_path).resolve()
    else:
        temp = tempfile.NamedTemporaryFile(prefix="scale-benchmark-", suffix=".sqlite3", delete=False)
        db_path = Path(temp.name)
        temp.close()

    started = time.perf_counter()
    conn = sqlite3.connect(str(db_path))
    create_schema(conn)
    seed_data(conn, args.sku_count, args.instance_count)
    seed_seconds = time.perf_counter() - started

    q1 = timed_query(conn, "SELECT id,sku,name FROM parts ORDER BY name LIMIT 50 OFFSET 5000")
    q2 = timed_query(conn, "SELECT id,part_id,status FROM item_instances WHERE serial_number = ?", ("SER-090000",))
    q3 = timed_query(
        conn,
        """
        SELECT p.id, p.sku, COUNT(i.id) AS c
        FROM parts p
        LEFT JOIN item_instances i ON i.part_id = p.id
        GROUP BY p.id, p.sku
        ORDER BY c DESC
        LIMIT 100
        """,
    )

    p95_max = max(q1, q2, q3)
    passed = p95_max <= args.max_query_p95_ms
    result = {
        "db_path": str(db_path),
        "sku_count": args.sku_count,
        "instance_count": args.instance_count,
        "seed_seconds": round(seed_seconds, 3),
        "query_p95_ms": {
            "stock_level_page": round(q1, 3),
            "serial_lookup": round(q2, 3),
            "top_density_aggregate": round(q3, 3),
        },
        "max_query_p95_ms": round(p95_max, 3),
        "threshold_ms": args.max_query_p95_ms,
        "pass": passed,
    }
    print(json.dumps(result, indent=2))
    conn.close()
    if not passed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()

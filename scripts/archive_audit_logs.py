#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import pathlib
import sqlite3
import stat
import sys


def archive_sqlite(db_path: pathlib.Path, out_dir: pathlib.Path, older_than_days: int, limit: int) -> dict[str, object]:
    out_dir.mkdir(parents=True, exist_ok=True)
    cutoff = dt.datetime.now(dt.UTC) - dt.timedelta(days=older_than_days)
    cutoff_text = cutoff.strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(audit_logs)").fetchall()}
    select_cols = ["id", "user_id", "action", "entity_type", "entity_id", "detail", "created_at"]
    if "prev_hash" in cols:
        select_cols.append("prev_hash")
    if "entry_hash" in cols:
        select_cols.append("entry_hash")
    select_clause = ",".join(select_cols)
    rows = conn.execute(
        f"""
        SELECT {select_clause}
        FROM audit_logs
        WHERE created_at < ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (cutoff_text, limit),
    ).fetchall()
    conn.close()

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    archive_path = out_dir / f"audit-archive-{stamp}.ndjson"
    manifest_path = out_dir / f"audit-archive-{stamp}.manifest.json"

    digest = hashlib.sha256()
    with archive_path.open("w", encoding="utf-8", newline="\n") as f:
        for row in rows:
            payload = dict(row)
            line = json.dumps(payload, ensure_ascii=True)
            f.write(line + "\n")
            digest.update((line + "\n").encode("utf-8"))

    archive_path.chmod(stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)
    manifest = {
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "db_path": str(db_path),
        "cutoff_days": older_than_days,
        "rows_archived": len(rows),
        "first_id": int(rows[0]["id"]) if rows else None,
        "last_id": int(rows[-1]["id"]) if rows else None,
        "sha256": digest.hexdigest(),
        "archive_file": archive_path.name,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    manifest_path.chmod(stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Archive old audit logs into immutable ndjson artifacts.")
    parser.add_argument("--sqlite-path", required=True, help="Path to SQLite DB")
    parser.add_argument("--out", default="audit_archives", help="Archive output directory")
    parser.add_argument("--older-than-days", type=int, default=365, help="Archive logs older than this many days")
    parser.add_argument("--limit", type=int, default=500000, help="Maximum rows to archive")
    args = parser.parse_args()

    db_path = pathlib.Path(args.sqlite_path).resolve()
    if not db_path.exists():
        print(f"DB not found: {db_path}", file=sys.stderr)
        sys.exit(1)

    result = archive_sqlite(
        db_path=db_path,
        out_dir=pathlib.Path(args.out).resolve(),
        older_than_days=args.older_than_days,
        limit=args.limit,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

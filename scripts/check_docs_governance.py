#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
REQUIRED_DOCS = [
    "docs/overview.md",
    "docs/architecture.md",
    "docs/auth.md",
    "docs/api.md",
    "docs/inventory.md",
    "docs/release-governance.md",
    "docs/requirements-status-tracker.md",
    "docs/validation/usability-validation.md",
    "docs/validation/responsive-validation.md",
    "docs/documentation-governance.md",
    "CHANGELOG.md",
]


def parse_status_and_date(path: pathlib.Path) -> tuple[str | None, dt.date | None]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    status = None
    test_date = None
    status_match = re.search(r"^\s*-\s*Status:\s*([A-Z_]+)\s*$", text, re.MULTILINE)
    if status_match:
        status = status_match.group(1)
    date_match = re.search(r"^\s*-\s*Test date:\s*(\d{4}-\d{2}-\d{2})\s*$", text, re.MULTILINE)
    if date_match:
        test_date = dt.date.fromisoformat(date_match.group(1))
    return status, test_date


def main() -> None:
    parser = argparse.ArgumentParser(description="Check required documentation and validation evidence freshness.")
    parser.add_argument("--max-age-days", type=int, default=180, help="Maximum age for validation evidence")
    args = parser.parse_args()

    failures: list[str] = []
    for rel in REQUIRED_DOCS:
        if not (ROOT / rel).exists():
            failures.append(f"missing:{rel}")

    today = dt.date.today()
    for rel in ["docs/validation/usability-validation.md", "docs/validation/responsive-validation.md"]:
        path = ROOT / rel
        if not path.exists():
            continue
        status, test_date = parse_status_and_date(path)
        if status != "PASS":
            failures.append(f"status_not_pass:{rel}")
        if test_date is None:
            failures.append(f"missing_test_date:{rel}")
        elif (today - test_date).days > args.max_age_days:
            failures.append(f"stale_validation:{rel}:{test_date.isoformat()}")

    payload = {"pass": len(failures) == 0, "failures": failures}
    print(json.dumps(payload, indent=2))
    if failures:
        sys.exit(2)


if __name__ == "__main__":
    main()

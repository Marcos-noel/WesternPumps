#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "docs" / "requirements-status.json"
MD_PATH = ROOT / "docs" / "requirements-status-tracker.md"

VALID_STATUS = {"MET", "PARTIAL", "NOT_MET"}


def load_data() -> dict[str, Any]:
    return json.loads(JSON_PATH.read_text(encoding="utf-8"))


def save_data(data: dict[str, Any]) -> None:
    JSON_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def set_requirement(data: dict[str, Any], req_id: str, status: str, note: str | None) -> None:
    req_id = req_id.strip().upper()
    if status not in VALID_STATUS:
        raise ValueError(f"Invalid status: {status}")
    bucket = "fr" if req_id.startswith("FR-") else "nfr" if req_id.startswith("NFR-") else None
    if not bucket:
        raise ValueError("Requirement ID must start with FR- or NFR-")
    if req_id not in data[bucket]:
        raise ValueError(f"Unknown requirement ID: {req_id}")
    data[bucket][req_id]["status"] = status
    if note is not None:
        data[bucket][req_id]["notes"] = note.strip()


def set_module(data: dict[str, Any], module_name: str, status: str, note: str | None, met_on: str | None) -> None:
    if status not in VALID_STATUS:
        raise ValueError(f"Invalid status: {status}")
    module = None
    for row in data["modules"]:
        if row["name"].strip().lower() == module_name.strip().lower():
            module = row
            break
    if not module:
        raise ValueError(f"Unknown module: {module_name}")
    module["status"] = status
    if note is not None:
        module["notes"] = note.strip()
    if met_on is not None:
        module["met_on"] = met_on
    elif status == "MET" and not module.get("met_on"):
        module["met_on"] = data["updated_on"]
    elif status != "MET":
        module["met_on"] = ""


def table(headers: list[str], rows: list[list[str]]) -> str:
    out = []
    out.append("| " + " | ".join(headers) + " |")
    out.append("|" + "|".join("---" for _ in headers) + "|")
    for row in rows:
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def render(data: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Requirements Status Tracker (Agent Context)")
    lines.append(f"Last updated: {data['updated_on']}")
    lines.append("Source documents:")
    for src in data["sources"]:
        lines.append(f"- `{src}`")
    lines.append("")
    lines.append("Purpose:")
    lines.append("- Single source of truth for requirement/module completion status.")
    lines.append("- Reusable context for other agents.")
    lines.append("- Update via `python scripts/update_requirements_tracker.py`.")
    lines.append("")
    lines.append("Status legend:")
    lines.append("- `MET`: implemented and verified in current system behavior.")
    lines.append("- `PARTIAL`: implemented in part or with notable limitations.")
    lines.append("- `NOT_MET`: not implemented or not evidenced.")
    lines.append("")
    lines.append("## Module-Level Status (Proposal Alignment)")
    module_rows = [
        [
            m["name"],
            m["status"],
            m.get("met_on", ""),
            m.get("notes", ""),
        ]
        for m in data["modules"]
    ]
    lines.append(table(["Module", "Status", "Met on", "Notes"], module_rows))
    lines.append("")
    lines.append("## Stage 1 Functional Requirements (FR)")
    fr_rows = [[k, v["status"], v.get("notes", "")] for k, v in sorted(data["fr"].items(), key=lambda x: int(x[0].split("-")[1]))]
    lines.append(table(["ID", "Status", "Notes"], fr_rows))
    lines.append("")
    lines.append("## Stage 1 Non-Functional Requirements (NFR)")
    nfr_rows = [[k, v["status"], v.get("notes", "")] for k, v in sorted(data["nfr"].items(), key=lambda x: int(x[0].split("-")[1]))]
    lines.append(table(["ID", "Status", "Notes"], nfr_rows))
    lines.append("")
    lines.append("## Update Commands")
    lines.append("- Regenerate markdown only:")
    lines.append("  - `python scripts/update_requirements_tracker.py`")
    lines.append("- Update a requirement status:")
    lines.append("  - `python scripts/update_requirements_tracker.py --set FR-016 MET --note \"...\"`")
    lines.append("- Update a module status:")
    lines.append("  - `python scripts/update_requirements_tracker.py --set-module \"Core Inventory Management Module\" MET --met-on 2026-02-18`")
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Update and regenerate requirements status tracker markdown.")
    parser.add_argument("--set", dest="set_req", help="Requirement ID to update, e.g. FR-016")
    parser.add_argument("--set-module", dest="set_module", help="Module name to update")
    parser.add_argument("--status", choices=sorted(VALID_STATUS), help="New status for --set or --set-module")
    parser.add_argument("--note", help="Optional note update")
    parser.add_argument("--met-on", help="Optional met date (YYYY-MM-DD) for module updates")
    parser.add_argument("--date", help="Override tracker date (YYYY-MM-DD)")
    args = parser.parse_args()

    data = load_data()
    data["updated_on"] = args.date or dt.date.today().isoformat()

    if args.set_req:
        if not args.status:
            print("--status is required with --set", file=sys.stderr)
            sys.exit(2)
        set_requirement(data, args.set_req, args.status, args.note)
    if args.set_module:
        if not args.status:
            print("--status is required with --set-module", file=sys.stderr)
            sys.exit(2)
        set_module(data, args.set_module, args.status, args.note, args.met_on)

    save_data(data)
    MD_PATH.write_text(render(data), encoding="utf-8")
    print(f"Updated: {JSON_PATH}")
    print(f"Generated: {MD_PATH}")


if __name__ == "__main__":
    main()

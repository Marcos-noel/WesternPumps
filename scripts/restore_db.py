#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import pathlib
import shutil
import sys
from typing import Iterable

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def derive_key(passphrase: str, salt: bytes, iterations: int) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations)
    return base64.urlsafe_b64encode(kdf.derive(passphrase.encode("utf-8")))


def decrypt_backup(enc_path: pathlib.Path, passphrase: str) -> pathlib.Path:
    meta_path = enc_path.with_suffix(enc_path.suffix + ".meta.json")
    if not meta_path.exists():
        raise RuntimeError(f"Metadata file not found for encrypted backup: {meta_path}")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    salt = base64.b64decode(meta["salt_b64"])
    iterations = int(meta.get("iterations", 390000))
    key = derive_key(passphrase, salt, iterations)
    payload = Fernet(key).decrypt(enc_path.read_bytes())
    out_name = meta.get("original_name") or enc_path.stem
    out_path = enc_path.parent / f"decrypted-{out_name}"
    out_path.write_bytes(payload)
    return out_path


def parse_stamp(name: str) -> dt.datetime | None:
    # Matches foo-YYYYMMDD-HHMMSS.suffix*
    stem = name.split(".", 1)[0]
    parts = stem.split("-")
    if len(parts) < 3:
        return None
    stamp = f"{parts[-2]}-{parts[-1]}"
    try:
        return dt.datetime.strptime(stamp, "%Y%m%d-%H%M%S").replace(tzinfo=dt.UTC)
    except ValueError:
        return None


def list_backup_candidates(backup_dir: pathlib.Path) -> list[pathlib.Path]:
    candidates: list[pathlib.Path] = []
    for p in backup_dir.iterdir():
        if not p.is_file():
            continue
        if p.suffix in {".sqlite3", ".sql"} or p.name.endswith(".sqlite3.enc") or p.name.endswith(".sql.enc"):
            candidates.append(p)
    return candidates


def pick_backup(candidates: Iterable[pathlib.Path], at_or_before: dt.datetime | None) -> pathlib.Path:
    ranked: list[tuple[dt.datetime, pathlib.Path]] = []
    for p in candidates:
        ts = parse_stamp(p.name)
        if ts is None:
            continue
        ranked.append((ts, p))
    if not ranked:
        raise RuntimeError("No timestamped backups found")
    ranked.sort(key=lambda x: x[0], reverse=True)
    if at_or_before is None:
        return ranked[0][1]
    for ts, p in ranked:
        if ts <= at_or_before:
            return p
    raise RuntimeError("No backup exists at or before requested timestamp")


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore database from backup artifact.")
    parser.add_argument("--backup-dir", default="backups", help="Backup directory")
    parser.add_argument("--backup-file", default="", help="Specific backup file to restore")
    parser.add_argument("--at-or-before", default="", help="Pick latest backup <= timestamp (ISO-8601 UTC)")
    parser.add_argument("--sqlite-target", default="", help="Restore target path for SQLite backups")
    parser.add_argument("--decrypt-passphrase", default="", help="Passphrase for .enc backups")
    parser.add_argument("--keep-decrypted-temp", action="store_true", help="Keep decrypted temporary file")
    args = parser.parse_args()

    backup_dir = pathlib.Path(args.backup_dir).resolve()
    if not backup_dir.exists():
        print(f"Backup directory not found: {backup_dir}", file=sys.stderr)
        sys.exit(1)

    if args.backup_file.strip():
        backup_path = pathlib.Path(args.backup_file).resolve()
    else:
        cutoff = None
        if args.at_or_before.strip():
            cutoff = dt.datetime.fromisoformat(args.at_or_before.strip().replace("Z", "+00:00"))
            if cutoff.tzinfo is None:
                cutoff = cutoff.replace(tzinfo=dt.UTC)
            cutoff = cutoff.astimezone(dt.UTC)
        backup_path = pick_backup(list_backup_candidates(backup_dir), cutoff)

    work_path = backup_path
    if backup_path.name.endswith(".enc"):
        if not args.decrypt_passphrase.strip():
            print("Encrypted backup selected. --decrypt-passphrase is required.", file=sys.stderr)
            sys.exit(2)
        work_path = decrypt_backup(backup_path, args.decrypt_passphrase.strip())

    if work_path.suffix == ".sqlite3":
        if not args.sqlite_target.strip():
            print("--sqlite-target is required for SQLite restore.", file=sys.stderr)
            sys.exit(2)
        target = pathlib.Path(args.sqlite_target).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(work_path, target)
        print(f"SQLite restore completed: {target}")
    elif work_path.suffix == ".sql":
        print(f"MySQL dump selected: {work_path}")
        print("Apply manually with: mysql -u <user> -p <db_name> < <dump.sql>")
    else:
        print(f"Unsupported restore artifact: {work_path}", file=sys.stderr)
        sys.exit(2)

    print(f"Source backup: {backup_path}")
    if work_path != backup_path:
        print(f"Decrypted temp file: {work_path}")
        if not args.keep_decrypted_temp and work_path.exists():
            try:
                work_path.unlink(missing_ok=True)
                print("Decrypted temp file removed.")
            except PermissionError:
                print("Warning: could not remove decrypted temp file due to file lock.")


if __name__ == "__main__":
    main()

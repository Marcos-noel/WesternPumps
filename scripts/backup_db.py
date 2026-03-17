#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import pathlib
import shutil
import stat
import subprocess
import sys
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


KDF_ITERATIONS = 390000


def backup_sqlite(db_path: pathlib.Path, out_dir: pathlib.Path) -> pathlib.Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out = out_dir / f"{db_path.stem}-{stamp}.sqlite3"
    shutil.copy2(db_path, out)
    return out


def backup_mysql(url: str, out_dir: pathlib.Path) -> pathlib.Path:
    parsed = urlparse(url.replace("+pymysql", ""))
    db_name = parsed.path.lstrip("/")
    host = parsed.hostname or "127.0.0.1"
    port = str(parsed.port or 3306)
    user = parsed.username or ""
    password = parsed.password or ""

    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out = out_dir / f"{db_name}-{stamp}.sql"

    cmd = ["mysqldump", "-h", host, "-P", port, "-u", user, db_name]
    env = os.environ.copy()
    if password:
        env["MYSQL_PWD"] = password

    with out.open("wb") as f:
        proc = subprocess.run(cmd, env=env, stdout=f, stderr=subprocess.PIPE, check=False)
    if proc.returncode != 0:
        out.unlink(missing_ok=True)
        raise RuntimeError(proc.stderr.decode("utf-8", errors="ignore").strip() or "mysqldump failed")
    return out


def derive_key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=KDF_ITERATIONS)
    return base64.urlsafe_b64encode(kdf.derive(passphrase.encode("utf-8")))


def encrypt_file(path: pathlib.Path, passphrase: str) -> tuple[pathlib.Path, pathlib.Path]:
    salt = os.urandom(16)
    key = derive_key(passphrase, salt)
    payload = path.read_bytes()
    encrypted = Fernet(key).encrypt(payload)
    encrypted_path = path.with_suffix(path.suffix + ".enc")
    encrypted_path.write_bytes(encrypted)
    if path.exists():
        try:
            path.chmod(stat.S_IWRITE | stat.S_IREAD)
            path.unlink(missing_ok=True)
        except PermissionError:
            # OneDrive/AV file handles can transiently lock files; continue with warning.
            print(f"Warning: could not delete plaintext artifact: {path}", file=sys.stderr)

    meta = {
        "algorithm": "fernet-pbkdf2-sha256",
        "iterations": KDF_ITERATIONS,
        "salt_b64": base64.b64encode(salt).decode("ascii"),
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "original_name": path.name,
        "encrypted_name": encrypted_path.name,
    }
    meta_path = encrypted_path.with_suffix(encrypted_path.suffix + ".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return encrypted_path, meta_path


def file_sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(backup_path: pathlib.Path, manifest_path: pathlib.Path, source: str) -> None:
    manifest = {
        "source": source,
        "backup_file": backup_path.name,
        "size_bytes": backup_path.stat().st_size,
        "sha256": file_sha256(backup_path),
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def prune_old_backups(out_dir: pathlib.Path, keep_days: int) -> int:
    if keep_days <= 0:
        return 0
    cutoff = dt.datetime.now(dt.UTC) - dt.timedelta(days=keep_days)
    removed = 0
    for candidate in out_dir.iterdir():
        if not candidate.is_file():
            continue
        modified = dt.datetime.fromtimestamp(candidate.stat().st_mtime, tz=dt.UTC)
        if modified < cutoff:
            candidate.unlink(missing_ok=True)
            removed += 1
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a DB backup for SQLite or MySQL URLs.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""), help="Database URL")
    parser.add_argument("--out", default="backups", help="Output directory")
    parser.add_argument("--sqlite-path", default="", help="Direct path for SQLite DB file")
    parser.add_argument("--encrypt-passphrase", default=os.getenv("BACKUP_ENCRYPTION_PASSPHRASE", ""), help="Encrypt backup with this passphrase")
    parser.add_argument("--retention-days", type=int, default=30, help="Delete backup artifacts older than this many days (0 disables)")
    args = parser.parse_args()

    out_dir = pathlib.Path(args.out).resolve()
    db_url = args.database_url.strip()
    source = ""

    try:
        if args.sqlite_path.strip():
            db_path = pathlib.Path(args.sqlite_path).resolve()
            source = f"sqlite:{db_path}"
            result = backup_sqlite(db_path, out_dir)
        elif db_url.startswith("sqlite"):
            parsed = urlparse(db_url)
            db_file = pathlib.Path(parsed.path.lstrip("/")).resolve()
            source = f"sqlite:{db_file}"
            result = backup_sqlite(db_file, out_dir)
        elif db_url.startswith("mysql"):
            source = "mysql"
            result = backup_mysql(db_url, out_dir)
        else:
            raise RuntimeError("Unsupported database URL. Use sqlite or mysql.")
    except Exception as exc:
        print(f"Backup failed: {exc}", file=sys.stderr)
        sys.exit(1)

    backup_file = result
    encrypted = False
    if args.encrypt_passphrase.strip():
        backup_file, meta_path = encrypt_file(result, args.encrypt_passphrase.strip())
        encrypted = True
    else:
        meta_path = None

    manifest_path = backup_file.with_suffix(backup_file.suffix + ".manifest.json")
    write_manifest(backup_file, manifest_path, source)
    removed = prune_old_backups(out_dir, args.retention_days)

    print(f"Backup created: {backup_file}")
    if meta_path is not None:
        print(f"Encryption metadata: {meta_path}")
    print(f"Manifest: {manifest_path}")
    print(f"Encrypted: {'yes' if encrypted else 'no'}")
    print(f"Pruned old artifacts: {removed}")


if __name__ == "__main__":
    main()

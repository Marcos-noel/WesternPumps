from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def main() -> int:
    # Avoid writing .pyc files (OneDrive + reparse points can cause WinError 5).
    sys.dont_write_bytecode = True
    backend_dir = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend_dir))

    # Convenience for local dev: if DATABASE_URL isn't set and a local SQLite DB
    # exists in the backend folder, use it automatically.
    if not os.environ.get("DATABASE_URL"):
        sqlite_db = backend_dir / "westernpumps.db"
        if sqlite_db.exists():
            os.environ["DATABASE_URL"] = f"sqlite:///{sqlite_db.resolve().as_posix()}"

    parser = argparse.ArgumentParser(description="Reset a user's password in the WesternPumps database.")
    parser.add_argument("--email", help="User email address (case-insensitive).")
    parser.add_argument("--password", help="New password (min 8 chars, max 72 bytes for bcrypt).")
    parser.add_argument(
        "--list",
        action="store_true",
        help="List users (id, email, role, active) and exit. Does not modify anything.",
    )
    args = parser.parse_args()

    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models import User
    from app.security import get_password_hash

    with SessionLocal() as db:
        if args.list:
            users = db.scalars(select(User).order_by(User.id)).all()
            if not users:
                print("No users found.")
                return 0
            for user in users:
                print(f"{user.id}\t{user.email}\t{user.role}\tactive={bool(user.is_active)}")
            return 0

        email = (args.email or "").strip().lower()
        if not email:
            print("ERROR: --email is required (or use --list).", file=sys.stderr)
            return 2
        if not args.password:
            print("ERROR: --password is required (or use --list).", file=sys.stderr)
            return 2

        user = db.scalar(select(User).where(User.email == email))
        if not user:
            print(f"ERROR: No user found with email {email!r}.", file=sys.stderr)
            return 1

        try:
            user.password_hash = get_password_hash(args.password)
        except ValueError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 2

        db.commit()

    print(f"Password updated for {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

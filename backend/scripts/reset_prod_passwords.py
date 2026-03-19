import argparse
import os

from sqlalchemy import create_engine, text

from app.security import get_password_hash


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reset all user passwords for a tenant. Requires DATABASE_URL env var."
    )
    parser.add_argument("--tenant-id", type=int, default=1)
    parser.add_argument("--new-password", required=True)
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL is required (do not hardcode secrets in this repo).")

    hashed = get_password_hash(args.new_password)
    engine = create_engine(db_url)

    with engine.begin() as conn:
        result = conn.execute(
            text("UPDATE users SET password_hash = :pwd WHERE tenant_id = :tenant_id"),
            {"pwd": hashed, "tenant_id": args.tenant_id},
        )
        print(f"Updated {result.rowcount} users for tenant_id={args.tenant_id}")


if __name__ == "__main__":
    main()

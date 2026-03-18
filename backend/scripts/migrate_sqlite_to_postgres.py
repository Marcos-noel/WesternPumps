#!/usr/bin/env python
"""
Migration script to export data from SQLite to PostgreSQL.
This script exports users and other core data from the local SQLite database
to the production PostgreSQL database on Render.
"""
import os
import sys
import sqlite3
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# PostgreSQL connection string from render.yaml
# postgresql://westernpumps:JD10CKR8BvvtVGA7an6zry8IphkCtjm1@dpg-d6spqstm5p6s73b01030-a/westernpumps

POSTGRES_URL = os.environ.get(
    "DATABASE_URL",
"postgresql://marcos_noel23:xwszqrbJEzg3EMfZ3jp3xiknFzJ5Pidi@dpg-d6spqstm5p6s73b01030-a.oregon-postgres.render.com/westernpumps?sslmode=require"
)

SQLITE_DB = "devdata/westernpumps.db"


def get_sqlite_connection():
    """Get connection to SQLite database."""
    return sqlite3.connect(SQLITE_DB)


def get_postgres_connection():
    """Get connection to PostgreSQL database."""
    import psycopg2
    return psycopg2.connect(POSTGRES_URL)


def export_users(sqlite_conn, postgres_conn):
    """Export users from SQLite to PostgreSQL."""
    sqlite_cursor = sqlite_conn.cursor()
    postgres_cursor = postgres_conn.cursor()
    
    # Get all users from SQLite
    sqlite_cursor.execute("""
        SELECT id, email, phone, full_name, role, password_hash, is_active, created_at, updated_at
        FROM users
    """)
    sqlite_users = sqlite_cursor.fetchall()
    
    print(f"Found {len(sqlite_users)} users in SQLite")
    
    # Check existing users in PostgreSQL
    postgres_cursor.execute("SELECT email FROM users")
    existing_emails = {row[0] for row in postgres_cursor.fetchall()}
    print(f"Found {len(existing_emails)} users in PostgreSQL")
    
    # Insert users that don't exist
    imported = 0
    for user in sqlite_users:
        email = user[1]
        if email.lower() in {e.lower() for e in existing_emails}:
            print(f"  Skipping {email} (already exists)")
            continue
        
        postgres_cursor.execute("""
INSERT INTO users (tenant_id, email, phone, full_name, role, password_hash, is_active, created_at, updated_at)
VALUES (1, %s, %s, %s, %s, %s, %s::boolean, %s, %s)
        """, user[1:])
        imported += 1
        print(f"  Imported {email}")
    
    postgres_conn.commit()
    print(f"Imported {imported} users")


def export_all_data(sqlite_db_path: str, postgres_url: str):
    """Export all tables from SQLite to PostgreSQL."""
    
    print("=" * 50)
    print("SQLite to PostgreSQL Migration Script")
    print("=" * 50)
    print(f"Source: {sqlite_db_path}")
    print(f"Target: {postgres_url}")
    print()
    
    sqlite_conn = sqlite3.connect(sqlite_db_path)
    
    try:
        import psycopg2
        postgres_conn = psycopg2.connect(postgres_url)
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        print("\nTo run this script, you need psycopg2:")
        print("  pip install psycopg2-binary")
        return
    
    try:
        # Export users first (most important for login)
        export_users(sqlite_conn, postgres_conn)
        
        print("\n" + "=" * 50)
        print("Migration completed!")
        print("=" * 50)
        
    except Exception as e:
        print(f"Error during migration: {e}")
        postgres_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        postgres_conn.close()


if __name__ == "__main__":
    export_all_data(SQLITE_DB, POSTGRES_URL)

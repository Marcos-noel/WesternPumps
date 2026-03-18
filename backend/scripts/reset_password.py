#!/usr/bin/env python
"""
Reset user password in PostgreSQL database.
Run this script to reset the admin password.
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

POSTGRES_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://westernpumps:JD10CKR8BvvtVGA7an6zry8IphkCtjm1@dpg-d6spqstm5p6s73b01030-a.oregon-postgres.render.com/westernpumps?sslmode=require"
)


def reset_password(email: str, new_password: str):
    """Reset password for a user."""
    import psycopg2
    from app.security import get_password_hash
    
    conn = psycopg2.connect(POSTGRES_URL)
    cursor = conn.cursor()
    
    # Hash the new password
    password_hash = get_password_hash(new_password)
    
    # Update the user's password
    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE email = %s",
        (password_hash, email)
    )
    
    if cursor.rowcount == 0:
        print(f"User {email} not found!")
    else:
        conn.commit()
        print(f"Password reset successfully for {email}")
    
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)
    
    email = sys.argv[1]
    new_password = sys.argv[2]
    
    reset_password(email, new_password)

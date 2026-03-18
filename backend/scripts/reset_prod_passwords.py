import os
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_URL = "postgresql://marcos_noel23:xwszqrbJEzg3EMfZ3jp3xiknFzJ5Pidi@dpg-d6spqstm5p6s73b01030-a.oregon-postgres.render.com/westernpumps?sslmode=require"

NEW_PW = "test123"

hashed = pwd_context.hash(NEW_PW.encode('utf-8').decode('utf-8')[:72])

engine = create_engine(DB_URL)

with engine.begin() as conn:
    result = conn.execute(text("UPDATE users SET password_hash = :pwd WHERE tenant_id = 1"), {"pwd": hashed})
    print(f"Updated {result.rowcount} users")
    print("New password for ALL users: " + NEW_PW)

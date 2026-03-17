from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Optional

import bcrypt
from jose import jwt
import re

from app.config import settings


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    password_bytes = password.encode("utf-8")
    validate_password_policy(password)
    if len(password_bytes) > 72:
        raise ValueError("Password must be at most 72 bytes for bcrypt")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def validate_password_policy(password: str) -> None:
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must include at least one number")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must include at least one symbol")


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=expires_minutes or settings.access_token_expire_minutes)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

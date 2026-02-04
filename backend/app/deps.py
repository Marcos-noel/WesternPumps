from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.security import get_password_hash


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(db: Session = Depends(get_db), token: str | None = Depends(oauth2_scheme)) -> User:
    if settings.disable_auth:
        user = db.scalar(select(User).where(User.is_active.is_(True)).order_by(User.id.asc()))
        if not user:
            user = User(
                email="dev@local",
                full_name="Dev Admin",
                role="admin",
                password_hash=get_password_hash("dev-admin"),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if not subject:
            raise credentials_exception
        user_id = int(subject)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_roles(*roles: str):
    def _dep(current_user: User = Depends(get_current_user)) -> User:
        role = current_user.role
        if role == "staff":
            role = "technician"
        if role == "admin":
            return current_user
        if role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return current_user

    return _dep


def require_approver(current_user: User = Depends(get_current_user)) -> User:
    role = "technician" if current_user.role == "staff" else current_user.role
    if role in {"admin", "manager", "approver"}:
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approver access required")

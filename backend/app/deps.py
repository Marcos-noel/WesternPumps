from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.oidc import OidcAuthError, verify_oidc_token
from app.security import get_password_hash


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> User:
    if settings.disable_auth:
        user = db.scalar(select(User).where(User.email == "dev@example.com", User.is_active.is_(True)).limit(1))
        if not user:
            user = db.scalar(select(User).where(User.role == "admin", User.is_active.is_(True)).order_by(User.id.asc()).limit(1))
        if not user:
            user = db.scalar(select(User).where(User.is_active.is_(True)).order_by(User.id.asc()).limit(1))
        if not user:
            user = User(
                tenant_id=settings.default_tenant_id,
                email="dev@example.com",
                full_name="Dev Admin",
                role="admin",
                password_hash=get_password_hash("DevAdmin#123"),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif user.email in {"dev@local", "dev@local.test"}:
            # Backward-compat: previous dev seed used an invalid email for EmailStr schemas.
            user.email = "dev@example.com"
            db.commit()
            db.refresh(user)
        if user.role != "admin":
            # In auth-disabled dev mode, force admin capabilities to avoid role-gated dead ends.
            user.role = "admin"
            db.commit()
            db.refresh(user)
        db.info["tenant_id"] = int(getattr(user, "tenant_id", settings.default_tenant_id) or settings.default_tenant_id)
        return user

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    if settings.oidc_enabled:
        try:
            oidc_identity = verify_oidc_token(token)
        except OidcAuthError:
            raise credentials_exception

        user: User | None = None
        email = (oidc_identity.email or "").strip().lower()
        if email:
            user = db.scalar(select(User).where(User.email == email).limit(1))

        if user is None and settings.oidc_auto_provision_users and email:
            user = User(
                email=email,
                full_name=oidc_identity.full_name or email.split("@")[0],
                role=oidc_identity.role or "technician",
                password_hash=get_password_hash("oidc-external-account"),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        if not user or not user.is_active:
            raise credentials_exception
        if oidc_identity.full_name and user.full_name != oidc_identity.full_name:
            user.full_name = oidc_identity.full_name
            db.commit()
            db.refresh(user)
        if oidc_identity.role and user.role != oidc_identity.role:
            user.role = oidc_identity.role
            db.commit()
            db.refresh(user)
        header_tenant = request.headers.get("X-Tenant-ID", "").strip()
        effective_tenant_id = int(getattr(user, "tenant_id", settings.default_tenant_id) or settings.default_tenant_id)
        if settings.multi_tenant_enabled and header_tenant:
            try:
                requested_tenant = int(header_tenant)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Tenant-ID header")
            if user.role != "admin" and requested_tenant != effective_tenant_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access denied")
            effective_tenant_id = requested_tenant
        db.info["tenant_id"] = effective_tenant_id
        return user

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
    header_tenant = request.headers.get("X-Tenant-ID", "").strip()
    effective_tenant_id = int(getattr(user, "tenant_id", settings.default_tenant_id) or settings.default_tenant_id)
    if settings.multi_tenant_enabled and header_tenant:
        try:
            requested_tenant = int(header_tenant)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Tenant-ID header")
        if user.role != "admin" and requested_tenant != effective_tenant_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access denied")
        effective_tenant_id = requested_tenant
    db.info["tenant_id"] = effective_tenant_id
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
        if role == "lead_technician":
            # Lead technicians inherit technician capabilities.
            if "technician" in roles:
                return current_user
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

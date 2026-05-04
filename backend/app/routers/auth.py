from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.config import settings
from app.db import get_db
from app.deps import require_roles
from app.models import LoginFailure, PasswordResetToken, User
from app.notifications import send_password_reset_email
from app.oidc import oidc_healthcheck
from app.schemas import Token, UserCreate, UserRead
from app.security import create_access_token, get_password_hash, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class ForgotPasswordPayload(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=10, max_length=72)


class OidcConfigResponse(BaseModel):
    enabled: bool
    issuer: str
    client_id: str
    redirect_uri: str
    scopes: str


class OidcExchangePayload(BaseModel):
    id_token: str | None = None
    access_token: str | None = None


class OidcHealthResponse(BaseModel):
    enabled: bool
    ok: bool
    detail: str
    key_count: int = 0
    issuer: str = ""


def _login_key(email: str) -> str:
    return email.strip().lower()


def _lockout_remaining(email: str, db: Session) -> int | None:
    key = _login_key(email)
    now = datetime.now(UTC)
    record = db.scalar(select(LoginFailure).where(LoginFailure.email == key).limit(1))
    if record is None:
        return None
    failures = int(record.failures or 0)
    locked_until = record.locked_until
    if locked_until and now < locked_until:
        return int((locked_until - now).total_seconds())
    if locked_until and now >= locked_until:
        db.delete(record)
        db.commit()
        return None
    if failures >= MAX_LOGIN_ATTEMPTS:
        locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        record.locked_until = locked_until
        db.commit()
        return int((locked_until - now).total_seconds())
    return None


def _record_failed_login(email: str, db: Session) -> None:
    key = _login_key(email)
    now = datetime.now(UTC)
    record = db.scalar(select(LoginFailure).where(LoginFailure.email == key).limit(1))
    if record is None:
        record = LoginFailure(email=key, failures=0, locked_until=None)
        db.add(record)
        db.flush()
    failures = int(record.failures or 0) + 1
    locked_until = record.locked_until
    if failures >= MAX_LOGIN_ATTEMPTS:
        locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
    record.failures = failures
    record.locked_until = locked_until


def _clear_failed_login(email: str, db: Session) -> None:
    db.execute(delete(LoginFailure).where(LoginFailure.email == _login_key(email)))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    email = form.username.strip().lower()
    lockout_seconds = _lockout_remaining(email, db)
    if lockout_seconds is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Try again in {lockout_seconds} seconds.",
        )
    stmt = select(User).where(User.email == email)
    user = db.scalar(stmt)
    if not user or not verify_password(form.password, user.password_hash):
        _record_failed_login(email, db)
        log_audit(
            db,
            None,
            action="login_failed",
            entity_type="auth",
            detail={"email": email, "reason": "invalid_credentials"},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        _record_failed_login(email, db)
        log_audit(
            db,
            user,
            action="login_failed",
            entity_type="auth",
            detail={"email": email, "reason": "inactive_user"},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    _clear_failed_login(email, db)
    token = create_access_token(subject=str(user.id))
    log_audit(
        db,
        user,
        action="login_success",
        entity_type="auth",
        detail={"email": email},
    )
    db.commit()
    return Token(access_token=token)


@router.post("/bootstrap", response_model=UserRead, include_in_schema=settings.enable_auth_bootstrap)
def bootstrap_admin(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    if not settings.enable_auth_bootstrap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    existing_admin = db.scalar(select(User.id).where(User.role == "admin", User.is_active.is_(True)).limit(1))
    if existing_admin is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bootstrap already completed")

    email = str(payload.email).lower()
    existing_email = db.scalar(select(User.id).where(User.email == email).limit(1))
    if existing_email is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    try:
        password_hash = get_password_hash(payload.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    user = User(
        tenant_id=settings.default_tenant_id,
        email=email,
        full_name=payload.full_name,
        role="admin",
        password_hash=password_hash,
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        must_change_password=bool(user.must_change_password),
        region=user.region,
        area_code=user.area_code,
        zone_count=0,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("/forgot-password", status_code=status.HTTP_200_OK, response_class=Response)
def forgot_password(payload: ForgotPasswordPayload, db: Session = Depends(get_db)) -> None:
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    # Always return 204 to avoid account enumeration.
    if not user:
        return None
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at <= datetime.now(UTC)))
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(minutes=30)
    db.add(PasswordResetToken(token=token, user_id=user.id, expires_at=expires_at))

    reset_link = f"{settings.frontend_base_url.rstrip('/')}/login?reset_token={token}"
    ok, detail = send_password_reset_email(to_email=email, reset_link=reset_link)
    log_audit(
        db,
        user,
        action="forgot_password_requested",
        entity_type="auth",
        detail={"email_sent": ok, "detail": detail},
    )
    db.commit()
    return None


@router.post("/reset-password", status_code=status.HTTP_200_OK, response_class=Response)
def reset_password(payload: ResetPasswordPayload, db: Session = Depends(get_db)) -> None:
    now = datetime.now(UTC)
    record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token == payload.token).limit(1))
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if now >= expires_at:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    try:
        user.password_hash = get_password_hash(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    user.must_change_password = False

    db.delete(record)
    log_audit(db, user, action="password_reset_via_token", entity_type="auth")
    db.commit()
    return None


@router.get("/oidc/config", response_model=OidcConfigResponse)
def oidc_config() -> OidcConfigResponse:
    return OidcConfigResponse(
        enabled=settings.oidc_enabled,
        issuer=settings.oidc_issuer,
        client_id=settings.oidc_client_id,
        redirect_uri=settings.oidc_redirect_uri,
        scopes=settings.oidc_scopes,
    )


@router.post("/oidc/exchange", response_model=Token)
def oidc_exchange_stub(payload: OidcExchangePayload, db: Session = Depends(get_db)) -> Token:
    """
    SSO-ready contract stub.
    Frontend can post OIDC token here once IdP flow is enabled.
    """
    _ = db
    if not settings.oidc_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OIDC is not enabled")
    token_hint = (payload.id_token or payload.access_token or "").strip()
    if not token_hint:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OIDC token")
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OIDC exchange stub is ready; map token to user and issue app token here.",
    )


@router.get("/oidc/health", response_model=OidcHealthResponse, dependencies=[Depends(require_roles("admin", "manager"))])
def oidc_health() -> OidcHealthResponse:
    report = oidc_healthcheck()
    return OidcHealthResponse(
        enabled=bool(report.get("enabled", False)),
        ok=bool(report.get("ok", False)),
        detail=str(report.get("detail", "")),
        key_count=int(report.get("key_count", 0) or 0),
        issuer=str(report.get("issuer", "") or ""),
    )

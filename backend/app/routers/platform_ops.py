from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import OutboxEvent, User
from app.oidc import oidc_healthcheck


router = APIRouter(prefix="/api/platform", tags=["platform"])


class OutboxHealthRead(BaseModel):
    pending: int
    processing: int
    failed: int
    dead: int
    done_last_24h: int


class ComplianceStatusRead(BaseModel):
    generated_at: str
    auth_enabled: bool
    https_enforced: bool
    security_headers_enabled: bool
    oidc_enabled: bool
    oidc_ok: bool
    outbox_dead: int
    outbox_failed: int
    status: str


class SystemAboutRead(BaseModel):
    generated_at: str
    system_name: str
    deployment_mode: str
    auth_mode: str
    database_engine: str
    roles_supported: list[str]
    modules: list[str]
    key_features: list[str]
    integrations: dict[str, bool]
    controls: dict[str, bool]


def _outbox_counts(db: Session) -> OutboxHealthRead:
    pending = int(db.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "PENDING")) or 0)
    processing = int(db.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "PROCESSING")) or 0)
    failed = int(db.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "FAILED")) or 0)
    dead = int(db.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "DEAD")) or 0)
    since = datetime.now(UTC).replace(microsecond=0)
    cutoff = since - timedelta(hours=24)
    done_last_24h = int(
        db.scalar(
            select(func.count())
            .select_from(OutboxEvent)
            .where(OutboxEvent.status == "DONE")
            .where(OutboxEvent.processed_at >= cutoff)
        )
        or 0
    )
    return OutboxHealthRead(
        pending=pending,
        processing=processing,
        failed=failed,
        dead=dead,
        done_last_24h=done_last_24h,
    )


@router.get("/outbox/health", response_model=OutboxHealthRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def outbox_health(db: Session = Depends(get_db)) -> OutboxHealthRead:
    return _outbox_counts(db)


@router.post("/outbox/retry-dead", dependencies=[Depends(require_roles("admin"))])
def retry_dead_letters(
    limit: int = Query(default=100, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    rows = list(
        db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.status == "DEAD")
            .order_by(OutboxEvent.id.asc())
            .limit(limit)
        )
    )
    for row in rows:
        row.status = "FAILED"
        row.available_at = datetime.now(UTC)
        row.last_error = "manual_retry_by_admin"
    db.commit()
    return {"retried": len(rows), "actor_user_id": int(current_user.id)}


@router.get("/compliance/status", response_model=ComplianceStatusRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def compliance_status(db: Session = Depends(get_db)) -> ComplianceStatusRead:
    oidc = oidc_healthcheck()
    outbox = _outbox_counts(db)
    status = "ok"
    if outbox.dead > 0 or outbox.failed > 50 or (settings.oidc_enabled and not bool(oidc.get("ok"))):
        status = "attention"
    return ComplianceStatusRead(
        generated_at=datetime.now(UTC).isoformat(),
        auth_enabled=not settings.disable_auth,
        https_enforced=settings.enforce_https,
        security_headers_enabled=settings.security_headers_enabled,
        oidc_enabled=settings.oidc_enabled,
        oidc_ok=bool(oidc.get("ok", False)),
        outbox_dead=outbox.dead,
        outbox_failed=outbox.failed,
        status=status,
    )


@router.get("/system/about", response_model=SystemAboutRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def system_about(db: Session = Depends(get_db)) -> SystemAboutRead:
    _ = db  # reserved for future dynamic feature probes
    database_engine = "sqlite" if "sqlite" in settings.database_url.lower() else "mysql"
    auth_mode = "dev-bypass" if settings.disable_auth else "jwt"
    modules = [
        "Inventory",
        "Stock Requests & Approvals",
        "Operations Control Center",
        "Suppliers",
        "Customers & Jobs",
        "Rider/Driver Deliveries",
        "Reports",
        "Assistant (role-scoped)",
        "Platform & Compliance",
        "Integrations (Finance/ERP/Accounting)",
    ]
    features = [
        "Role-based access with module-level gating",
        "Purchase orders, receipts, transfers, reservations, cycle counts",
        "Audit logs for critical actions",
        "Outbox health and dead-letter retry",
        "Export reports (Excel/PDF/DOCX/CSV)",
        "Email + webhook integration support",
    ]
    integrations = {
        "finance": True,
        "erp": True,
        "accounting": True,
        "smtp_email": True,
        "twilio_sms": settings.sms_provider.lower() == "twilio",
        "oidc_sso": settings.oidc_enabled,
    }
    controls = {
        "https_enforced": settings.enforce_https,
        "security_headers_enabled": settings.security_headers_enabled,
        "multi_tenant_enabled": settings.multi_tenant_enabled,
        "compliance_mode_hardened": settings.compliance_mode.lower() == "hardened",
    }
    return SystemAboutRead(
        generated_at=datetime.now(UTC).isoformat(),
        system_name="WesternPumps Platform",
        deployment_mode="local" if "localhost" in settings.frontend_base_url else "hosted",
        auth_mode=auth_mode,
        database_engine=database_engine,
        roles_supported=["admin", "manager", "finance", "store_manager", "approver", "lead_technician", "technician", "rider", "driver"],
        modules=modules,
        key_features=features,
        integrations=integrations,
        controls=controls,
    )

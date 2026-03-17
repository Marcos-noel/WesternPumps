from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime
from urllib import request as urlrequest

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import AppSetting, User


router = APIRouter(prefix="/api/integrations", tags=["integrations"])

KEY_BASE = "integration_finance_api_base"
KEY_WEBHOOK = "integration_finance_webhook"
KEY_SECRET = "integration_finance_webhook_secret"
KEY_ENABLED = "integration_finance_enabled"
KEY_ERP_BASE = "integration_erp_api_base"
KEY_ERP_WEBHOOK = "integration_erp_webhook"
KEY_ERP_SECRET = "integration_erp_webhook_secret"
KEY_ERP_ENABLED = "integration_erp_enabled"
KEY_ACCOUNTING_BASE = "integration_accounting_api_base"
KEY_ACCOUNTING_WEBHOOK = "integration_accounting_webhook"
KEY_ACCOUNTING_SECRET = "integration_accounting_webhook_secret"
KEY_ACCOUNTING_ENABLED = "integration_accounting_enabled"


class FinanceIntegrationRead(BaseModel):
    api_base: str = ""
    webhook_url: str = ""
    enabled: bool = False


class FinanceIntegrationUpdate(BaseModel):
    api_base: str = ""
    webhook_url: str = ""
    webhook_secret: str = ""
    enabled: bool = False


class ExternalIntegrationRead(BaseModel):
    api_base: str = ""
    webhook_url: str = ""
    enabled: bool = False


class ExternalIntegrationUpdate(BaseModel):
    api_base: str = ""
    webhook_url: str = ""
    webhook_secret: str = ""
    enabled: bool = False


class IntegrationTestResult(BaseModel):
    ok: bool
    detail: str


def _get_setting(db: Session, key: str) -> str:
    row = db.scalar(select(AppSetting).where(AppSetting.key == key).limit(1))
    return (row.value if row else "") or ""


def _upsert(db: Session, key: str, value: str, user_id: int) -> None:
    row = db.scalar(select(AppSetting).where(AppSetting.key == key).limit(1))
    if row is None:
        row = AppSetting(key=key, value=value, updated_by_user_id=user_id)
        db.add(row)
    else:
        row.value = value
        row.updated_by_user_id = user_id


@router.get("/finance", response_model=FinanceIntegrationRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def get_finance_integration(db: Session = Depends(get_db)) -> FinanceIntegrationRead:
    return FinanceIntegrationRead(
        api_base=_get_setting(db, KEY_BASE).strip(),
        webhook_url=_get_setting(db, KEY_WEBHOOK).strip(),
        enabled=_get_setting(db, KEY_ENABLED).strip().lower() in {"1", "true", "yes", "on"},
    )


@router.put("/finance", response_model=FinanceIntegrationRead, dependencies=[Depends(require_roles("admin", "manager"))])
def update_finance_integration(
    payload: FinanceIntegrationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FinanceIntegrationRead:
    _upsert(db, KEY_BASE, payload.api_base.strip(), current_user.id)
    _upsert(db, KEY_WEBHOOK, payload.webhook_url.strip(), current_user.id)
    _upsert(db, KEY_SECRET, payload.webhook_secret.strip(), current_user.id)
    _upsert(db, KEY_ENABLED, "true" if payload.enabled else "false", current_user.id)
    log_audit(db, current_user, action="update", entity_type="integration_finance")
    db.commit()
    return FinanceIntegrationRead(
        api_base=payload.api_base.strip(),
        webhook_url=payload.webhook_url.strip(),
        enabled=payload.enabled,
    )


@router.post("/finance/test", response_model=IntegrationTestResult, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def test_finance_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationTestResult:
    webhook_url = _get_setting(db, KEY_WEBHOOK).strip()
    secret = _get_setting(db, KEY_SECRET).strip()
    if not webhook_url:
        return IntegrationTestResult(ok=False, detail="webhook_url_not_set")

    payload = {
        "event_type": "integration.test",
        "at": datetime.now(UTC).isoformat(),
        "actor_user_id": current_user.id,
        "message": "WesternPumps finance integration test event",
    }
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest() if secret else ""
    req = urlrequest.Request(webhook_url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if signature:
        req.add_header("X-WesternPumps-Signature", signature)
    try:
        with urlrequest.urlopen(req, timeout=20) as _:
            pass
    except Exception as exc:
        return IntegrationTestResult(ok=False, detail=f"webhook_error:{exc}")

    return IntegrationTestResult(ok=True, detail="webhook_sent")


def _test_external(db: Session, current_user: User, webhook_key: str, secret_key: str, message: str) -> IntegrationTestResult:
    webhook_url = _get_setting(db, webhook_key).strip()
    secret = _get_setting(db, secret_key).strip()
    if not webhook_url:
        return IntegrationTestResult(ok=False, detail="webhook_url_not_set")
    payload = {
        "event_type": "integration.test",
        "at": datetime.now(UTC).isoformat(),
        "actor_user_id": current_user.id,
        "message": message,
    }
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest() if secret else ""
    req = urlrequest.Request(webhook_url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if signature:
        req.add_header("X-WesternPumps-Signature", signature)
    try:
        with urlrequest.urlopen(req, timeout=20) as _:
            pass
    except Exception as exc:
        return IntegrationTestResult(ok=False, detail=f"webhook_error:{exc}")
    return IntegrationTestResult(ok=True, detail="webhook_sent")


@router.post("/erp/test", response_model=IntegrationTestResult, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def test_erp_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationTestResult:
    return _test_external(db, current_user, KEY_ERP_WEBHOOK, KEY_ERP_SECRET, "WesternPumps ERP integration test event")


@router.post("/accounting/test", response_model=IntegrationTestResult, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def test_accounting_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationTestResult:
    return _test_external(
        db,
        current_user,
        KEY_ACCOUNTING_WEBHOOK,
        KEY_ACCOUNTING_SECRET,
        "WesternPumps accounting integration test event",
    )


def _read_external(db: Session, base_key: str, webhook_key: str, enabled_key: str) -> ExternalIntegrationRead:
    return ExternalIntegrationRead(
        api_base=_get_setting(db, base_key).strip(),
        webhook_url=_get_setting(db, webhook_key).strip(),
        enabled=_get_setting(db, enabled_key).strip().lower() in {"1", "true", "yes", "on"},
    )


def _update_external(
    db: Session,
    *,
    payload: ExternalIntegrationUpdate,
    current_user: User,
    base_key: str,
    webhook_key: str,
    secret_key: str,
    enabled_key: str,
    audit_entity: str,
) -> ExternalIntegrationRead:
    _upsert(db, base_key, payload.api_base.strip(), current_user.id)
    _upsert(db, webhook_key, payload.webhook_url.strip(), current_user.id)
    _upsert(db, secret_key, payload.webhook_secret.strip(), current_user.id)
    _upsert(db, enabled_key, "true" if payload.enabled else "false", current_user.id)
    log_audit(db, current_user, action="update", entity_type=audit_entity)
    db.commit()
    return ExternalIntegrationRead(
        api_base=payload.api_base.strip(),
        webhook_url=payload.webhook_url.strip(),
        enabled=payload.enabled,
    )


@router.get("/erp", response_model=ExternalIntegrationRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def get_erp_integration(db: Session = Depends(get_db)) -> ExternalIntegrationRead:
    return _read_external(db, KEY_ERP_BASE, KEY_ERP_WEBHOOK, KEY_ERP_ENABLED)


@router.put("/erp", response_model=ExternalIntegrationRead, dependencies=[Depends(require_roles("admin", "manager"))])
def update_erp_integration(
    payload: ExternalIntegrationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExternalIntegrationRead:
    return _update_external(
        db,
        payload=payload,
        current_user=current_user,
        base_key=KEY_ERP_BASE,
        webhook_key=KEY_ERP_WEBHOOK,
        secret_key=KEY_ERP_SECRET,
        enabled_key=KEY_ERP_ENABLED,
        audit_entity="integration_erp",
    )


@router.get("/accounting", response_model=ExternalIntegrationRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def get_accounting_integration(db: Session = Depends(get_db)) -> ExternalIntegrationRead:
    return _read_external(db, KEY_ACCOUNTING_BASE, KEY_ACCOUNTING_WEBHOOK, KEY_ACCOUNTING_ENABLED)


@router.put("/accounting", response_model=ExternalIntegrationRead, dependencies=[Depends(require_roles("admin", "manager"))])
def update_accounting_integration(
    payload: ExternalIntegrationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExternalIntegrationRead:
    return _update_external(
        db,
        payload=payload,
        current_user=current_user,
        base_key=KEY_ACCOUNTING_BASE,
        webhook_key=KEY_ACCOUNTING_WEBHOOK,
        secret_key=KEY_ACCOUNTING_SECRET,
        enabled_key=KEY_ACCOUNTING_ENABLED,
        audit_entity="integration_accounting",
    )

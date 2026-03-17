from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.db import get_db
from app.deps import get_current_user, require_roles
from app.models import User
from app.notifications import send_smtp_test_email
from app.schemas import (
    AppSettingsRead,
    AppSettingsTestEmailRequest,
    AppSettingsTestEmailResponse,
    AppSettingsUpdate,
    BrandingSettingsRead,
)
from app.system_settings import (
    SETTING_APPROVAL_THRESHOLD_ADMIN,
    SETTING_APPROVAL_INDIVIDUAL_ROLE,
    SETTING_APPROVAL_THRESHOLD_MANAGER,
    SETTING_BRANDING_LOGO_URL,
    SETTING_FAULTY_QUARANTINE_LOCATION_ID,
    SETTING_LOW_STOCK_DEFAULT_LIMIT,
    SETTING_NOTIFICATION_EMAIL_ENABLED,
    SETTING_NOTIFICATION_RECIPIENTS,
    SETTING_NOTIFICATION_SMS_ENABLED,
    SETTING_SMTP_FROM_EMAIL,
    SETTING_SMTP_HOST,
    SETTING_SMTP_PASSWORD,
    SETTING_SMTP_PORT,
    SETTING_SMTP_USERNAME,
    SETTING_SMTP_USE_TLS,
    get_effective_settings,
    upsert_setting,
)


router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


@router.get("/branding", response_model=BrandingSettingsRead)
def get_branding_settings(
    db: Session = Depends(get_db),
) -> BrandingSettingsRead:
    effective = get_effective_settings(db)
    return BrandingSettingsRead(branding_logo_url=effective.branding_logo_url)


@router.get("", response_model=AppSettingsRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def get_app_settings(
    db: Session = Depends(get_db),
) -> AppSettingsRead:
    effective = get_effective_settings(db)
    return AppSettingsRead(
        approval_threshold_manager=effective.approval_threshold_manager,
        approval_threshold_admin=effective.approval_threshold_admin,
        approval_individual_role=effective.approval_individual_role,
        low_stock_default_limit=effective.low_stock_default_limit,
        notification_email_enabled=effective.notification_email_enabled,
        notification_sms_enabled=effective.notification_sms_enabled,
        notification_recipients=effective.notification_recipients,
        faulty_quarantine_location_id=effective.faulty_quarantine_location_id,
        branding_logo_url=effective.branding_logo_url,
        smtp_host=effective.smtp_host,
        smtp_port=effective.smtp_port,
        smtp_username=effective.smtp_username,
        smtp_password=effective.smtp_password,
        smtp_from_email=effective.smtp_from_email,
        smtp_use_tls=effective.smtp_use_tls,
    )


@router.put("", response_model=AppSettingsRead, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def update_app_settings(
    payload: AppSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppSettingsRead:
    changes = payload.model_dump(exclude_unset=True)
    actor_role = (current_user.role or "").strip().lower()
    threshold_keys = {"approval_threshold_manager", "approval_threshold_admin", "approval_individual_role"}
    if actor_role == "admin" and any(key in changes for key in threshold_keys):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approval thresholds are managed by manager/finance roles.",
        )

    if "approval_threshold_manager" in changes:
        upsert_setting(
            db,
            key=SETTING_APPROVAL_THRESHOLD_MANAGER,
            value=str(changes["approval_threshold_manager"]),
            updated_by_user_id=current_user.id,
        )
    if "approval_threshold_admin" in changes:
        upsert_setting(
            db,
            key=SETTING_APPROVAL_THRESHOLD_ADMIN,
            value=str(changes["approval_threshold_admin"]),
            updated_by_user_id=current_user.id,
        )
    if "approval_individual_role" in changes:
        upsert_setting(
            db,
            key=SETTING_APPROVAL_INDIVIDUAL_ROLE,
            value=str(changes["approval_individual_role"]).strip().lower(),
            updated_by_user_id=current_user.id,
        )
    if "low_stock_default_limit" in changes:
        upsert_setting(
            db,
            key=SETTING_LOW_STOCK_DEFAULT_LIMIT,
            value=str(changes["low_stock_default_limit"]),
            updated_by_user_id=current_user.id,
        )
    if "notification_email_enabled" in changes:
        upsert_setting(
            db,
            key=SETTING_NOTIFICATION_EMAIL_ENABLED,
            value="true" if changes["notification_email_enabled"] else "false",
            updated_by_user_id=current_user.id,
        )
    if "notification_sms_enabled" in changes:
        upsert_setting(
            db,
            key=SETTING_NOTIFICATION_SMS_ENABLED,
            value="true" if changes["notification_sms_enabled"] else "false",
            updated_by_user_id=current_user.id,
        )
    if "notification_recipients" in changes:
        upsert_setting(
            db,
            key=SETTING_NOTIFICATION_RECIPIENTS,
            value=changes["notification_recipients"] or "",
            updated_by_user_id=current_user.id,
        )
    if "faulty_quarantine_location_id" in changes:
        upsert_setting(
            db,
            key=SETTING_FAULTY_QUARANTINE_LOCATION_ID,
            value=str(changes["faulty_quarantine_location_id"]) if changes["faulty_quarantine_location_id"] else "",
            updated_by_user_id=current_user.id,
        )
    if "branding_logo_url" in changes:
        upsert_setting(
            db,
            key=SETTING_BRANDING_LOGO_URL,
            value=(changes["branding_logo_url"] or "").strip(),
            updated_by_user_id=current_user.id,
        )
    if "smtp_host" in changes:
        upsert_setting(
            db,
            key=SETTING_SMTP_HOST,
            value=(changes["smtp_host"] or "").strip(),
            updated_by_user_id=current_user.id,
        )
    if "smtp_port" in changes:
        upsert_setting(
            db,
            key=SETTING_SMTP_PORT,
            value=str(changes["smtp_port"] or ""),
            updated_by_user_id=current_user.id,
        )
    if "smtp_username" in changes:
        upsert_setting(
            db,
            key=SETTING_SMTP_USERNAME,
            value=(changes["smtp_username"] or "").strip(),
            updated_by_user_id=current_user.id,
        )
    if "smtp_password" in changes:
        upsert_setting(
            db,
            key=SETTING_SMTP_PASSWORD,
            value=(changes["smtp_password"] or "").strip(),
            updated_by_user_id=current_user.id,
        )
    if "smtp_from_email" in changes:
        upsert_setting(
            db,
            key=SETTING_SMTP_FROM_EMAIL,
            value=(changes["smtp_from_email"] or "").strip(),
            updated_by_user_id=current_user.id,
        )
    if "smtp_use_tls" in changes:
        upsert_setting(
            db,
            key=SETTING_SMTP_USE_TLS,
            value="true" if changes["smtp_use_tls"] else "false",
            updated_by_user_id=current_user.id,
        )

    log_audit(
        db,
        current_user,
        action="update",
        entity_type="app_settings",
        detail=changes,
    )
    db.commit()

    effective = get_effective_settings(db)
    return AppSettingsRead(
        approval_threshold_manager=effective.approval_threshold_manager,
        approval_threshold_admin=effective.approval_threshold_admin,
        approval_individual_role=effective.approval_individual_role,
        low_stock_default_limit=effective.low_stock_default_limit,
        notification_email_enabled=effective.notification_email_enabled,
        notification_sms_enabled=effective.notification_sms_enabled,
        notification_recipients=effective.notification_recipients,
        faulty_quarantine_location_id=effective.faulty_quarantine_location_id,
        branding_logo_url=effective.branding_logo_url,
        smtp_host=effective.smtp_host,
        smtp_port=effective.smtp_port,
        smtp_username=effective.smtp_username,
        smtp_password=effective.smtp_password,
        smtp_from_email=effective.smtp_from_email,
        smtp_use_tls=effective.smtp_use_tls,
    )


@router.post("/test-email", response_model=AppSettingsTestEmailResponse, dependencies=[Depends(require_roles("admin", "manager", "finance"))])
def test_email_settings(
    payload: AppSettingsTestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppSettingsTestEmailResponse:
    effective = get_effective_settings(db)
    recipient = (str(payload.recipient).strip().lower() if payload.recipient else (current_user.email or "").strip().lower())
    if not recipient:
        return AppSettingsTestEmailResponse(ok=False, detail="missing_recipient", recipient="")

    ok, detail = send_smtp_test_email(
        to_email=recipient,
        smtp_host=effective.smtp_host,
        smtp_port=effective.smtp_port,
        smtp_from_email=effective.smtp_from_email,
        smtp_use_tls=effective.smtp_use_tls,
        smtp_username=effective.smtp_username,
        smtp_password=effective.smtp_password,
        actor_email=current_user.email,
    )
    log_audit(
        db,
        current_user,
        action="test_email",
        entity_type="app_settings",
        detail={"recipient": recipient, "ok": ok, "detail": detail},
    )
    db.commit()
    return AppSettingsTestEmailResponse(ok=ok, detail=detail, recipient=recipient)

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.config import settings
from app.models import AppSetting, User
from app.system_settings import get_effective_settings


def _split_recipients(raw: str) -> tuple[list[str], list[str]]:
    entries = [part.strip() for part in raw.replace(";", ",").split(",")]
    emails: list[str] = []
    phones: list[str] = []
    for value in entries:
        if not value:
            continue
        if "@" in value:
            emails.append(value)
        else:
            phones.append(value)
    return emails, phones


EVENT_ROLE_RECIPIENTS: dict[str, set[str]] = {
    "request_created": {"admin", "manager", "approver", "store_manager"},
    "request_approved": {"admin", "manager", "store_manager"},
    "request_rejected": {"admin", "manager", "store_manager"},
    "job_assigned": {"admin", "manager", "store_manager", "lead_technician"},
    "job_reassigned": {"admin", "manager", "store_manager", "lead_technician"},
    "job_completed": {"admin", "manager", "store_manager", "lead_technician"},
    "request_issued": {"admin", "manager", "store_manager", "lead_technician"},
    "return_submitted": {"admin", "manager", "approver", "store_manager"},
    "return_approved": {"admin", "manager", "store_manager", "lead_technician"},
    "return_rejected": {"admin", "manager", "store_manager", "lead_technician"},
    "usage_confirmed": {"admin", "manager", "store_manager", "lead_technician", "approver"},
    "faulty_return": {"admin", "manager", "approver", "store_manager"},
    "low_stock_alert": {"admin", "manager", "approver", "store_manager"},
    "delivery_request_created": {"admin", "manager", "store_manager", "rider", "driver"},
    "delivery_request_approved": {"admin", "manager", "store_manager", "rider", "driver"},
    "delivery_request_delivered": {"admin", "manager", "store_manager", "technician", "lead_technician", "rider", "driver"},
}


def _event_user_recipients(db: Session, event: str) -> tuple[list[str], list[str]]:
    roles = EVENT_ROLE_RECIPIENTS.get(event)
    if not roles:
        return [], []
    rows = db.scalars(
        select(User).where(User.is_active.is_(True)).where(User.role.in_(list(roles)))
    ).all()
    emails: list[str] = []
    phones: list[str] = []
    for row in rows:
        if row.email:
            emails.append(row.email.strip())
        if row.phone:
            phones.append(row.phone.strip())
    return emails, phones


def _send_email(
    *,
    recipients: list[str],
    subject: str,
    body: str,
    smtp_host: str | None,
    smtp_port: int,
    smtp_from_email: str | None,
    smtp_use_tls: bool,
    smtp_username: str | None,
    smtp_password: str | None,
) -> tuple[bool, str]:
    if not recipients:
        return False, "no_email_recipients"
    if not smtp_host or not smtp_from_email:
        return False, "missing_smtp_config"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from_email
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
            if smtp_use_tls:
                smtp.starttls()
            if smtp_username and smtp_password:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
        return True, "email_sent"
    except Exception as exc:  # pragma: no cover
        return False, f"email_error:{exc}"


def _send_sms_twilio(*, recipients: list[str], body: str) -> tuple[bool, str]:
    if not recipients:
        return False, "no_sms_recipients"
    if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_from_number:
        return False, "missing_twilio_config"

    auth = base64.b64encode(f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode("utf-8")).decode("ascii")
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    try:
        for number in recipients:
            payload = urlencode({"To": number, "From": settings.twilio_from_number, "Body": body}).encode("utf-8")
            req = Request(endpoint, data=payload, method="POST")
            req.add_header("Authorization", f"Basic {auth}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urlopen(req, timeout=20) as _:
                pass
        return True, "sms_sent"
    except Exception as exc:  # pragma: no cover
        return False, f"sms_error:{exc}"


def _send_whatsapp_twilio(*, recipients: list[str], body: str) -> tuple[bool, str]:
    """Send WhatsApp message via Twilio WhatsApp API."""
    if not recipients:
        return False, "no_whatsapp_recipients"
    if not settings.whatsapp_enabled:
        return False, "whatsapp_disabled"
    if not settings.whatsapp_account_sid or not settings.whatsapp_auth_token or not settings.whatsapp_from_number:
        return False, "missing_whatsapp_config"

    auth = base64.b64encode(f"{settings.whatsapp_account_sid}:{settings.whatsapp_auth_token}".encode("utf-8")).decode("ascii")
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{settings.whatsapp_account_sid}/Messages.json"
    try:
        for number in recipients:
            # WhatsApp numbers must be in format: whatsapp:+1234567890
            clean_number = number.strip().replace("+", "").replace(" ", "").replace("-", "")
            whatsapp_to = f"whatsapp:+{clean_number}"
            payload = urlencode({"To": whatsapp_to, "From": settings.whatsapp_from_number, "Body": body}).encode("utf-8")
            req = Request(endpoint, data=payload, method="POST")
            req.add_header("Authorization", f"Basic {auth}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urlopen(req, timeout=20) as _:
                pass
        return True, "whatsapp_sent"
    except Exception as exc:  # pragma: no cover
        return False, f"whatsapp_error:{exc}"


def _get_app_setting(db: Session, key: str) -> str:
    row = db.scalar(select(AppSetting).where(AppSetting.key == key).limit(1))
    return (row.value if row else "") or ""


def _send_webhook(*, url: str, secret: str, payload: dict[str, object]) -> tuple[bool, str]:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    req = Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if secret:
        signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        req.add_header("X-WesternPumps-Signature", signature)
    try:
        with urlopen(req, timeout=20) as _:
            pass
        return True, "webhook_sent"
    except Exception as exc:  # pragma: no cover
        return False, f"webhook_error:{exc}"


def send_password_reset_email(*, to_email: str, reset_link: str) -> tuple[bool, str]:
    return _send_email(
        recipients=[to_email],
        subject="WesternPumps Password Reset",
        body=(
            "A password reset was requested for your account.\n\n"
            f"Open this link to reset your password:\n{reset_link}\n\n"
            "If you did not request this, you can ignore this message."
        ),
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_from_email=settings.smtp_from_email,
        smtp_use_tls=settings.smtp_use_tls,
        smtp_username=settings.smtp_username,
        smtp_password=settings.smtp_password,
    )


def send_smtp_test_email(
    *,
    to_email: str,
    smtp_host: str | None,
    smtp_port: int,
    smtp_from_email: str | None,
    smtp_use_tls: bool,
    smtp_username: str | None,
    smtp_password: str | None,
    actor_email: str | None = None,
) -> tuple[bool, str]:
    actor_label = (actor_email or "admin user").strip() if actor_email else "admin user"
    return _send_email(
        recipients=[to_email],
        subject="WesternPumps SMTP Test",
        body=(
            "This is a test email from WesternPumps.\n\n"
            f"Triggered by: {actor_label}\n"
            "If you received this, SMTP settings are working."
        ),
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_from_email=smtp_from_email,
        smtp_use_tls=smtp_use_tls,
        smtp_username=smtp_username,
        smtp_password=smtp_password,
    )


def send_direct_email(
    db: Session,
    *,
    recipients: list[str],
    subject: str,
    body: str,
) -> tuple[bool, str]:
    effective = get_effective_settings(db)
    return _send_email(
        recipients=recipients,
        subject=subject,
        body=body,
        smtp_host=effective.smtp_host,
        smtp_port=effective.smtp_port,
        smtp_from_email=effective.smtp_from_email,
        smtp_use_tls=effective.smtp_use_tls,
        smtp_username=effective.smtp_username,
        smtp_password=effective.smtp_password,
    )


def dispatch_alert(
    db: Session,
    *,
    actor: User | None,
    event: str,
    subject: str,
    body: str,
    extra_recipients: list[str] | None = None,
) -> None:
    effective = get_effective_settings(db)
    configured_emails, configured_phones = _split_recipients(effective.notification_recipients or "")
    hierarchy_emails, hierarchy_phones = _event_user_recipients(db, event)

    all_emails = [*configured_emails, *hierarchy_emails]
    all_phones = [*configured_phones, *hierarchy_phones]
    if extra_recipients:
        extra_emails, extra_phones = _split_recipients(",".join(extra_recipients))
        all_emails.extend(extra_emails)
        all_phones.extend(extra_phones)

    # Deduplicate while preserving order.
    all_emails = list(dict.fromkeys(all_emails))
    all_phones = list(dict.fromkeys(all_phones))

    channels: list[dict[str, str | bool]] = []

    if effective.notification_email_enabled:
        ok, detail = _send_email(
            recipients=all_emails,
            subject=subject,
            body=body,
            smtp_host=effective.smtp_host,
            smtp_port=effective.smtp_port,
            smtp_from_email=effective.smtp_from_email,
            smtp_use_tls=effective.smtp_use_tls,
            smtp_username=effective.smtp_username,
            smtp_password=effective.smtp_password,
        )
        channels.append({"channel": "email", "ok": ok, "detail": detail})
    else:
        channels.append({"channel": "email", "ok": False, "detail": "email_disabled"})

    if effective.notification_sms_enabled:
        if settings.sms_provider.lower() == "twilio":
            ok, detail = _send_sms_twilio(recipients=all_phones, body=body)
            channels.append({"channel": "sms", "ok": ok, "detail": detail})
        else:
            channels.append({"channel": "sms", "ok": False, "detail": "unsupported_sms_provider"})
    else:
        channels.append({"channel": "sms", "ok": False, "detail": "sms_disabled"})

    # WhatsApp notification (via Twilio)
    if settings.whatsapp_enabled:
        ok, detail = _send_whatsapp_twilio(recipients=all_phones, body=body)
        channels.append({"channel": "whatsapp", "ok": ok, "detail": detail})
    else:
        channels.append({"channel": "whatsapp", "ok": False, "detail": "whatsapp_disabled"})

    integration_targets = [
        ("finance_webhook", "integration_finance_enabled", "integration_finance_webhook", "integration_finance_webhook_secret"),
        ("erp_webhook", "integration_erp_enabled", "integration_erp_webhook", "integration_erp_webhook_secret"),
        ("accounting_webhook", "integration_accounting_enabled", "integration_accounting_webhook", "integration_accounting_webhook_secret"),
    ]
    for channel_name, key_enabled, key_url, key_secret in integration_targets:
        integration_enabled = _get_app_setting(db, key_enabled).strip().lower() in {"1", "true", "yes", "on"}
        webhook_url = _get_app_setting(db, key_url).strip()
        webhook_secret = _get_app_setting(db, key_secret).strip()
        if integration_enabled and webhook_url:
            ok, detail = _send_webhook(
                url=webhook_url,
                secret=webhook_secret,
                payload={
                    "event": event,
                    "subject": subject,
                    "body": body,
                    "actor_user_id": actor.id if actor else None,
                },
            )
            channels.append({"channel": channel_name, "ok": ok, "detail": detail})
        else:
            channels.append({"channel": channel_name, "ok": False, "detail": "integration_disabled_or_missing_url"})

    log_audit(
        db,
        actor,
        action="dispatch_alert",
        entity_type="notification",
        detail={"event": event, "subject": subject, "channels": channels},
    )
    try:
        db.commit()
    except Exception:  # pragma: no cover
        db.rollback()

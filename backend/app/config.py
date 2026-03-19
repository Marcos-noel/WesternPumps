from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parents[2] / ".env",
            Path(__file__).resolve().parents[1] / ".env",
        ),
        env_ignore_empty=True,
        extra="ignore",
    )

    database_url: str = "postgresql://westernpumps:westernpumps@localhost:5432/westernpumps"
    jwt_secret: str = "MUST-BE-SET-VIA-ENV"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    auto_create_tables: bool = True
    disable_auth: bool = False
    enable_auth_bootstrap: bool = False
    approval_threshold_manager: float = 5000
    approval_threshold_admin: float = 20000
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True
    sms_provider: str = "twilio"
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None
    # WhatsApp Configuration (via Twilio)
    whatsapp_enabled: bool = False
    whatsapp_account_sid: str | None = None
    whatsapp_auth_token: str | None = None
    whatsapp_from_number: str | None = None
    seed_admin_email: str | None = None
    seed_admin_password: str | None = None
    seed_admin_full_name: str | None = None
    developer_email: str | None = None
    developer_purge_token: str | None = None
    security_headers_enabled: bool = True
    content_security_policy: str = "default-src 'self'; img-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:"
    permissions_policy: str = "geolocation=(self), camera=(self), microphone=()"
    frontend_base_url: str = "http://localhost:5173"
    enforce_https: bool = False
    request_id_header: str = "X-Request-ID"
    multi_tenant_enabled: bool = False
    default_tenant_id: int = 1
    compliance_mode: str = "standard"
    oidc_enabled: bool = False
    oidc_issuer: str = ""
    oidc_audience: str = ""
    oidc_jwks_url: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_redirect_uri: str = ""
    oidc_scopes: str = "openid profile email"
    oidc_claim_email: str = "email"
    oidc_claim_name: str = "name"
    oidc_claim_roles: str = "roles"
    oidc_auto_provision_users: bool = False
    oidc_role_mapping_json: str = "{}"
    outbox_worker_poll_interval_seconds: int = 3
    outbox_worker_batch_size: int = 30
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"


settings = Settings()

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen

from jose import JWTError, jwt

from app.config import settings

_JWKS_CACHE: dict[str, Any] = {"ts": 0.0, "jwks": None}
_JWKS_CACHE_TTL_SECONDS = 300


class OidcAuthError(Exception):
    pass


@dataclass
class OidcIdentity:
    external_subject: str
    email: str | None
    full_name: str | None
    role: str | None
    claims: dict[str, Any]


def _http_get_json(url: str, timeout_seconds: int = 5) -> dict[str, Any]:
    req = Request(url, headers={"Accept": "application/json"})
    with urlopen(req, timeout=timeout_seconds) as resp:
        raw = resp.read()
    return json.loads(raw.decode("utf-8"))


def _discover_jwks_url() -> str:
    explicit = (settings.oidc_jwks_url or "").strip()
    if explicit:
        return explicit
    issuer = (settings.oidc_issuer or "").strip().rstrip("/")
    if not issuer:
        raise OidcAuthError("OIDC issuer is not configured")
    cfg = _http_get_json(f"{issuer}/.well-known/openid-configuration")
    jwks_uri = str(cfg.get("jwks_uri") or "").strip()
    if not jwks_uri:
        raise OidcAuthError("OIDC discovery did not return jwks_uri")
    return jwks_uri


def _get_jwks() -> dict[str, Any]:
    now = time.time()
    cached = _JWKS_CACHE.get("jwks")
    ts = float(_JWKS_CACHE.get("ts") or 0.0)
    if cached and (now - ts) < _JWKS_CACHE_TTL_SECONDS:
        return cached
    jwks_url = _discover_jwks_url()
    fresh = _http_get_json(jwks_url)
    _JWKS_CACHE["jwks"] = fresh
    _JWKS_CACHE["ts"] = now
    return fresh


def _extract_claim_string(claims: dict[str, Any], claim_path: str) -> str | None:
    if not claim_path:
        return None
    parts = [p for p in claim_path.split(".") if p]
    current: Any = claims
    for part in parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    if current is None:
        return None
    if isinstance(current, str):
        return current
    return str(current)


def _extract_role(claims: dict[str, Any]) -> str | None:
    raw = _extract_claim_string(claims, settings.oidc_claim_roles)
    if not raw:
        value = claims.get(settings.oidc_claim_roles)
        if isinstance(value, list) and value:
            raw = str(value[0])
    if not raw:
        return None
    role_mapping: dict[str, str] = {}
    try:
        parsed = json.loads(settings.oidc_role_mapping_json or "{}")
        if isinstance(parsed, dict):
            role_mapping = {str(k): str(v) for k, v in parsed.items()}
    except Exception:
        role_mapping = {}
    return role_mapping.get(raw, raw)


def verify_oidc_token(token: str) -> OidcIdentity:
    try:
        header = jwt.get_unverified_header(token)
        kid = str(header.get("kid") or "")
        if not kid:
            raise OidcAuthError("Missing kid in token header")
        jwks = _get_jwks()
        keys = jwks.get("keys") or []
        key = next((k for k in keys if str(k.get("kid") or "") == kid), None)
        if key is None:
            raise OidcAuthError("No matching JWK found for token kid")
        audience = (settings.oidc_audience or "").strip() or None
        issuer = (settings.oidc_issuer or "").strip() or None
        options = {"verify_aud": bool(audience)}
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
            audience=audience,
            issuer=issuer,
            options=options,
        )
    except JWTError as exc:
        raise OidcAuthError(f"OIDC token verification failed: {exc}") from exc
    except OidcAuthError:
        raise
    except Exception as exc:
        raise OidcAuthError(f"OIDC verification error: {exc}") from exc

    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise OidcAuthError("OIDC token missing subject")

    email = _extract_claim_string(claims, settings.oidc_claim_email)
    full_name = _extract_claim_string(claims, settings.oidc_claim_name)
    role = _extract_role(claims)
    return OidcIdentity(
        external_subject=subject,
        email=email,
        full_name=full_name,
        role=role,
        claims=claims,
    )


def oidc_healthcheck() -> dict[str, Any]:
    issuer = (settings.oidc_issuer or "").strip()
    if not settings.oidc_enabled:
        return {"enabled": False, "ok": False, "detail": "oidc_disabled"}
    if not issuer and not (settings.oidc_jwks_url or "").strip():
        return {"enabled": True, "ok": False, "detail": "issuer_or_jwks_missing"}
    try:
        jwks = _get_jwks()
        keys = jwks.get("keys") or []
        return {
            "enabled": True,
            "ok": bool(keys),
            "detail": "jwks_loaded" if keys else "jwks_empty",
            "key_count": len(keys),
            "issuer": issuer,
        }
    except Exception as exc:
        return {"enabled": True, "ok": False, "detail": f"jwks_error:{exc}", "issuer": issuer}

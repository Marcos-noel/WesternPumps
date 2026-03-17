# Production Deployment (Private Access)

This runbook deploys WesternPumps so staff can access it from any Wi-Fi/mobile data network while keeping it off the public internet.

## 1. Target architecture

- App host runs:
  - Frontend on internal port `5173`
  - Backend on internal port `8000`
  - Reverse proxy (Nginx/Caddy) on internal port `8443`
- Database is private (MySQL `3306`) and never internet-exposed.
- Public access is blocked. External users connect through a private access layer:
  - Recommended: Zero Trust tunnel (Cloudflare Access) OR VPN (Tailscale/WireGuard).

## 2. Required environment (all platforms)

- Python 3.11+ and Node 20+
- MySQL 8+ (or managed MySQL)
- Domain name (for TLS and managed access policy)
- `.env` with production values:
  - `DISABLE_AUTH=false`
  - strong `JWT_SECRET`
  - production `DATABASE_URL`
  - production `CORS_ORIGINS` (only trusted origins)
  - `AUTO_CREATE_TABLES=true` for first boot, then optional false after stabilization

## 3. Build + start (Windows, Linux, macOS)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Linux/macOS:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run backend on internal interface:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5173
```

## 4. Private reverse proxy

Expose only proxy port `8443` on the host firewall (or keep it local-only if using tunnel client on same host).

Proxy routes:

- `/api/*` -> `http://127.0.0.1:8000`
- `/` -> `http://127.0.0.1:5173`

Enable TLS at proxy.

## 5. Keep it non-public but reachable from anywhere

Use one of these models:

1. Cloudflare Tunnel + Cloudflare Access (recommended)
- Tunnel from app host to Cloudflare.
- No inbound public port required.
- Access policy requires company email login, MFA, and role groups.
- Point tunnel service to `https://127.0.0.1:8443` (or your private proxy listener).
- Restrict with Access policy:
  - Identity provider: company email domain only
  - MFA required
  - Optional device posture policy

2. Tailscale/WireGuard VPN
- Only devices on company VPN can reach app private IP:8443.
- Works from any network, still private.
- Keep backend/frontend/db bound to localhost or private subnet only.
- Allow inbound `8443` only from VPN interface/subnet.

3. IP allowlist gateway (least flexible)
- Restrict ingress to company static IPs. Not ideal for mobile users.

## 6. Production hardening checklist

- `DISABLE_AUTH=false`
- Rotate `JWT_SECRET`
- HTTPS only
- Restrict CORS to exact frontend domain(s)
- DB backups (daily minimum)
- Log rotation enabled (`backend/logs`)
- SMTP settings verified for alerts/password reset
- Admin accounts use strong passwords and MFA (if behind IdP, enforce there)

## 7. Sanity checks before go-live

From repo root:

```powershell
.\scripts\sanity-check.ps1 -CheckHealth
```

Live smoke test (with login):

```powershell
.\scripts\live-smoke-test.ps1 -ApiBase "http://127.0.0.1:8000" -Email "admin@company.com" -Password "********"
```

Optional workflow probe for an existing request:

```powershell
.\scripts\live-smoke-test.ps1 -ApiBase "http://127.0.0.1:8000" -Email "manager@company.com" -Password "********" -RequestId 7
```

Verify:
- `/health` returns `{"status":"ok"}`
- Login works for admin/manager/technician
- Requests -> approve -> issue -> usage/return flow works
- Reports endpoints accessible by `manager`/`finance`
- AI assistant returns role-scoped answers

## 8. Recommended production ports

- Internal service ports:
  - Frontend `5173` (local/private)
  - Backend `8000` (local/private)
  - Proxy `8443` (private access entry)
- Do not expose MySQL `3306` to internet.

## 9. Troubleshooting

- CORS errors: check `CORS_ORIGINS` and reverse-proxy origin headers.
- 401/403: verify role permissions and `DISABLE_AUTH=false` in production.
- SMTP errors: use app passwords for Gmail and test via Admin Settings.
- Slow startup: verify DB connectivity and DNS.
- Mobile access issues: confirm proxy/TLS endpoint is reachable from external networks through your private access layer.

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def request(url: str, method: str = "GET", data: dict | None = None) -> tuple[int, dict[str, str], str]:
    encoded = None
    headers = {}
    if data is not None:
        encoded = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, method=method, data=encoded, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            return resp.status, dict(resp.headers.items()), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        return e.code, dict(e.headers.items()), body


def main() -> None:
    parser = argparse.ArgumentParser(description="Security smoke checks for API hardening controls.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="API base URL")
    parser.add_argument("--expect-lockout", type=int, default=429, help="Expected lockout status after brute force")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    checks: list[dict[str, object]] = []

    status, headers, _ = request(f"{base}/health")
    header_expect = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Content-Security-Policy",
    ]
    for name in header_expect:
        checks.append({"name": f"header_{name}", "pass": name in headers, "value": headers.get(name)})
    checks.append({"name": "health_status", "pass": status == 200, "value": status})

    # Brute-force lockout check on login endpoint.
    lockout_hit = False
    for _ in range(6):
        code, _, _ = request(
            f"{base}/auth/login",
            method="POST",
            data={"username": "security-smoke@example.com", "password": "invalid-password"},
        )
        if code == args.expect_lockout:
            lockout_hit = True
            break
    checks.append({"name": "login_lockout", "pass": lockout_hit, "value": args.expect_lockout})

    ok = all(bool(c["pass"]) for c in checks)
    payload = {"pass": ok, "checks": checks}
    print(json.dumps(payload, indent=2))
    if not ok:
        sys.exit(2)


if __name__ == "__main__":
    main()

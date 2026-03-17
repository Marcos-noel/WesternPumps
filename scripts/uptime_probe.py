#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request


def request_once(url: str, timeout: float) -> tuple[bool, float]:
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            ok = 200 <= resp.status < 500
            _ = resp.read()
            return ok, (time.perf_counter() - started) * 1000.0
    except Exception:
        return False, (time.perf_counter() - started) * 1000.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure uptime availability against an endpoint over time.")
    parser.add_argument("--url", default="http://127.0.0.1:8000/health", help="Health URL")
    parser.add_argument("--duration-seconds", type=int, default=60, help="Probe duration")
    parser.add_argument("--interval-seconds", type=float, default=1.0, help="Probe interval")
    parser.add_argument("--timeout", type=float, default=3.0, help="Per request timeout")
    parser.add_argument("--min-availability-percent", type=float, default=99.0, help="Minimum acceptable availability")
    args = parser.parse_args()

    end_time = time.monotonic() + args.duration_seconds
    successes = 0
    failures = 0
    latencies: list[float] = []

    while time.monotonic() < end_time:
        ok, latency = request_once(args.url, args.timeout)
        latencies.append(latency)
        if ok:
            successes += 1
        else:
            failures += 1
        time.sleep(max(args.interval_seconds, 0.05))

    total = successes + failures
    availability = (successes / total * 100.0) if total else 0.0
    p95 = 0.0
    if latencies:
        ordered = sorted(latencies)
        idx = min(int(len(ordered) * 0.95), len(ordered) - 1)
        p95 = ordered[idx]

    result = {
        "total_requests": total,
        "successes": successes,
        "failures": failures,
        "availability_percent": round(availability, 3),
        "p95_latency_ms": round(p95, 3),
        "pass": availability >= args.min_availability_percent,
    }
    print(json.dumps(result, indent=2))
    if not result["pass"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import statistics
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys


def request_once(url: str, timeout: float) -> float:
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        resp.read()
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}")
    return (time.perf_counter() - start) * 1000.0


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * pct
    f = int(k)
    c = min(f + 1, len(ordered) - 1)
    if f == c:
        return ordered[f]
    return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


def run(url: str, users: int, requests_per_user: int, timeout: float) -> dict[str, float | int]:
    latencies: list[float] = []
    failures = 0
    lock = threading.Lock()

    def worker() -> list[float]:
        local: list[float] = []
        for _ in range(requests_per_user):
            local.append(request_once(url, timeout))
        return local

    with ThreadPoolExecutor(max_workers=users) as pool:
        futures = [pool.submit(worker) for _ in range(users)]
        for fut in as_completed(futures):
            try:
                sample = fut.result()
                with lock:
                    latencies.extend(sample)
            except Exception:
                failures += 1

    total = users * requests_per_user
    completed = len(latencies)
    return {
        "total_requests": total,
        "completed_requests": completed,
        "failed_workers": failures,
        "p50_ms": round(percentile(latencies, 0.50), 2),
        "p95_ms": round(percentile(latencies, 0.95), 2),
        "avg_ms": round(statistics.mean(latencies), 2) if latencies else 0.0,
        "max_ms": round(max(latencies), 2) if latencies else 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Basic performance smoke check for API endpoints.")
    parser.add_argument("--url", default="http://127.0.0.1:8000/health", help="Target URL")
    parser.add_argument("--users", type=int, default=10, help="Concurrent virtual users")
    parser.add_argument("--requests-per-user", type=int, default=20, help="Requests per user")
    parser.add_argument("--timeout", type=float, default=5.0, help="Per-request timeout (seconds)")
    parser.add_argument("--max-p95-ms", type=float, default=None, help="Fail if p95 exceeds this threshold")
    parser.add_argument("--max-failed-workers", type=int, default=0, help="Fail if failed workers exceed this number")
    parser.add_argument("--min-completed", type=int, default=None, help="Fail if completed requests are below this count")
    args = parser.parse_args()

    result = run(args.url, args.users, args.requests_per_user, args.timeout)
    violations: list[str] = []
    if args.max_p95_ms is not None and float(result["p95_ms"]) > args.max_p95_ms:
        violations.append(f"p95_ms {result['p95_ms']} > {args.max_p95_ms}")
    if int(result["failed_workers"]) > args.max_failed_workers:
        violations.append(f"failed_workers {result['failed_workers']} > {args.max_failed_workers}")
    if args.min_completed is not None and int(result["completed_requests"]) < args.min_completed:
        violations.append(f"completed_requests {result['completed_requests']} < {args.min_completed}")
    result["pass"] = len(violations) == 0
    if violations:
        result["violations"] = violations
    print(json.dumps(result, indent=2))
    if violations:
        sys.exit(2)


if __name__ == "__main__":
    main()

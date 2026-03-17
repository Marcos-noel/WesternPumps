#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Run 50-user performance acceptance benchmark.")
    parser.add_argument("--url", default="http://127.0.0.1:8000/health")
    parser.add_argument("--users", type=int, default=50)
    parser.add_argument("--requests-per-user", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--max-p95-ms", type=float, default=1200.0)
    args = parser.parse_args()

    cmd = [
        sys.executable,
        "scripts/perf_smoke.py",
        "--url",
        args.url,
        "--users",
        str(args.users),
        "--requests-per-user",
        str(args.requests_per_user),
        "--timeout",
        str(args.timeout),
        "--max-p95-ms",
        str(args.max_p95_ms),
        "--max-failed-workers",
        "0",
        "--min-completed",
        str(args.users * args.requests_per_user),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.stdout.strip():
        print(proc.stdout.strip())
    if proc.stderr.strip():
        print(proc.stderr.strip(), file=sys.stderr)

    result = {"pass": proc.returncode == 0, "command": " ".join(cmd)}
    print(json.dumps(result, indent=2))
    if proc.returncode != 0:
        sys.exit(proc.returncode)


if __name__ == "__main__":
    main()

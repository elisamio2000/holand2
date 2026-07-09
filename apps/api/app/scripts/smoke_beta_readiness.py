"""Operational smoke checks for beta launch readiness endpoints."""

from __future__ import annotations

import argparse
import asyncio
import sys

import httpx


async def _check_endpoint(client: httpx.AsyncClient, path: str) -> tuple[bool, str]:
    try:
        response = await client.get(path)
    except httpx.HTTPError as exc:
        return False, f"{path}: request failed ({exc})"

    if response.status_code >= 400:
        return False, f"{path}: HTTP {response.status_code}"
    return True, f"{path}: ok ({response.status_code})"


async def run(base_url: str) -> int:
    checks = ["/health", "/monitoring/metrics", "/monitoring/readiness"]
    async with httpx.AsyncClient(base_url=base_url, timeout=8.0) as client:
        results = await asyncio.gather(*[_check_endpoint(client, path) for path in checks])

    failed = [message for ok, message in results if not ok]
    for ok, message in results:
        marker = "PASS" if ok else "FAIL"
        print(f"[{marker}] {message}")  # noqa: T201

    if failed:
        print(f"Smoke checks failed: {len(failed)} endpoint(s).", file=sys.stderr)  # noqa: T201
        return 1
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run beta readiness smoke checks.")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="API base URL (default: http://127.0.0.1:8000)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(asyncio.run(run(args.base_url)))

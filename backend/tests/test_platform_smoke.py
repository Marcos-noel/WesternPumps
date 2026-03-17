from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_and_metrics_endpoints() -> None:
    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json().get("status") == "ok"

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "westernpumps_requests_total" in metrics.text


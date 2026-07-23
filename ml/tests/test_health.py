from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "ml-service"}


def test_fraud_check_stub_returns_501_in_core_api_error_format() -> None:
    # fraud-check (BE-2.5/2.6) ещё заглушка; deal-rating (BE-2.3) и blur (BE-2.4) реализованы
    res = client.post("/v1/fraud-check")
    assert res.status_code == 501
    assert res.json()["code"] == "not_implemented"

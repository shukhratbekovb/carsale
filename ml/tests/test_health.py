from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "ml-service"}


def test_blur_stub_returns_501_in_core_api_error_format() -> None:
    # blur (BE-2.4) ещё заглушка; deal-rating уже реализован (см. test_deal_rating.py)
    res = client.post("/v1/blur")
    assert res.status_code == 501
    assert res.json()["code"] == "not_implemented"

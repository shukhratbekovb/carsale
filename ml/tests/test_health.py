from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "ml-service"}


def test_unknown_route_404() -> None:
    # Все три ML-эндпоинта реализованы (deal-rating BE-2.3, blur BE-2.4,
    # fraud-check BE-2.5) — заглушек больше нет.
    res = client.post("/v1/no-such-endpoint")
    assert res.status_code == 404

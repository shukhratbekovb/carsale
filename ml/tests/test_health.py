from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "ml-service"}


def test_deal_rating_stub_returns_501_in_core_api_error_format() -> None:
    res = client.post(
        "/v1/deal-rating",
        json={
            "make": "Chevrolet",
            "model": "Cobalt",
            "year": 2020,
            "mileage": 50000,
            "condition": "GOOD",
            "city": "Tashkent",
            "price_uzs": 120_000_000,
        },
    )
    assert res.status_code == 501
    assert res.json()["code"] == "not_implemented"

"""Тесты антифрода (BE-2.5): ценовая аномалия + pHash в /v1/blur."""

import base64

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.vision.blur import detect_and_blur
from app.vision.fraud import PRICE_ANOMALY_RATIO, evaluate, price_anomaly

client = TestClient(app)


def _jpeg(seed: int = 0) -> bytes:
    rng = np.random.default_rng(seed)
    img = rng.integers(0, 256, size=(120, 160, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_price_anomaly_rule():
    median = 100_000_000
    # цена ровно на пороге (40% медианы) — не аномалия (строгое <)
    assert price_anomaly(median, int(median * PRICE_ANOMALY_RATIO))["price_anomaly"] is False
    # заметно ниже порога — аномалия
    a = price_anomaly(median, 30_000_000)
    assert a["price_anomaly"] is True
    assert a["deviation_percent"] == 70.0
    # рыночная цена — не аномалия
    assert price_anomaly(median, 95_000_000)["price_anomaly"] is False


def test_price_anomaly_zero_median():
    assert price_anomaly(0, 1000)["price_anomaly"] is False


def test_evaluate_without_model():
    res = evaluate(None, {"make": "X"}, 1000)
    assert res == {"price_anomaly": False, "deviation_percent": 0.0, "predicted_median_uzs": None}


def test_evaluate_with_stub_model():
    class StubModel:
        def predict_price(self, features):
            return 100_000_000

    res = evaluate(StubModel(), {"make": "Chevrolet"}, 20_000_000)
    assert res["price_anomaly"] is True
    assert res["predicted_median_uzs"] == 100_000_000


def test_blur_includes_phash():
    res = detect_and_blur(_jpeg(1))
    assert "phash" in res and isinstance(res["phash"], str) and len(res["phash"]) >= 8


def test_phash_stable_and_distinct():
    # тот же вход → тот же хеш; разный вход → другой хеш
    img = _jpeg(1)
    h1 = detect_and_blur(img)["phash"]
    h2 = detect_and_blur(img)["phash"]
    h3 = detect_and_blur(_jpeg(999))["phash"]
    assert h1 == h2
    assert h1 != h3


def test_fraud_check_endpoint():
    res = client.post(
        "/v1/fraud-check",
        json={
            "make": "Chevrolet",
            "model": "Cobalt",
            "year": 2020,
            "mileage": 40000,
            "condition": "GOOD",
            "city": "Tashkent",
            "price_uzs": 5_000_000,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"price_anomaly", "deviation_percent", "predicted_median_uzs"}
    # цена 5М против рыночных ~сотен млн — аномалия
    assert body["price_anomaly"] is True


def _decode_b64(b64: str) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(base64.b64decode(b64), np.uint8), cv2.IMREAD_COLOR)


def test_blur_endpoint_still_returns_phash():
    res = client.post("/v1/blur", files={"file": ("car.jpg", _jpeg(2), "image/jpeg")})
    assert res.status_code == 200
    body = res.json()
    assert "phash" in body
    assert _decode_b64(body["blurred_image_b64"]) is not None

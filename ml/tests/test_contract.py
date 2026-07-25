"""Контрактные тесты Core↔ML (BE-2.7).

Каждый эндпоинт ML прогоняется через FastAPI TestClient, и его ответ сверяется с
канонической фикстурой из ``ml/contracts/*.json`` — тот же файл читает
контрактный тест Core API (``api/src/lib/ml-client.contract.test.ts``). Контракт
— это набор КЛЮЧЕЙ и ТИПОВ, не конкретные числа (label/score/цены зависят от
обученной модели), поэтому сверяем форму и домен значений, а не равенство.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

CONTRACTS = Path(__file__).resolve().parents[1] / "contracts"

VALID_LABELS = {"GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "UNAVAILABLE"}


def _fixture(name: str) -> dict:
    return json.loads((CONTRACTS / name).read_text(encoding="utf-8"))


def _assert_same_shape(actual: dict, expected: dict, path: str = "") -> None:
    """Ключи совпадают точь-в-точь, а типы значений совместимы с фикстурой.

    None в фикстуре означает «nullable» — реальное значение может быть как None,
    так и того же типа, что противоположный пример (мы допускаем оба).
    """
    assert set(actual) == set(expected), f"{path}: keys {set(actual)} != {set(expected)}"
    for key, exp in expected.items():
        act = actual[key]
        loc = f"{path}.{key}" if path else key
        if isinstance(exp, bool):
            assert isinstance(act, bool), f"{loc}: expected bool, got {type(act)}"
        elif isinstance(exp, (int, float)):
            assert isinstance(act, (int, float)) and not isinstance(act, bool), f"{loc}: expected number"
        elif isinstance(exp, str):
            assert isinstance(act, str), f"{loc}: expected str"
        elif isinstance(exp, list):
            assert isinstance(act, list), f"{loc}: expected list"
            if exp and isinstance(exp[0], dict):
                for i, item in enumerate(act):
                    _assert_same_shape(item, exp[0], f"{loc}[{i}]")
        elif isinstance(exp, dict):
            assert isinstance(act, dict), f"{loc}: expected object"
            _assert_same_shape(act, exp, loc)


def _noisy_jpeg(w: int = 200, h: int = 200) -> bytes:
    rng = np.random.default_rng(7)
    img = rng.integers(0, 256, size=(h, w, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_deal_rating_matches_contract():
    fx = _fixture("deal-rating.json")
    res = client.post("/v1/deal-rating", json=fx["request"])
    assert res.status_code == 200
    body = res.json()
    _assert_same_shape(body, fx["response"])
    assert body["label"] in VALID_LABELS
    # recommended_* — number | null (домен контракта)
    for key in ("recommended_min_uzs", "recommended_max_uzs"):
        assert body[key] is None or isinstance(body[key], (int, float))


def test_fraud_check_matches_contract():
    fx = _fixture("fraud-check.json")
    res = client.post("/v1/fraud-check", json=fx["request"])
    assert res.status_code == 200
    body = res.json()
    _assert_same_shape(body, fx["response"])
    assert body["predicted_median_uzs"] is None or isinstance(body["predicted_median_uzs"], (int, float))


def test_blur_matches_contract():
    fx = _fixture("blur.json")
    res = client.post(
        "/v1/blur",
        files={"file": ("photo.jpg", _noisy_jpeg(), "image/jpeg")},
    )
    assert res.status_code == 200
    body = res.json()
    _assert_same_shape(body, fx["response"])
    # blurred_image_b64 декодируется в непустые байты
    assert len(base64.b64decode(body["blurred_image_b64"])) > 0


def test_blur_manual_regions_contract():
    """Ручная корректировка (FR-03): переданная область → plate_detected=True, та же форма."""
    fx = _fixture("blur.json")
    regions = json.dumps([{"x": 0.25, "y": 0.25, "width": 0.5, "height": 0.5}])
    res = client.post(
        "/v1/blur",
        files={"file": ("photo.jpg", _noisy_jpeg(), "image/jpeg")},
        data={"regions": regions},
    )
    assert res.status_code == 200
    body = res.json()
    _assert_same_shape(body, fx["response"])
    assert body["plate_detected"] is True
    assert len(body["regions"]) == 1

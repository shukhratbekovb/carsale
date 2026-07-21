"""Тесты Deal Rating (BE-2.3): пороги меток, MAPE обучения, эндпоинт."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.deal_rating import DealRatingModel, unavailable_response
from app.models.train import train

client = TestClient(app)

VALID_LABELS = {"GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "UNAVAILABLE"}
SAMPLE = {
    "make": "Chevrolet",
    "model": "Cobalt",
    "year": 2020,
    "mileage": 45000,
    "condition": "GOOD",
    "city": "Tashkent",
}


def _model_with_median(monkeypatch, median: float) -> DealRatingModel:
    m = DealRatingModel(booster=None, vocab={})  # type: ignore[arg-type]
    monkeypatch.setattr(m, "predict_price", lambda _f: median)
    return m


def test_label_thresholds(monkeypatch):
    m = _model_with_median(monkeypatch, 100_000_000.0)
    # ratio <= 0.9 → GREAT; (0.9, 1.1] → FAIR; > 1.1 → OVERPRICED
    assert m.rate(SAMPLE, 80_000_000)["label"] == "GREAT_DEAL"
    assert m.rate(SAMPLE, 90_000_000)["label"] == "GREAT_DEAL"  # граница 0.9 включительно
    assert m.rate(SAMPLE, 100_000_000)["label"] == "FAIR_PRICE"
    assert m.rate(SAMPLE, 110_000_000)["label"] == "FAIR_PRICE"  # граница 1.1 включительно
    assert m.rate(SAMPLE, 130_000_000)["label"] == "OVERPRICED"


def test_recommended_range_and_shape(monkeypatch):
    m = _model_with_median(monkeypatch, 100_000_000.0)
    r = m.rate(SAMPLE, 100_000_000)
    assert r["recommended_min_uzs"] == 90_000_000
    assert r["recommended_max_uzs"] == 110_000_000
    assert 0.0 <= r["score"] <= 1.0
    assert set(r) == {"label", "score", "recommended_min_uzs", "recommended_max_uzs", "computed_at"}


def test_unavailable_response_shape():
    r = unavailable_response()
    assert r["label"] == "UNAVAILABLE"
    assert r["recommended_min_uzs"] is None and r["recommended_max_uzs"] is None


def test_training_pipeline_mape(tmp_path):
    """Обучение на синтетике даёт MAPE <= 15% (FR-05 acceptance). Артефакты — в tmp,
    чтобы не затирать закоммиченную модель."""
    mape = train(
        n=12_000,
        seed=7,
        num_rounds=200,
        model_file=tmp_path / "m.txt",
        vocab_file=tmp_path / "v.json",
    )
    assert mape < 0.15, f"MAPE {mape:.4f} exceeds 0.15"


def test_deal_rating_endpoint():
    """С закоммиченным артефактом эндпоинт возвращает валидную метку и диапазон."""
    res = client.post("/v1/deal-rating", json={**SAMPLE, "price_uzs": 150_000_000})
    assert res.status_code == 200
    body = res.json()
    assert body["label"] in VALID_LABELS
    if body["label"] != "UNAVAILABLE":
        assert body["recommended_min_uzs"] < body["recommended_max_uzs"]
        assert "computed_at" in body


@pytest.mark.parametrize("bad", [{"year": 1800}, {"price_uzs": 0}, {"mileage": -1}])
def test_endpoint_validation(bad):
    res = client.post("/v1/deal-rating", json={**SAMPLE, "price_uzs": 150_000_000, **bad})
    assert res.status_code == 422

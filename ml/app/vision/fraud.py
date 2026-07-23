"""Антифрод-сигналы (BE-2.5). Ценовая аномалия — по предсказанной медиане
Deal-Rating-модели; детекция дублей фото (pHash) выполняется на стороне Core API
по корпусу хешей (BE-3.6), хеши считаются при загрузке фото (/v1/blur).

Контракт результата — docs/analysis/10-integrations-api.md §2.4 (fraud_check).
"""

from __future__ import annotations

from typing import Any, Optional

# Порог ценовой аномалии: цена < 40% медианы → подозрительно дёшево (скам-сигнал).
PRICE_ANOMALY_RATIO = 0.4


def price_anomaly(predicted_median_uzs: float, price_uzs: float) -> dict[str, Any]:
    """Оценка ценовой аномалии по медиане. deviation_percent — насколько цена ниже
    рынка (положительное = дешевле медианы)."""
    if predicted_median_uzs <= 0:
        return {"price_anomaly": False, "deviation_percent": 0.0}
    ratio = price_uzs / predicted_median_uzs
    deviation = round((1.0 - ratio) * 100.0, 1)
    return {
        "price_anomaly": ratio < PRICE_ANOMALY_RATIO,
        "deviation_percent": deviation,
    }


def evaluate(model: Optional[Any], features: dict[str, Any], price_uzs: float) -> dict[str, Any]:
    """Полная оценка фрода по цене. При недоступной модели — аномалия не
    вычисляется (False), дубли всё равно проверит Core API."""
    if model is None:
        return {"price_anomaly": False, "deviation_percent": 0.0, "predicted_median_uzs": None}
    median = model.predict_price(features)
    result = price_anomaly(median, price_uzs)
    result["predicted_median_uzs"] = round(median)
    return result

"""Carsale ML Service (BE-2.x).

Контракты эндпоинтов — docs/analysis/10-integrations-api.md §2.4:
  POST /v1/deal-rating  — LightGBM-оценка цены (SLA p95 < 1 c)   → BE-2.3 (готово)
  POST /v1/blur         — блюр госномера/VIN, YOLO/OpenCV (< 5 c) → BE-2.4
  POST /v1/fraud-check  — pHash дублей + ценовая аномалия          → BE-2.5/2.6
"""

import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.models.deal_rating import get_model, unavailable_response

logger = logging.getLogger("ml-service")

app = FastAPI(title="Carsale ML Service", version="0.1.0")


class DealRatingRequest(BaseModel):
    make: str
    model: str
    year: int = Field(ge=1950)
    mileage: int = Field(ge=0)
    condition: str
    city: str
    price_uzs: int = Field(gt=0)


def _not_implemented(feature: str) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={"error": f"{feature} is not implemented yet", "code": "not_implemented"},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ml-service"}


@app.post("/v1/deal-rating")
def deal_rating(req: DealRatingRequest) -> dict:
    """Вердикт цены. При отсутствии модели или сбое инференса деградирует в
    UNAVAILABLE (SLA §2.4: «недостаточно данных / ML недоступен»), не 5xx."""
    model = get_model()
    if model is None:
        return unavailable_response()
    try:
        features = req.model_dump(exclude={"price_uzs"})
        return model.rate(features, req.price_uzs)
    except Exception:  # noqa: BLE001 — любой сбой инференса → graceful UNAVAILABLE
        logger.exception("deal-rating inference failed")
        return unavailable_response()


@app.post("/v1/blur")
def blur() -> JSONResponse:
    return _not_implemented("blur")


@app.post("/v1/fraud-check")
def fraud_check() -> JSONResponse:
    return _not_implemented("fraud-check")

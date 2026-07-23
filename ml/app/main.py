"""Carsale ML Service (BE-2.x).

Контракты эндпоинтов — docs/analysis/10-integrations-api.md §2.4:
  POST /v1/deal-rating  — LightGBM-оценка цены (SLA p95 < 1 c)   → BE-2.3 (готово)
  POST /v1/blur         — блюр госномера/VIN, YOLO/OpenCV (< 5 c) → BE-2.4
  POST /v1/fraud-check  — pHash дублей + ценовая аномалия          → BE-2.5/2.6
"""

import json
import logging

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.models.deal_rating import get_model, unavailable_response
from app.vision.blur import BadImageError, detect_and_blur

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
async def blur(
    file: UploadFile = File(...),
    regions: str | None = Form(default=None),
) -> JSONResponse:
    """Блюр госномера на фото (§2.4). multipart: file (обязательно) + regions
    (опц. JSON-массив нормализованных областей — ручная корректировка продавца,
    FR-03). Не найден номер → 200 plate_detected=false без блюра. Битый файл → 400.
    Хранение — на стороне Core API (BE-3.3), сервис stateless."""
    data = await file.read()
    if not data:
        return JSONResponse(status_code=400, content={"error": "empty file", "code": "bad_image"})

    manual = None
    if regions:
        try:
            manual = json.loads(regions)
            if not isinstance(manual, list):
                raise ValueError("regions must be a JSON array")
        except (json.JSONDecodeError, ValueError):
            return JSONResponse(
                status_code=400, content={"error": "invalid regions", "code": "bad_regions"}
            )

    try:
        return JSONResponse(content=detect_and_blur(data, manual))
    except BadImageError:
        return JSONResponse(status_code=400, content={"error": "cannot decode image", "code": "bad_image"})
    except Exception:  # noqa: BLE001
        # блюр НЕ деградируем в «вернуть оригинал» — это утечка номера; честный сбой
        logger.exception("blur failed")
        return JSONResponse(status_code=503, content={"error": "blur failed", "code": "blur_unavailable"})


@app.post("/v1/fraud-check")
def fraud_check() -> JSONResponse:
    return _not_implemented("fraud-check")

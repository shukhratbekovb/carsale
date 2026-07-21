"""Модель Deal Rating: инференс и вердикт цены (BE-2.3).

Контракт — docs/analysis/10-integrations-api.md §2.4; пороги меток —
docs/analysis/07-process-and-state.md §2.4:
    GREAT_DEAL   : цена ≤ медиана × 0.9
    FAIR_PRICE   : медиана × 0.9 < цена ≤ медиана × 1.1
    OVERPRICED   : цена > медиана × 1.1
Медиана предсказывается LightGBM-регрессором (train.py) на лог-цене.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import lightgbm as lgb
import numpy as np

from app.models.features import Vocab, to_frame

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MODEL_FILE = ARTIFACTS_DIR / "deal_rating.txt"
VOCAB_FILE = ARTIFACTS_DIR / "deal_rating_vocab.json"

GREAT_DEAL_MAX = 0.9  # цена/медиана ≤ 0.9
OVERPRICED_MIN = 1.1  # цена/медиана > 1.1


class DealRatingModel:
    def __init__(self, booster: lgb.Booster, vocab: Vocab) -> None:
        self._booster = booster
        self._vocab = vocab

    @classmethod
    def load(cls, model_file: Path = MODEL_FILE, vocab_file: Path = VOCAB_FILE) -> "DealRatingModel":
        booster = lgb.Booster(model_file=str(model_file))
        vocab = json.loads(vocab_file.read_text(encoding="utf-8"))
        return cls(booster, vocab)

    def predict_price(self, features: dict[str, Any]) -> float:
        """Предсказанная рыночная медиана цены (UZS) для комбинации признаков."""
        frame = to_frame([features], self._vocab)
        pred_log = float(self._booster.predict(frame)[0])
        return float(np.expm1(pred_log))

    def rate(self, features: dict[str, Any], price_uzs: float) -> dict[str, Any]:
        median = self.predict_price(features)
        ratio = price_uzs / median if median > 0 else float("inf")

        if ratio <= GREAT_DEAL_MAX:
            label = "GREAT_DEAL"
        elif ratio <= OVERPRICED_MIN:
            label = "FAIR_PRICE"
        else:
            label = "OVERPRICED"

        # score — близость к медиане в [0,1] (1 = ровно медиана); справочный сигнал
        score = round(max(0.0, 1.0 - abs(ratio - 1.0)), 4)
        return {
            "label": label,
            "score": score,
            "recommended_min_uzs": round(median * GREAT_DEAL_MAX),
            "recommended_max_uzs": round(median * OVERPRICED_MIN),
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }


# Ленивый синглтон: артефакт грузится один раз; при его отсутствии — None,
# эндпоинт деградирует в UNAVAILABLE (SLA §2.4), а не падает.
_model: Optional[DealRatingModel] = None
_load_attempted = False


def get_model() -> Optional[DealRatingModel]:
    global _model, _load_attempted
    if _load_attempted:
        return _model
    _load_attempted = True
    if MODEL_FILE.exists() and VOCAB_FILE.exists():
        _model = DealRatingModel.load()
    return _model


def unavailable_response() -> dict[str, Any]:
    return {
        "label": "UNAVAILABLE",
        "score": 0.0,
        "recommended_min_uzs": None,
        "recommended_max_uzs": None,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }

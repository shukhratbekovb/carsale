"""Признаки модели Deal Rating (BE-2.3).

Единый источник схемы признаков для обучения (train.py) и инференса
(deal_rating.py) — иначе кодировка категорий разъедется между train/serve.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

# Категориальные признаки кодируются через фиксированный словарь (vocab),
# сохранённый при обучении; числовые идут как есть.
CATEGORICAL: list[str] = ["make", "model", "condition", "city"]
NUMERIC: list[str] = ["year", "mileage"]
FEATURES: list[str] = NUMERIC + CATEGORICAL

Vocab = dict[str, list[str]]


def build_vocab(rows: list[dict[str, Any]]) -> Vocab:
    """Отсортированные уникальные значения каждой категории — стабильная кодировка."""
    return {col: sorted({str(r[col]) for r in rows}) for col in CATEGORICAL}


def to_frame(rows: list[dict[str, Any]], vocab: Vocab) -> pd.DataFrame:
    """Собирает DataFrame признаков; категории приводятся к dtype с фиксированным
    списком значений из vocab (неизвестные значения → NaN, LightGBM это переваривает)."""
    df = pd.DataFrame(rows, columns=FEATURES).copy()
    for col in CATEGORICAL:
        df[col] = pd.Categorical(df[col].astype("string"), categories=vocab[col])
    for col in NUMERIC:
        df[col] = pd.to_numeric(df[col])
    return df

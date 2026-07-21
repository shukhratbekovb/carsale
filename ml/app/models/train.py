"""Обучение модели Deal Rating (BE-2.3, ADR-003).

Генерирует синтетический seed (BE-2.2), обучает LightGBM-регрессор на log1p(цена),
оценивает MAPE на holdout, сохраняет артефакты (booster + vocab).
CLI: python -m app.models.train --n 60000 --seed 42
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.model_selection import train_test_split

from app.data.synthetic import generate_listings
from app.models.deal_rating import MODEL_FILE, VOCAB_FILE
from app.models.features import CATEGORICAL, build_vocab, to_frame

# Детерминированные параметры — воспроизводимый артефакт
PARAMS: dict = {
    "objective": "regression",
    "metric": "mape",
    "num_leaves": 63,
    "learning_rate": 0.05,
    "feature_fraction": 0.9,
    "bagging_fraction": 0.9,
    "bagging_freq": 1,
    "min_data_in_leaf": 50,
    "seed": 42,
    "deterministic": True,
    "num_threads": 1,
    "verbose": -1,
}


def train(
    n: int = 60_000,
    seed: int = 42,
    num_rounds: int = 400,
    model_file: Path = MODEL_FILE,
    vocab_file: Path = VOCAB_FILE,
) -> float:
    """Обучает модель, сохраняет артефакты в указанные пути, возвращает MAPE на holdout."""
    rows = generate_listings(n, seed)
    vocab = build_vocab(rows)
    x = to_frame(rows, vocab)
    y = np.log1p(np.array([r["price_uzs"] for r in rows], dtype=float))

    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=seed)

    train_set = lgb.Dataset(x_train, y_train, categorical_feature=CATEGORICAL)
    booster = lgb.train(PARAMS, train_set, num_boost_round=num_rounds)

    pred = np.expm1(booster.predict(x_test))
    actual = np.expm1(y_test)
    mape = float(mean_absolute_percentage_error(actual, pred))

    model_file.parent.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(model_file))
    vocab_file.write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    return mape


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.models.train")
    parser.add_argument("--n", type=int, default=60_000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    mape = train(args.n, args.seed)
    print(f"trained deal-rating model: MAPE={mape:.4f} (target <= 0.15) -> {MODEL_FILE}")


if __name__ == "__main__":
    main()

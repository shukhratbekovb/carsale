"""Синтетический seed-датасет цен UZ-авторынка (BE-2.2, ADR-003).

Генерирует обучающие строки для Deal Rating (BE-2.3) в форме, совпадающей
с контрактом POST /v1/deal-rating (docs/analysis/10-integrations-api.md §2.4):
make, model, year, mileage, condition, city, price_uzs.

Модель цены (ADR-003: медиана + шум по комбинации марка×модель×год×состояние×регион):
    price = base(make, model)
          × депрециация по возрасту (0.93^age, пол 0.35)
          × фактор пробега (−1% за ~12 тыс. км, пол 0.55)
          × фактор состояния (NEW 1.10 / GOOD 1.00 / FAIR 0.85 / POOR 0.70)
          × фактор города (столичная премия Ташкента 1.08)
          × логнормальный шум (σ = 0.08)

Только stdlib (random, csv, math) — тяжёлые зависимости придут в BE-2.3.
CLI: python -m app.data.synthetic --n 50000 --seed 42 --out data/seed.csv
"""

from __future__ import annotations

import argparse
import csv
import random
from datetime import date
from pathlib import Path

CURRENT_YEAR = date.today().year
MIN_YEAR = 2000

# (make, model) -> (базовая цена нового авто в UZS, вес популярности, первый год выпуска для UZ)
# Веса отражают доминирование Chevrolet/Ravon (UzAuto) — суммарно ~82% рынка.
MODEL_SPECS: dict[tuple[str, str], tuple[int, int, int]] = {
    ("Chevrolet", "Cobalt"): (165_000_000, 20, 2013),
    ("Chevrolet", "Gentra"): (175_000_000, 14, 2013),
    ("Chevrolet", "Nexia"): (145_000_000, 13, 2008),
    ("Chevrolet", "Spark"): (125_000_000, 12, 2010),
    ("Chevrolet", "Damas"): (105_000_000, 10, 2000),
    ("Chevrolet", "Malibu"): (340_000_000, 6, 2012),
    ("Ravon", "R2"): (115_000_000, 4, 2016),
    ("Ravon", "R4"): (135_000_000, 3, 2016),
    ("Kia", "Sonet"): (285_000_000, 3, 2021),
    ("Kia", "K5"): (420_000_000, 3, 2020),
    ("Hyundai", "Elantra"): (380_000_000, 3, 2016),
    ("Hyundai", "Tucson"): (470_000_000, 3, 2016),
    ("Toyota", "Camry"): (560_000_000, 3, 2005),
    ("BYD", "Song Plus"): (360_000_000, 3, 2022),
}

CONDITIONS = ("NEW", "GOOD", "FAIR", "POOR")
CONDITION_FACTORS = {"NEW": 1.10, "GOOD": 1.00, "FAIR": 0.85, "POOR": 0.70}

# Столичная премия Ташкента; регионы — небольшой дисконт.
CITY_FACTORS = {
    "Tashkent": 1.08,
    "Samarkand": 1.00,
    "Bukhara": 0.99,
    "Fergana": 0.98,
    "Andijan": 0.97,
    "Namangan": 0.97,
}

DEPRECIATION_RATE = 0.93
DEPRECIATION_FLOOR = 0.35
MILEAGE_SLOPE = 1 / 1_200_000  # −1% цены за каждые 12 000 км
MILEAGE_FLOOR = 0.55
NOISE_SIGMA = 0.08
AVG_KM_PER_YEAR = 15_000  # ADR-003: средний пробег ~15 000 км/год
MAX_MILEAGE = 500_000

CSV_FIELDS = ["make", "model", "year", "mileage", "condition", "city", "price_uzs"]


def deterministic_price(
    make: str, model: str, year: int, mileage: int, condition: str, city: str
) -> float:
    """Детерминированная (без шума) медианная цена для комбинации признаков.

    Используется генератором как медиана и тестами для проверок монотонности.
    """
    base, _, _ = MODEL_SPECS[(make, model)]
    age = max(0, CURRENT_YEAR - year)
    age_factor = max(DEPRECIATION_FLOOR, DEPRECIATION_RATE**age)
    mileage_factor = max(MILEAGE_FLOOR, 1.0 - mileage * MILEAGE_SLOPE)
    return base * age_factor * mileage_factor * CONDITION_FACTORS[condition] * CITY_FACTORS[city]


def _sample_condition(rng: random.Random, age: int) -> str:
    if age <= 1:
        return rng.choices(("NEW", "GOOD"), weights=(50, 50))[0]
    if age <= 5:
        return rng.choices(("GOOD", "FAIR", "POOR"), weights=(80, 18, 2))[0]
    if age <= 12:
        return rng.choices(("GOOD", "FAIR", "POOR"), weights=(55, 35, 10))[0]
    return rng.choices(("GOOD", "FAIR", "POOR"), weights=(30, 45, 25))[0]


def _sample_mileage(rng: random.Random, age: int, condition: str) -> int:
    if condition == "NEW":
        return rng.randint(0, 5_000)
    mean = AVG_KM_PER_YEAR * age
    sigma = 4_000 * age + 3_000
    return max(0, min(MAX_MILEAGE, int(rng.gauss(mean, sigma))))


def generate_listings(n: int, seed: int = 42) -> list[dict]:
    """Сгенерировать n синтетических объявлений; один seed → идентичный результат."""
    rng = random.Random(seed)
    keys = list(MODEL_SPECS)
    weights = [spec[1] for spec in MODEL_SPECS.values()]
    rows: list[dict] = []
    for _ in range(n):
        make, model = rng.choices(keys, weights=weights)[0]
        _, _, first_year = MODEL_SPECS[(make, model)]
        year_lo = max(MIN_YEAR, first_year)
        # Смещение к свежим годам: недавние выпуски встречаются на рынке чаще.
        years = range(year_lo, CURRENT_YEAR + 1)
        year = rng.choices(list(years), weights=[(y - year_lo + 1) ** 1.5 for y in years])[0]
        age = CURRENT_YEAR - year
        condition = _sample_condition(rng, age)
        mileage = _sample_mileage(rng, age, condition)
        city = rng.choices(list(CITY_FACTORS), weights=(45, 12, 9, 11, 12, 11))[0]
        median = deterministic_price(make, model, year, mileage, condition, city)
        price_uzs = max(1, round(median * rng.lognormvariate(0.0, NOISE_SIGMA)))
        rows.append(
            {
                "make": make,
                "model": model,
                "year": year,
                "mileage": mileage,
                "condition": condition,
                "city": city,
                "price_uzs": price_uzs,
            }
        )
    return rows


def write_csv(path: "str | Path", n: int, seed: int = 42) -> Path:
    """Записать n сгенерированных строк в CSV (родительские каталоги создаются)."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(generate_listings(n, seed))
    return out


def main(argv: "list[str] | None" = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m app.data.synthetic",
        description="Синтетический seed-датасет цен для Deal Rating (ADR-003)",
    )
    parser.add_argument("--n", type=int, default=50_000, help="число строк (default: 50000)")
    parser.add_argument("--seed", type=int, default=42, help="seed генератора (default: 42)")
    parser.add_argument("--out", default="data/seed.csv", help="путь к CSV (default: data/seed.csv)")
    args = parser.parse_args(argv)
    out = write_csv(args.out, args.n, args.seed)
    print(f"wrote {args.n} rows to {out} (seed={args.seed})")


if __name__ == "__main__":
    main()

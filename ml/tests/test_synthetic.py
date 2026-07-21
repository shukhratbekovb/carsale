"""Тесты генератора синтетического seed-датасета (BE-2.2, ADR-003)."""

import csv
from pathlib import Path

from app.data.synthetic import (
    CITY_FACTORS,
    CONDITIONS,
    CSV_FIELDS,
    CURRENT_YEAR,
    MIN_YEAR,
    MODEL_SPECS,
    deterministic_price,
    generate_listings,
    main,
    write_csv,
)

SAMPLE = generate_listings(500, seed=42)


def test_same_seed_identical_rows() -> None:
    again = generate_listings(500, seed=42)
    assert SAMPLE == again


def test_different_seed_differs() -> None:
    other = generate_listings(500, seed=7)
    assert SAMPLE != other


def test_row_count_and_schema() -> None:
    assert len(SAMPLE) == 500
    for row in SAMPLE:
        assert set(row) == set(CSV_FIELDS)
        assert (row["make"], row["model"]) in MODEL_SPECS
        assert row["condition"] in CONDITIONS
        assert row["city"] in CITY_FACTORS
        assert isinstance(row["year"], int)
        assert isinstance(row["mileage"], int)
        assert isinstance(row["price_uzs"], int)


def test_price_positive_and_sane_bounds() -> None:
    for row in SAMPLE:
        # От старого Damas в POOR до нового Camry в Ташкенте — с запасом на шум.
        assert 5_000_000 <= row["price_uzs"] <= 1_500_000_000


def test_year_within_bounds() -> None:
    for row in SAMPLE:
        assert MIN_YEAR <= row["year"] <= CURRENT_YEAR


def test_mileage_non_negative() -> None:
    for row in SAMPLE:
        assert 0 <= row["mileage"] <= 500_000


def test_newer_year_higher_price() -> None:
    older = deterministic_price("Chevrolet", "Cobalt", 2015, 100_000, "GOOD", "Tashkent")
    newer = deterministic_price("Chevrolet", "Cobalt", 2022, 100_000, "GOOD", "Tashkent")
    assert newer > older


def test_more_mileage_lower_price() -> None:
    low = deterministic_price("Chevrolet", "Gentra", 2020, 30_000, "GOOD", "Samarkand")
    high = deterministic_price("Chevrolet", "Gentra", 2020, 200_000, "GOOD", "Samarkand")
    assert high < low


def test_condition_factor_ordering() -> None:
    prices = [
        deterministic_price("Chevrolet", "Nexia", 2018, 80_000, cond, "Bukhara")
        for cond in ("NEW", "GOOD", "FAIR", "POOR")
    ]
    assert prices == sorted(prices, reverse=True)


def test_tashkent_city_premium() -> None:
    for city in CITY_FACTORS:
        if city == "Tashkent":
            continue
        regional = deterministic_price("Chevrolet", "Cobalt", 2021, 50_000, "GOOD", city)
        capital = deterministic_price("Chevrolet", "Cobalt", 2021, 50_000, "GOOD", "Tashkent")
        assert capital > regional


def test_write_csv_creates_parent_dirs_and_rows(tmp_path: Path) -> None:
    out = write_csv(tmp_path / "nested" / "seed.csv", n=25, seed=1)
    assert out.exists()
    with out.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 25
    assert set(rows[0]) == set(CSV_FIELDS)
    assert int(rows[0]["price_uzs"]) > 0


def test_cli_main_writes_file(tmp_path: Path) -> None:
    out = tmp_path / "cli" / "seed.csv"
    main(["--n", "10", "--seed", "3", "--out", str(out)])
    with out.open(newline="", encoding="utf-8") as fh:
        assert len(list(csv.DictReader(fh))) == 10

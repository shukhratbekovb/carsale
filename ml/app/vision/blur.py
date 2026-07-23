"""Детекция и блюр госномера на фото авто (BE-2.4, FR-03).

Контракт эндпоинта — docs/analysis/10-integrations-api.md §2.4 (SLA p95 < 5 c).
Детекция — Haar-каскад OpenCV (`haarcascade_russian_plate_number.xml`, закоммичен
в репозиторий: opencv-python 5.x больше не поставляет каскады, а привязка к
`cv2.data` хрупка между версиями). Если номер не найден — `plate_detected=False`,
изображение возвращается без блюра, продавец отмечает область вручную (§2.4).

Хранение в MinIO — забота Core API (BE-3.3), сервис остаётся stateless: принимает
байты, возвращает blurred-байты (base64) + нормализованные области [0..1].
"""

from __future__ import annotations

import base64
import os
import time

import cv2
import imagehash
import numpy as np
from PIL import Image

CASCADE_PATH = os.path.join(os.path.dirname(__file__), "cascades", "haarcascade_russian_plate_number.xml")

_cascade: cv2.CascadeClassifier | None = None


class BadImageError(ValueError):
    """Не удалось декодировать входное изображение."""


def _get_cascade() -> cv2.CascadeClassifier:
    global _cascade
    if _cascade is None:
        cascade = cv2.CascadeClassifier(CASCADE_PATH)
        if cascade.empty():
            raise RuntimeError(f"failed to load plate cascade: {CASCADE_PATH}")
        _cascade = cascade
    return _cascade


def _decode(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise BadImageError("cannot decode image bytes")
    return img


def _phash(img: np.ndarray) -> str:
    """Перцептивный хеш (64-бит, hex) оригинала — сигнатура для детекции дублей
    фото (BE-2.5/3.6). Считается по исходному изображению (BGR→RGB для PIL)."""
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    return str(imagehash.phash(pil))


def _detect_plates(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    rects = _get_cascade().detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 20)
    )
    # detectMultiScale отдаёт numpy-массив или пустой tuple
    return [tuple(int(v) for v in r) for r in rects]


def _blur_regions(img: np.ndarray, rects: list[tuple[int, int, int, int]]) -> np.ndarray:
    h_img, w_img = img.shape[:2]
    for (x, y, w, h) in rects:
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(w_img, x + w), min(h_img, y + h)
        if x1 <= x0 or y1 <= y0:
            continue
        roi = img[y0:y1, x0:x1]
        # нечётное ядро, масштабируемое к размеру области — сильный блюр номера
        k = max(11, (min(x1 - x0, y1 - y0) // 2) | 1)
        img[y0:y1, x0:x1] = cv2.GaussianBlur(roi, (k, k), 0)
    return img


def _to_normalized(rects: list[tuple[int, int, int, int]], w_img: int, h_img: int) -> list[dict]:
    return [
        {"x": x / w_img, "y": y / h_img, "width": w / w_img, "height": h / h_img}
        for (x, y, w, h) in rects
    ]


def _from_normalized(regions: list[dict], w_img: int, h_img: int) -> list[tuple[int, int, int, int]]:
    out: list[tuple[int, int, int, int]] = []
    for r in regions:
        x = int(float(r["x"]) * w_img)
        y = int(float(r["y"]) * h_img)
        w = int(float(r["width"]) * w_img)
        h = int(float(r["height"]) * h_img)
        out.append((max(0, x), max(0, y), max(1, w), max(1, h)))
    return out


def detect_and_blur(image_bytes: bytes, manual_regions: list[dict] | None = None) -> dict:
    """Задетектить (или взять переданные вручную) области госномера и заблюрить их.

    manual_regions — нормализованные [0..1] области от продавца (ручная корректировка,
    FR-03): если заданы, детекция пропускается и блюрятся ровно они. Возвращает
    { plate_detected, regions[], blurred_image_b64, processing_time_ms }.
    """
    t0 = time.perf_counter()
    img = _decode(image_bytes)
    h_img, w_img = img.shape[:2]

    if manual_regions:
        rects = _from_normalized(manual_regions, w_img, h_img)
    else:
        rects = _detect_plates(img)

    plate_detected = len(rects) > 0
    regions = _to_normalized(rects, w_img, h_img)
    # pHash считаем по оригиналу (до блюра) — блюр номера не должен ломать сигнатуру
    phash = _phash(img)
    blurred = _blur_regions(img.copy(), rects)

    ok, buf = cv2.imencode(".jpg", blurred, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise BadImageError("failed to encode blurred image")

    return {
        "plate_detected": plate_detected,
        "regions": regions,
        "phash": phash,
        "blurred_image_b64": base64.b64encode(buf.tobytes()).decode("ascii"),
        "processing_time_ms": int((time.perf_counter() - t0) * 1000),
    }

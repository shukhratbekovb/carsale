"""Тесты блюра госномера (BE-2.4)."""

import base64

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.vision.blur import BadImageError, detect_and_blur

client = TestClient(app)


def _noisy_jpeg(w: int = 200, h: int = 200) -> bytes:
    """JPEG со случайным шумом — у блюра будет что «размывать» (у сплошного цвета
    дисперсия и так 0)."""
    rng = np.random.default_rng(42)
    img = rng.integers(0, 256, size=(h, w, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def _decode_b64(b64: str) -> np.ndarray:
    arr = np.frombuffer(base64.b64decode(b64), np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def test_detect_and_blur_shape():
    res = detect_and_blur(_noisy_jpeg())
    assert set(res) == {"plate_detected", "regions", "phash", "blurred_image_b64", "processing_time_ms"}
    assert isinstance(res["plate_detected"], bool)
    assert isinstance(res["regions"], list)
    assert res["processing_time_ms"] >= 0
    # blurred_image_b64 декодируется в валидное изображение
    assert _decode_b64(res["blurred_image_b64"]) is not None


def test_manual_region_is_blurred():
    original = _noisy_jpeg(200, 200)
    # ручная область — центр кадра
    region = {"x": 0.25, "y": 0.25, "width": 0.5, "height": 0.5}
    res = detect_and_blur(original, manual_regions=[region])
    assert res["plate_detected"] is True
    assert len(res["regions"]) == 1

    orig_img = _decode_b64(base64.b64encode(original).decode())
    blur_img = _decode_b64(res["blurred_image_b64"])
    # дисперсия в центральной области после блюра заметно ниже
    def center_std(img):
        return float(img[50:150, 50:150].std())

    assert center_std(blur_img) < center_std(orig_img)


def test_manual_regions_normalized_roundtrip():
    res = detect_and_blur(_noisy_jpeg(400, 300), manual_regions=[{"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1}])
    r = res["regions"][0]
    assert 0.0 <= r["x"] <= 1.0 and 0.0 <= r["y"] <= 1.0
    assert r["width"] == pytest.approx(0.3, abs=0.02)


def test_bad_bytes_raises():
    with pytest.raises(BadImageError):
        detect_and_blur(b"not-an-image")


def test_endpoint_ok():
    res = client.post("/v1/blur", files={"file": ("car.jpg", _noisy_jpeg(), "image/jpeg")})
    assert res.status_code == 200
    body = res.json()
    assert "blurred_image_b64" in body and isinstance(body["plate_detected"], bool)


def test_endpoint_manual_regions():
    res = client.post(
        "/v1/blur",
        files={"file": ("car.jpg", _noisy_jpeg(), "image/jpeg")},
        data={"regions": '[{"x":0.3,"y":0.7,"width":0.3,"height":0.1}]'},
    )
    assert res.status_code == 200
    assert res.json()["plate_detected"] is True


def test_endpoint_empty_file():
    res = client.post("/v1/blur", files={"file": ("car.jpg", b"", "image/jpeg")})
    assert res.status_code == 400
    assert res.json()["code"] == "bad_image"


def test_endpoint_bad_regions():
    res = client.post(
        "/v1/blur",
        files={"file": ("car.jpg", _noisy_jpeg(), "image/jpeg")},
        data={"regions": "not-json"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "bad_regions"


def test_endpoint_bad_image():
    res = client.post("/v1/blur", files={"file": ("car.jpg", b"garbage-bytes", "image/jpeg")})
    assert res.status_code == 400
    assert res.json()["code"] == "bad_image"

"""Tests for the decision rule, input checks and the internal token.  Run: pytest -q"""

from __future__ import annotations

import base64
import importlib
import io
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KA = 14  # character_id of KA; class index 13


def png(size=(50, 50), mode="L", color=255) -> str:
    img = Image.new(mode, size, color)
    if mode == "L":
        for x in range(10, 40):  # a stroke of ink
            img.putpixel((x, 25), 0)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="session")
def dummy_model(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("model") / "model.onnx"
    # Reuse the tool, writing into a temp folder so a real model.onnx is never touched.
    subprocess.run([sys.executable, str(ROOT / "tools" / "make_dummy_model.py"), "--out", str(out)], check=True)
    return out


def client_with(monkeypatch, model_path: Path, token: str | None = None):
    monkeypatch.setenv("KQ_MODEL_PATH", str(model_path))
    monkeypatch.setenv("KQ_THRESHOLD", "0.8")
    if token:
        monkeypatch.setenv("KQ_INTERNAL_TOKEN", token)
    else:
        monkeypatch.delenv("KQ_INTERNAL_TOKEN", raising=False)
    sys.path.insert(0, str(ROOT))
    import app as module

    module = importlib.reload(module)
    return module, TestClient(module.app)


def force(module, index: int, p: float):
    """Make the model answer class `index` with probability `p` (the rest spread evenly)."""
    n = len(module.STATE["labels"])
    probs = np.full(n, (1 - p) / (n - 1))
    probs[index] = p
    module.STATE["model"].probabilities = lambda _x: probs


def test_health_reports_dummy(monkeypatch, dummy_model):
    module, client = client_with(monkeypatch, dummy_model)
    with client:
        h = client.get("/health").json()
    assert h["status"] == "ok" and h["dummy_model"] is True and h["classes"] == 88 and h["threshold"] == 0.8


@pytest.mark.parametrize(
    ("index", "p", "accepted", "reason"),
    [
        (13, 0.95, True, "accepted"),  # KA, confident
        (13, 0.60, False, "low_confidence"),  # KA, below the threshold
        (14, 0.95, False, "wrong_character"),  # KHA instead of KA
        (87, 0.95, False, "not_a_character"),  # reject class
    ],
)
def test_decision_rule(monkeypatch, dummy_model, index, p, accepted, reason):
    module, client = client_with(monkeypatch, dummy_model)
    with client:
        force(module, index, p)
        r = client.post("/predict", json={"image": png(), "target_character_id": KA})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["accepted"] is accepted and body["reason"] == reason
    assert body["top"][0]["probability"] == pytest.approx(p, abs=1e-4)


def test_real_inference_runs(monkeypatch, dummy_model):
    _, client = client_with(monkeypatch, dummy_model)
    with client:
        r = client.post("/predict", json={"image": png(), "target_character_id": KA})
    assert r.status_code == 200 and len(r.json()["top"]) == 3


@pytest.mark.parametrize(
    ("image", "status"),
    [("not base64!", 400), (png(size=(64, 64)), 400), (base64.b64encode(b"hello").decode(), 400)],
)
def test_bad_images(monkeypatch, dummy_model, image, status):
    _, client = client_with(monkeypatch, dummy_model)
    with client:
        assert client.post("/predict", json={"image": image, "target_character_id": KA}).status_code == status


def test_transparent_png_is_paper(monkeypatch, dummy_model):
    _, client = client_with(monkeypatch, dummy_model)
    with client:
        r = client.post("/predict", json={"image": png(mode="RGBA", color=(0, 0, 0, 0)), "target_character_id": KA})
    assert r.status_code == 200


def test_unknown_character(monkeypatch, dummy_model):
    _, client = client_with(monkeypatch, dummy_model)
    with client:
        assert client.post("/predict", json={"image": png(), "target_character_id": 999}).status_code == 400


def test_internal_token(monkeypatch, dummy_model):
    _, client = client_with(monkeypatch, dummy_model, token="s3cret-token")
    with client:
        body = {"image": png(), "target_character_id": KA}
        assert client.post("/predict", json=body).status_code == 401
        assert client.post("/predict", json=body, headers={"X-Internal-Token": "wrong"}).status_code == 401
        assert client.post("/predict", json=body, headers={"X-Internal-Token": "s3cret-token"}).status_code == 200


def test_no_model_is_503(monkeypatch, tmp_path):
    _, client = client_with(monkeypatch, tmp_path / "missing.onnx")
    with client:
        assert client.get("/health").json()["status"] == "no_model"
        assert client.post("/predict", json={"image": png(), "target_character_id": KA}).status_code == 503

"""KawiQuest recognition service (manuscript: Recognition Service, Tables 14 and 15).

POST /predict takes one 50 x 50 grayscale drawing and the character the player was asked to write, runs the CNN
(model.onnx, loaded once at startup with ONNX Runtime on the CPU) and applies the decision rule:

    accepted  <=>  the top-ranked class is the requested character  AND  its probability >= threshold

The drawing is used only for this classification and is never stored. The service binds to 127.0.0.1 and,
when KQ_INTERNAL_TOKEN is set, also requires that token, so only the application API can call it.

Run:  uvicorn app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, Header, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
MODEL_PATH = Path(os.environ.get("KQ_MODEL_PATH", HERE / "model" / "model.onnx"))
LABELS_PATH = Path(os.environ.get("KQ_LABELS_PATH", HERE / "model" / "labels.json"))
THRESHOLD = float(os.environ.get("KQ_THRESHOLD", "0.80"))
INTERNAL_TOKEN = os.environ.get("KQ_INTERNAL_TOKEN") or None
# Training convention: ink is 1.0 and paper is 0.0 after preprocessing (the web canvas and the game draw dark ink
# on white). Set KQ_INVERT=0 if the model was trained on raw grayscale (paper = 1.0).
INVERT = os.environ.get("KQ_INVERT", "1") != "0"
SIDE = 50
MAX_IMAGE_B64 = 40_000  # a 50 x 50 PNG is a few KB

log = logging.getLogger("kawiquest.recognition")


class Labels:
    """The class order shared with training (recognition/model/labels.json, written by `npm run export-labels`)."""

    def __init__(self, path: Path):
        data = json.loads(path.read_text(encoding="utf-8"))
        self.classes = sorted(data["classes"], key=lambda c: c["index"])
        if [c["index"] for c in self.classes] != list(range(len(self.classes))):
            raise ValueError(f"{path}: class indexes must be 0..n-1 with no gaps")
        self.by_character = {c["character_id"]: c["index"] for c in self.classes if c["character_id"] is not None}

    def __len__(self) -> int:
        return len(self.classes)


class Model:
    def __init__(self, path: Path, labels: Labels):
        raw = path.read_bytes()
        self.version = os.environ.get("KQ_MODEL_VERSION") or f"sha256:{hashlib.sha256(raw).hexdigest()[:12]}"
        self.session = ort.InferenceSession(raw, providers=["CPUExecutionProvider"])
        self.input = self.session.get_inputs()[0].name
        meta = self.session.get_modelmeta()
        self.dummy = "DUMMY" in (meta.description or "") or "DUMMY" in (meta.doc_string or "")
        # Check the output size against the labels once, here, rather than on every request.
        probe = self.session.run(None, {self.input: np.zeros((1, 1, SIDE, SIDE), dtype=np.float32)})[0]
        if probe.shape[-1] != len(labels):
            raise ValueError(f"model has {probe.shape[-1]} outputs but labels.json lists {len(labels)} classes")

    def probabilities(self, x: np.ndarray) -> np.ndarray:
        out = self.session.run(None, {self.input: x})[0].reshape(-1).astype(np.float64)
        # The exported CNN ends in softmax; if it returns logits instead, apply softmax here.
        if out.min() < 0 or abs(out.sum() - 1.0) > 1e-3:
            out = np.exp(out - out.max())
            out /= out.sum()
        return out


STATE: dict[str, object] = {"labels": None, "model": None, "error": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        labels = Labels(LABELS_PATH)
        STATE["labels"] = labels
        if MODEL_PATH.exists():
            model = Model(MODEL_PATH, labels)
            STATE["model"] = model
            log.info("Loaded %s (%s, %d classes)", MODEL_PATH.name, model.version, len(labels))
            if model.dummy:
                log.warning("This is the DUMMY model from tools/make_dummy_model.py: its answers are random.")
        else:
            STATE["error"] = f"No model at {MODEL_PATH}. Export model.onnx from training and restart."
            log.warning(STATE["error"])
    except Exception as exc:  # keep serving /health so the problem is visible
        STATE["error"] = f"Couldn't load the model: {exc}"
        log.exception("Model load failed")
    yield


app = FastAPI(title="KawiQuest recognition service", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)


class PredictRequest(BaseModel):
    image: Annotated[str, Field(max_length=MAX_IMAGE_B64, description="Base64 PNG, 50 x 50, grayscale or RGB.")]
    target_character_id: Annotated[int, Field(ge=1, description="kawi_characters.character_id the player was asked to write.")]


class Candidate(BaseModel):
    character_id: int | None
    label: str
    probability: float


class PredictResponse(BaseModel):
    accepted: bool
    reason: Literal["accepted", "wrong_character", "low_confidence", "not_a_character"]
    predicted: Candidate
    target_probability: float
    threshold: float
    top: list[Candidate]
    model_version: str
    latency_ms: float


def check_token(token: str | None) -> None:
    if INTERNAL_TOKEN and not (token and hmac.compare_digest(token, INTERNAL_TOKEN)):
        raise HTTPException(status_code=401, detail="Missing or wrong X-Internal-Token.")


def preprocess(image_b64: str) -> np.ndarray:
    try:
        raw = base64.b64decode(image_b64, validate=True)
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (binascii.Error, UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="image must be a base64-encoded PNG.")
    if img.size != (SIDE, SIDE):
        raise HTTPException(status_code=400, detail=f"image must be {SIDE} x {SIDE} pixels, got {img.size[0]} x {img.size[1]}.")
    if img.mode in ("RGBA", "LA") or "transparency" in img.info:
        # Transparent pixels are paper: flatten onto white before going gray.
        img = img.convert("RGBA")
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(white, img)
    x = np.asarray(img.convert("L"), dtype=np.float32) / 255.0
    if INVERT:
        x = 1.0 - x
    return x.reshape(1, 1, SIDE, SIDE)


@app.get("/health")
def health() -> dict:
    model = STATE["model"]
    labels = STATE["labels"]
    return {
        "status": "ok" if model else "no_model",
        "model_version": model.version if model else None,
        "dummy_model": bool(model and model.dummy),
        "classes": len(labels) if labels else None,
        "threshold": THRESHOLD,
        "error": STATE["error"],
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest, x_internal_token: Annotated[str | None, Header()] = None) -> PredictResponse:
    check_token(x_internal_token)
    model: Model | None = STATE["model"]  # type: ignore[assignment]
    labels: Labels | None = STATE["labels"]  # type: ignore[assignment]
    if not model or not labels:
        raise HTTPException(status_code=503, detail=STATE["error"] or "Model not loaded.")
    target_index = labels.by_character.get(body.target_character_id)
    if target_index is None:
        raise HTTPException(status_code=400, detail=f"Unknown character_id {body.target_character_id}.")

    started = time.perf_counter()
    probs = model.probabilities(preprocess(body.image))
    order = np.argsort(probs)[::-1]

    def candidate(i: int) -> Candidate:
        c = labels.classes[i]
        return Candidate(character_id=c["character_id"], label=c["transliteration"], probability=round(float(probs[i]), 4))

    top = int(order[0])
    predicted = candidate(top)
    if predicted.character_id is None:
        reason = "not_a_character"
    elif top != target_index:
        reason = "wrong_character"
    elif probs[top] < THRESHOLD:
        reason = "low_confidence"
    else:
        reason = "accepted"
    return PredictResponse(
        accepted=reason == "accepted",
        reason=reason,
        predicted=predicted,
        target_probability=round(float(probs[target_index]), 4),
        threshold=THRESHOLD,
        top=[candidate(int(i)) for i in order[:3]],
        model_version=model.version,
        latency_ms=round((time.perf_counter() - started) * 1000, 2),
    )

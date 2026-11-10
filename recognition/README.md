# KawiQuest recognition service

FastAPI service that runs the handwriting CNN (manuscript: Recognition Service, Tables 14 and 15). The application
API sends it each drawing the player submits; it answers accept or reject. Drawings are never stored.

```
POST /predict   { "image": "<base64 PNG, 50 x 50>", "target_character_id": 14 }
GET  /health    { "status": "ok" | "no_model", "model_version", "dummy_model", "classes", "threshold" }
```

**Decision rule:** accepted only when the top-ranked class is the requested character **and** its probability is at
least the threshold (`KQ_THRESHOLD`, default 0.80). Otherwise `reason` says why: `wrong_character`,
`low_confidence` or `not_a_character` (the reject class won).

## Run

```powershell
cd recognition
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q                                   # 13 tests
uvicorn app:app --host 127.0.0.1 --port 8000
```

Keep `--host 127.0.0.1`: only the application API may call it (NFR3). On a shared server, also set
`KQ_INTERNAL_TOKEN` and have the API send it as the `X-Internal-Token` header.

## The model

- Put the exported CNN at `model/model.onnx` (or set `KQ_MODEL_PATH`). It's loaded once at startup.
- Input `[1, 1, 50, 50]` float32, ink = 1.0 and paper = 0.0 (`KQ_INVERT=0` if training used raw grayscale).
  Output: one probability per class (logits also work; softmax is applied if needed).
- **Class order is `model/labels.json`**: index *i* is `character_id` *i + 1* (the 87 characters in inventory
  order) and index 87 is the reject class. Train with exactly this order. Regenerate it from the web app's seed with
  `npm run export-labels` if the inventory ever changes.
- Until the real model exists, `python tools/make_dummy_model.py` writes a random-weight stand-in with the same
  shapes, so the game and API can be wired up. `/health` reports `"dummy_model": true` while it's in place.

| Variable | Default | |
| --- | --- | --- |
| `KQ_MODEL_PATH` | `model/model.onnx` | |
| `KQ_LABELS_PATH` | `model/labels.json` | |
| `KQ_THRESHOLD` | `0.80` | tune on the validation set |
| `KQ_INVERT` | `1` | `0` if paper = 1.0 in training |
| `KQ_INTERNAL_TOKEN` | unset | required header when set |
| `KQ_MODEL_VERSION` | sha256 of the file | shown in responses |

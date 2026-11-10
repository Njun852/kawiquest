"""Write a DUMMY model.onnx so the service and the game can be wired up before the real CNN exists.

Same input and output shapes as the manuscript's CNN ([1, 1, 50, 50] in, softmax over the classes in
labels.json out), but random weights: its answers mean nothing. The service flags it on /health.

    python tools/make_dummy_model.py                    # writes model/model.onnx
    python tools/make_dummy_model.py --out other.onnx   # somewhere else
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

HERE = Path(__file__).resolve().parent.parent
SIDE = 50


def main() -> None:
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument("--out", type=Path, default=HERE / "model" / "model.onnx")
    args.add_argument("--force", action="store_true", help="overwrite an existing file")
    opts = args.parse_args()
    labels = json.loads((HERE / "model" / "labels.json").read_text(encoding="utf-8"))
    n = len(labels["classes"])
    rng = np.random.default_rng(7)
    w = rng.normal(0, 0.05, size=(SIDE * SIDE, n)).astype(np.float32)
    b = np.zeros(n, dtype=np.float32)

    graph = helper.make_graph(
        nodes=[
            helper.make_node("Flatten", ["input"], ["flat"], axis=1),
            helper.make_node("Gemm", ["flat", "W", "B"], ["logits"]),
            helper.make_node("Softmax", ["logits"], ["probabilities"], axis=1),
        ],
        name="kawiquest_dummy",
        inputs=[helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 1, SIDE, SIDE])],
        outputs=[helper.make_tensor_value_info("probabilities", TensorProto.FLOAT, [1, n])],
        initializer=[numpy_helper.from_array(w, "W"), numpy_helper.from_array(b, "B")],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], doc_string="DUMMY random-weight model for wiring tests")
    model.ir_version = 9
    onnx.checker.check_model(model)
    out: Path = opts.out
    if out.exists() and not opts.force:
        raise SystemExit(f"{out} already exists. Pass --force to overwrite it (don't overwrite a trained model).")
    onnx.save(model, out)
    print(f"Wrote DUMMY model with {n} classes to {out}")


if __name__ == "__main__":
    main()

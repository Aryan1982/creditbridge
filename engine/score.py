"""Explainable risk scorecard (numpy only).

The deployed model is a standardized logistic regression over transformed
cash-flow features (trained in ml/train_risk.py, exported to
engine/models/risk.json). Because every feature is centred on the training
population, each term `w_i · z_i` is an additive contribution to the log-odds
of default relative to an average applicant — these are the reason codes.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "models" / "risk.json"


@lru_cache(maxsize=1)
def model() -> dict:
    return json.loads(MODEL_PATH.read_text())


def transform(spec: dict, x: float) -> float:
    lo, hi = spec["clip"]
    v = min(max(float(x), lo), hi)
    if spec["transform"] == "log1p":
        v = math.log1p(v)
    return v


def contributions(values: dict, m: dict | None = None) -> dict[str, float]:
    m = m or model()
    return {f["key"]: f["weight"] * (transform(f, values[f["key"]]) - f["mean"]) / f["std"] for f in m["features"]}


def pd_to_score(pd: float, m: dict | None = None) -> int:
    s = (m or model())["scale"]
    pd = min(max(pd, 1e-6), 1 - 1e-6)
    raw = s["base_score"] + s["pdo"] / math.log(2) * (math.log((1 - pd) / pd) - math.log(s["base_odds"]))
    return int(round(min(max(raw, 300), 900)))


def band_for(pd: float, m: dict | None = None) -> str:
    for b in (m or model())["bands"]:
        if pd <= b["max_pd"]:
            return b["band"]
    return (m or model())["bands"][-1]["band"]


def decision_for(pd: float, m: dict | None = None) -> str:
    pol = (m or model())["policy"]
    if pd <= pol["approve_max_pd"]:
        return "approve"
    if pd <= pol["review_max_pd"]:
        return "review"
    return "decline"


def score(values: dict) -> dict:
    """PD, 300–900 score, band, decision and per-feature log-odds contributions."""
    m = model()
    contrib = contributions(values, m)
    logit = m["intercept"] + sum(contrib.values())
    pd = 1.0 / (1.0 + math.exp(-logit))
    return {"pd": pd, "logit": logit, "score": pd_to_score(pd, m), "band": band_for(pd, m),
            "decision": decision_for(pd, m), "contributions": contrib}

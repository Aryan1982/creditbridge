"""Train, benchmark, audit and export the cash-flow risk model.

Population: simulator applicants with seeds 0..N-1 (disjoint from the
categorizer corpus). Every statement goes through the *runtime* pipeline
(engine.categorize → engine.features), so the model is trained on exactly the
features it will see in production, including categorizer mistakes.

Benchmarks (5-fold stratified CV, out-of-fold predictions):
  * standardized logistic scorecard (deployed: additive reason codes)
  * WoE-binned logistic scorecard
  * HistGradientBoosting
Ablations: bureau-like baseline (only "has EMI" + "any bounce"), income-only,
no-balance. Fairness by gender (never a model input) and persona.
"""

from __future__ import annotations

import json
import math
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score, roc_curve
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ml"))

import simulator as S  # noqa: E402
from engine import score as SC  # noqa: E402
from engine.categorize import categorize  # noqa: E402
from engine.features import FEATURES, compute  # noqa: E402

OUT = ROOT / "engine" / "models" / "risk.json"
RESULTS = ROOT / "ml" / "results" / "risk.json"
N_APPLICANTS = 6000
SEED = 7

# key, transform, clip, expected sign of effect on PD (+1 raises risk, -1 lowers, 0 either)
SPEC = [
    ("income_monthly_median", "log1p", (0, 500_000), -1),
    ("income_cv", "identity", (0, 2.0), +1),
    ("income_months_ratio", "identity", (0, 1), -1),
    ("income_sources", "identity", (0, 5), -1),
    ("buffer_months", "log1p", (0, 12), -1),
    ("low_balance_days", "identity", (0, 1), +1),
    ("net_cashflow_ratio", "identity", (-1, 1), -1),
    ("discretionary_share", "identity", (0, 1), +1),
    ("foir", "identity", (0, 1.5), +1),
    ("bounce_rate", "log1p", (0, 10), +1),
    ("loan_app_rate", "log1p", (0, 10), +1),
    ("betting_share", "identity", (0, 0.5), +1),
    ("cash_share", "identity", (0, 1), +1),
    ("bill_regularity", "identity", (0, 1), -1),
    ("savings_rate", "identity", (0, 0.5), -1),
    ("pre_income_buffer", "log1p", (0, 10), -1),
    ("bank_charge_rate", "log1p", (0, 10), +1),
]
ACTIONABLE = {"buffer_months", "low_balance_days", "discretionary_share", "foir", "bounce_rate", "loan_app_rate",
              "betting_share", "cash_share", "bill_regularity", "savings_rate", "pre_income_buffer", "bank_charge_rate"}
BANDS = [("A", 0.06), ("B", 0.11), ("C", 0.18), ("D", 0.30), ("E", 1.0)]
POLICY = {"approve_max_pd": 0.11, "review_max_pd": 0.22}
RATES = {"A": 18.0, "B": 19.5, "C": 21.0, "D": 22.5, "E": 24.0}
SCALE = {"base_score": 650, "base_odds": 4.0, "pdo": 50}


# ----------------------------------------------------------------------------- data

def _one(seed: int) -> dict:
    p, txns, y = S.applicant(seed)
    raw = [{k: t[k] for k in ("txn_id", "date", "narration", "debit", "credit", "balance")} for t in txns]
    cat = categorize(raw)
    agree = sum(a["category"] == b["category"] for a, b in zip(txns, cat))
    f = compute(cat)
    return {"seed": seed, "persona": p.persona, "gender": p.gender, "y": y, "n_txns": len(txns), "agree": agree,
            "months": p.months, "primary_type": f["primary_type"], **f["values"]}


def build_dataset() -> pd.DataFrame:
    with Pool() as pool:
        rows = pool.map(_one, range(N_APPLICANTS), chunksize=25)
    return pd.DataFrame(rows)


def design(df: pd.DataFrame, spec=SPEC) -> np.ndarray:
    cols = []
    for key, tr, (lo, hi), _ in spec:
        v = df[key].to_numpy(dtype=float).clip(lo, hi)
        cols.append(np.log1p(v) if tr == "log1p" else v)
    return np.column_stack(cols)


# ----------------------------------------------------------------------------- models

def logit_model(C=1.0):
    return make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=2000))


def hgb_model():
    return HistGradientBoostingClassifier(max_iter=300, learning_rate=0.04, max_leaf_nodes=15, min_samples_leaf=40,
                                          l2_regularization=1.0, random_state=SEED)


class WoEScorecard:
    """Quantile-binned Weight-of-Evidence features → logistic regression."""

    def __init__(self, bins: int = 6):
        self.bins = bins

    def _woe(self, X):
        out = np.empty_like(X, dtype=float)
        for j, (edges, woe) in enumerate(self.tables):
            idx = np.clip(np.searchsorted(edges, X[:, j], side="right") - 1, 0, len(woe) - 1)
            out[:, j] = woe[idx]
        return out

    def fit(self, X, y):
        self.tables = []
        for j in range(X.shape[1]):
            edges = np.unique(np.quantile(X[:, j], np.linspace(0, 1, self.bins + 1)[:-1]))
            idx = np.clip(np.searchsorted(edges, X[:, j], side="right") - 1, 0, len(edges) - 1)
            bad = np.bincount(idx, weights=y, minlength=len(edges)) + 0.5
            good = np.bincount(idx, weights=1 - y, minlength=len(edges)) + 0.5
            self.tables.append((edges, np.log((bad / bad.sum()) / (good / good.sum()))))
        self.clf = LogisticRegression(C=1.0, max_iter=2000).fit(self._woe(X), y)
        return self

    def predict_proba(self, X):
        return self.clf.predict_proba(self._woe(X))


def oof(make, X, y) -> np.ndarray:
    p = np.zeros(len(y))
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=SEED).split(X, y):
        p[te] = make().fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    return p


def ks(y, p) -> float:
    fpr, tpr, _ = roc_curve(y, p)
    return float(np.max(tpr - fpr))


def metrics(y, p) -> dict:
    auc = roc_auc_score(y, p)
    return {"auc": round(auc, 4), "ks": round(ks(y, p), 4), "gini": round(2 * auc - 1, 4), "brier": round(brier_score_loss(y, p), 4)}


def calibration(y, p, bins=10) -> list[dict]:
    q = np.quantile(p, np.linspace(0, 1, bins + 1))
    idx = np.clip(np.searchsorted(q, p, side="right") - 1, 0, bins - 1)
    return [{"bin_pred": round(float(p[idx == b].mean()), 4), "bin_obs": round(float(y[idx == b].mean()), 4), "n": int((idx == b).sum())}
            for b in range(bins) if (idx == b).any()]


def decisions(p) -> np.ndarray:
    return np.where(p <= POLICY["approve_max_pd"], "approve", np.where(p <= POLICY["review_max_pd"], "review", "decline"))


def group_report(df, y, p, col) -> list[dict]:
    dec = decisions(p)
    out = []
    for g, idx in df.groupby(col).indices.items():
        yy, pp, dd = y[idx], p[idx], dec[idx]
        good = yy == 0
        out.append({
            col: g, "n": int(len(idx)), "default_rate": round(float(yy.mean()), 4),
            "auc": round(roc_auc_score(yy, pp), 4) if 0 < yy.sum() < len(yy) else None,
            "mean_pd": round(float(pp.mean()), 4),
            "approval_rate": round(float((dd == "approve").mean()), 4),
            "good_payer_approval_rate": round(float((dd[good] == "approve").mean()), 4),
            "approved_default_rate": round(float(yy[dd == "approve"].mean()), 4) if (dd == "approve").any() else None,
        })
    return out


# ----------------------------------------------------------------------------- fit with sign constraints

def fit_scorecard(df, y):
    """Standardized logistic; drop features whose fitted sign contradicts the
    expected direction (collinearity artefacts), so reason codes stay coherent."""
    spec = list(SPEC)
    while True:
        X = design(df, spec)
        model = logit_model().fit(X, y)
        w = model[-1].coef_[0]
        bad = [i for i, (_, _, _, sgn) in enumerate(spec) if sgn and np.sign(w[i]) != sgn]
        if not bad:
            return spec, model
        worst = max(bad, key=lambda i: abs(w[i]))
        print(f"  dropping {spec[worst][0]} (sign {w[worst]:+.3f} contradicts expected {spec[worst][3]:+d})")
        spec.pop(worst)


def export(spec, model, X) -> dict:
    sc, lr = model[0], model[-1]
    feats = []
    for i, (key, tr, clip, sgn) in enumerate(spec):
        feats.append({"key": key, "label": FEATURES[key][0], "transform": tr, "clip": list(clip),
                      "mean": round(float(sc.mean_[i]), 8), "std": round(float(sc.scale_[i]), 8),
                      "weight": round(float(lr.coef_[0][i]), 8), "actionable": key in ACTIONABLE,
                      "p05": round(float(np.quantile(X[:, i], 0.05)), 6), "p50": round(float(np.quantile(X[:, i], 0.5)), 6),
                      "p95": round(float(np.quantile(X[:, i], 0.95)), 6)})
    return {"version": "2.0", "model": "standardized logistic regression scorecard (sign-constrained)",
            "intercept": round(float(lr.intercept_[0]), 8), "features": feats,
            "scale": SCALE, "bands": [{"band": b, "max_pd": t} for b, t in BANDS], "policy": POLICY, "rates": RATES}


def main() -> dict:
    t0 = time.time()
    df = build_dataset()
    y = df["y"].to_numpy()
    print(f"dataset {len(df)} applicants, {df.n_txns.sum()} transactions, default rate {y.mean():.3f}, "
          f"categorizer agreement {df.agree.sum() / df.n_txns.sum():.4f} ({time.time() - t0:.0f}s)")
    print(df.groupby("persona").y.agg(["mean", "size"]).round(3).to_string())

    spec, final = fit_scorecard(df, y)
    X = design(df, spec)
    Xall = df[[k for k in FEATURES]].to_numpy(dtype=float)

    preds = {
        "logistic_scorecard": oof(logit_model, X, y),
        "woe_scorecard": oof(WoEScorecard, design(df), y),
        "hist_gradient_boosting": oof(hgb_model, Xall, y),
    }
    bench = {k: metrics(y, v) for k, v in preds.items()}
    for k, v in bench.items():
        print(f"  {k:24s} {v}")

    abl_specs = {
        "Bureau-like: has existing EMI + any bounce": np.column_stack([(df.emi_monthly > 0), (df.bounces > 0)]).astype(float),
        "Income only (level, variability, regularity)": design(df, [s for s in spec if s[0].startswith("income")]),
        "Cash-flow without balance features": design(df, [s for s in spec if s[0] not in ("buffer_months", "low_balance_days", "pre_income_buffer")]),
        "Full cash-flow scorecard (deployed)": X,
    }
    ablations = []
    for name, Xa in abl_specs.items():
        auc = roc_auc_score(y, oof(logit_model, Xa, y))
        ablations.append({"name": name, "auc": round(auc, 4)})
        print(f"  ablation {name:48s} AUC {auc:.4f}")

    p = preds["logistic_scorecard"]
    spec_json = export(spec, final, X)
    OUT.write_text(json.dumps(spec_json, indent=1))
    SC.model.cache_clear()

    # parity: numpy runtime scorer vs sklearn
    sk = final.predict_proba(X)[:, 1]
    rt = np.array([SC.score(r)["pd"] for r in df[[s[0] for s in spec]].to_dict("records")])
    drift = float(np.max(np.abs(sk - rt)))
    assert drift < 1e-6, f"risk scorecard parity failed: {drift}"
    print(f"parity OK: max |pd_numpy - pd_sklearn| = {drift:.2e}")

    dec = decisions(p)
    bands = np.array([SC.band_for(v) for v in p])
    band_table = [{"band": b, "n": int((bands == b).sum()), "default_rate": round(float(y[bands == b].mean()), 4) if (bands == b).any() else None,
                   "max_pd": t, "rate_pct": RATES[b]} for b, t in BANDS]
    policy = {"approve_rate": round(float((dec == "approve").mean()), 4), "review_rate": round(float((dec == "review").mean()), 4),
              "decline_rate": round(float((dec == "decline").mean()), 4),
              "approved_default_rate": round(float(y[dec == "approve"].mean()), 4),
              "declined_default_rate": round(float(y[dec == "decline"].mean()), 4), **POLICY}
    print("bands", band_table)
    print("policy", policy)

    by_persona = group_report(df, y, p, "persona")
    by_gender = group_report(df, y, p, "gender")
    ga = {g["gender"]: g for g in by_gender}
    fair_notes = (
        f"Gender is never a model input; it is simulated only to audit outcomes. Approval rate female {ga['F']['approval_rate']:.0%} vs "
        f"male {ga['M']['approval_rate']:.0%} (ratio {ga['F']['approval_rate'] / max(ga['M']['approval_rate'], 1e-9):.2f}); "
        f"approval among applicants who repaid: female {ga['F']['good_payer_approval_rate']:.0%} vs male {ga['M']['good_payer_approval_rate']:.0%}. "
        "Differences by persona mostly track genuinely different simulated default rates; seasonal (farm) income is "
        "measured on full months to avoid penalising lumpy-but-adequate earnings."
    )
    w = np.abs([f["weight"] for f in spec_json["features"]])
    importance = sorted([{"key": f["key"], "label": f["label"], "importance": round(float(wi / w.sum()), 4), "weight": f["weight"]}
                         for f, wi in zip(spec_json["features"], w)], key=lambda r: -r["importance"])

    result = {
        "data": {"n_applicants": int(len(df)), "n_transactions": int(df.n_txns.sum()), "default_rate": round(float(y.mean()), 4),
                 "default_rate_by_persona": {k: round(float(v), 4) for k, v in df.groupby("persona").y.mean().items()},
                 "categorizer_agreement_in_population": round(float(df.agree.sum() / df.n_txns.sum()), 4)},
        "model": spec_json["model"], "benchmark": bench, **bench["logistic_scorecard"],
        "calibration": calibration(y, p), "by_persona": by_persona, "by_gender": by_gender, "ablations": ablations,
        "feature_importance": importance, "bands": band_table, "policy": policy, "fairness_notes": fair_notes,
        "parity_max_abs_diff": drift, "dropped_features": [s[0] for s in SPEC if s not in spec],
    }
    RESULTS.write_text(json.dumps(result, indent=1))
    print(f"wrote {OUT} and {RESULTS} ({time.time() - t0:.0f}s)")
    return result


if __name__ == "__main__":
    main()

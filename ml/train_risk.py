"""Train, benchmark, audit and export the cash-flow risk model.

Population: simulator applicants with seeds 0..N-1 (disjoint from the
categorizer corpus). Every statement goes through the *runtime* pipeline
(engine.categorize → engine.features), so the model is trained on exactly the
features it will see in production, including categorizer mistakes.

Deployed model: L2 logistic regression on standardized features with domain
sign constraints (each coefficient may only push PD in the direction lending
logic expects, or be exactly zero), fit by L-BFGS-B. The constraint *is* the
feature selection: a candidate whose effect is not supported in the expected
direction once the others are accounted for ends at weight 0 — no greedy
deletion, nothing selected outside the fitting procedure.

Benchmarks (5-fold stratified CV, out-of-fold predictions, identical folds and
identical candidate set; every fit — scaling, sign-constrained selection, WoE
binning — happens inside the training fold):
  * sign-constrained standardized logistic scorecard (deployed: additive reason codes)
  * WoE-binned logistic scorecard
  * HistGradientBoosting
Ablations (same procedure on subsets of the candidate set): bureau-like
baseline (only "has EMI" + "any bounce"), income only, no balance features.
Decision policy: fixed a-priori PD cut-offs (business policy), not tuned on
outcomes. Fairness by gender (never a model input) and persona.
"""

from __future__ import annotations

import json
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score, roc_curve
from sklearn.model_selection import StratifiedKFold

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ml"))

import simulator as S  # noqa: E402
from engine import score as SC  # noqa: E402
from engine.categorize import categorize  # noqa: E402
from engine.features import FEATURES, MAX_BUFFER_MONTHS, MIN_INCOME, compute  # noqa: E402

OUT = ROOT / "engine" / "models" / "risk.json"
RESULTS = ROOT / "ml" / "results" / "risk.json"
N_APPLICANTS = 6000
SEED = 7
C_L2 = 1.0           # inverse L2 strength (same parameterisation as sklearn LogisticRegression)
ZERO_TOL = 1e-6      # |weight| below this after the bounded fit = feature not used

# Candidate set. key, transform, clip, expected sign of effect on PD (+1 raises risk, -1 lowers, 0 either).
# Income level is "income available for repayments" (median month; average month for seasonal farm
# income; shop receipts net of stock purchases), floored at ₹1,000 because the training population
# has no applicant without income — statements below that are handled by the no-income policy.
SPEC = [
    ("income_net_monthly", "log1p", (MIN_INCOME, 500_000), -1),
    ("income_cv", "identity", (0, 2.0), +1),
    ("income_months_ratio", "identity", (0, 1), -1),
    ("income_sources", "identity", (0, 5), -1),
    ("buffer_months", "log1p", (0, MAX_BUFFER_MONTHS), -1),
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
BALANCE_FEATURES = {"buffer_months", "low_balance_days", "pre_income_buffer"}
INCOME_FEATURES = {"income_net_monthly", "income_cv", "income_months_ratio", "income_sources"}
BANDS = [("A", 0.06), ("B", 0.11), ("C", 0.18), ("D", 0.30), ("E", 1.0)]
POLICY = {"approve_max_pd": 0.11, "review_max_pd": 0.22}
POLICY_NOTE = ("Approve/review cut-offs are fixed PD limits set as lending policy before training (approve ≤ 11%, "
               "review ≤ 22%); they are not tuned on outcomes, and all reported rates use out-of-fold PDs.")
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

class SignConstrainedLogit:
    """L2-penalised logistic regression on standardized inputs with per-coefficient sign bounds.

    Minimises  Σ logloss + ||w||² / (2C)  (intercept unpenalised) with L-BFGS-B, where
    w_j ≤ 0 if sign_j = -1, w_j ≥ 0 if sign_j = +1, free if 0. Collinear features no longer
    produce reversed reason codes, and unsupported features land exactly on the bound (0)."""

    def __init__(self, signs, C: float = C_L2):
        self.signs = np.asarray(signs)
        self.C = C

    def fit(self, X, y):
        y = np.asarray(y, dtype=float)
        self.mean_ = X.mean(axis=0)
        self.scale_ = X.std(axis=0)
        self.scale_[self.scale_ == 0] = 1.0
        Z = (X - self.mean_) / self.scale_

        def objective(theta):
            b, w = theta[0], theta[1:]
            m = b + Z @ w
            r = 1.0 / (1.0 + np.exp(-m)) - y
            loss = np.sum(np.logaddexp(0.0, m) - y * m) + 0.5 * (w @ w) / self.C
            return loss, np.concatenate([[r.sum()], Z.T @ r + w / self.C])

        bounds = [(None, None)] + [(None, 0.0) if s < 0 else (0.0, None) if s > 0 else (None, None) for s in self.signs]
        res = minimize(objective, np.zeros(Z.shape[1] + 1), jac=True, method="L-BFGS-B", bounds=bounds,
                       options={"maxiter": 10_000, "ftol": 1e-14, "gtol": 1e-9})
        if not res.success:
            raise RuntimeError(f"sign-constrained fit did not converge: {res.message}")
        self.intercept_ = float(res.x[0])
        self.coef_ = np.where(np.abs(res.x[1:]) < ZERO_TOL, 0.0, res.x[1:])
        return self

    @property
    def active(self) -> np.ndarray:
        return self.coef_ != 0.0

    def predict_proba(self, X):
        p = 1.0 / (1.0 + np.exp(-(self.intercept_ + ((X - self.mean_) / self.scale_) @ self.coef_)))
        return np.column_stack([1 - p, p])


def scorecard(spec=SPEC):
    return lambda: SignConstrainedLogit([s[3] for s in spec])


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


FOLDS = StratifiedKFold(5, shuffle=True, random_state=SEED)


def oof(make, X, y) -> tuple[np.ndarray, list]:
    """Out-of-fold PDs; every model (incl. scaling and selection) is fit on the training fold only."""
    p, models = np.zeros(len(y)), []
    for tr, te in FOLDS.split(X, y):
        m = make().fit(X[tr], y[tr])
        p[te] = m.predict_proba(X[te])[:, 1]
        models.append(m)
    return p, models


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


# ----------------------------------------------------------------------------- export

def export(model: SignConstrainedLogit, X) -> dict:
    """Runtime scorecard: only features with a non-zero weight (dropping zero-weight columns
    leaves every prediction unchanged)."""
    feats = []
    for i, (key, tr, clip, sgn) in enumerate(SPEC):
        if not model.active[i]:
            continue
        feats.append({"key": key, "label": FEATURES[key][0], "transform": tr, "clip": list(clip),
                      "mean": round(float(model.mean_[i]), 8), "std": round(float(model.scale_[i]), 8),
                      "weight": round(float(model.coef_[i]), 8), "expected_sign": sgn, "actionable": key in ACTIONABLE,
                      "p05": round(float(np.quantile(X[:, i], 0.05)), 6), "p50": round(float(np.quantile(X[:, i], 0.5)), 6),
                      "p95": round(float(np.quantile(X[:, i], 0.95)), 6)})
    return {"version": "2.1", "model": "sign-constrained L2 logistic regression scorecard (standardized features)",
            "intercept": round(float(model.intercept_), 8), "features": feats,
            "scale": SCALE, "bands": [{"band": b, "max_pd": t} for b, t in BANDS], "policy": POLICY, "rates": RATES}


def main() -> dict:
    t0 = time.time()
    df = build_dataset()
    y = df["y"].to_numpy()
    print(f"dataset {len(df)} applicants, {df.n_txns.sum()} transactions, default rate {y.mean():.3f}, "
          f"categorizer agreement {df.agree.sum() / df.n_txns.sum():.4f} ({time.time() - t0:.0f}s)")
    print(df.groupby("persona").y.agg(["mean", "size"]).round(3).to_string())

    X = design(df)
    p, fold_models = oof(scorecard(), X, y)
    preds = {
        "logistic_scorecard": p,
        "woe_scorecard": oof(WoEScorecard, X, y)[0],
        "hist_gradient_boosting": oof(hgb_model, X, y)[0],
    }
    bench = {k: metrics(y, v) for k, v in preds.items()}
    for k, v in bench.items():
        print(f"  {k:24s} {v}")
    stability = {key: round(float(np.mean([m.active[i] for m in fold_models])), 2) for i, (key, *_) in enumerate(SPEC)}

    def subset(keep):
        return [s for s in SPEC if keep(s[0])]

    abl_specs = {
        "Bureau-like: has existing EMI + any bounce": (
            np.column_stack([(df.emi_monthly > 0), (df.bounces > 0)]).astype(float), [+1, +1]),
        "Income only: level, variability, regularity, sources": subset(lambda k: k in INCOME_FEATURES),
        "Cash-flow without balance features": subset(lambda k: k not in BALANCE_FEATURES),
        f"Full cash-flow candidate set ({len(SPEC)} features, deployed)": SPEC,
    }
    ablations = []
    for name, spec in abl_specs.items():
        Xa, signs = spec if isinstance(spec, tuple) else (design(df, spec), [s[3] for s in spec])
        auc = roc_auc_score(y, oof(lambda: SignConstrainedLogit(signs), Xa, y)[0])
        ablations.append({"name": name, "auc": round(auc, 4), "n_features": int(Xa.shape[1])})
        print(f"  ablation {name:56s} AUC {auc:.4f}")

    final = SignConstrainedLogit([s[3] for s in SPEC]).fit(X, y)
    for (key, *_), w in zip(SPEC, final.coef_):
        print(f"  {key:24s} weight {w:+.4f}  active in {stability[key]:.0%} of CV folds")
    spec_json = export(final, X)
    OUT.write_text(json.dumps(spec_json, indent=1))
    SC.model.cache_clear()

    # parity: numpy runtime scorer (active features only) vs the trained model on all candidates
    fitted = final.predict_proba(X)[:, 1]
    rt = np.array([SC.score(r)["pd"] for r in df[[s[0] for s in SPEC]].to_dict("records")])
    drift = float(np.max(np.abs(fitted - rt)))
    assert drift < 1e-6, f"risk scorecard parity failed: {drift}"
    print(f"parity OK: max |pd_numpy - pd_trained| = {drift:.2e}")

    dec = decisions(p)
    bands = np.array([SC.band_for(v) for v in p])
    band_table = [{"band": b, "n": int((bands == b).sum()), "default_rate": round(float(y[bands == b].mean()), 4) if (bands == b).any() else None,
                   "max_pd": t, "rate_pct": RATES[b]} for b, t in BANDS]
    policy = {"approve_rate": round(float((dec == "approve").mean()), 4), "review_rate": round(float((dec == "review").mean()), 4),
              "decline_rate": round(float((dec == "decline").mean()), 4),
              "approved_default_rate": round(float(y[dec == "approve"].mean()), 4),
              "declined_default_rate": round(float(y[dec == "decline"].mean()), 4), **POLICY, "note": POLICY_NOTE}
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
        "measured on the average month to avoid penalising lumpy-but-adequate earnings."
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
        "parity_max_abs_diff": drift,
        "candidate_features": [s[0] for s in SPEC],
        "zero_weight_features": [s[0] for s, a in zip(SPEC, final.active) if not a],
        "selection_stability": stability,
        "regularization": {"penalty": "L2", "C": C_L2},
    }
    RESULTS.write_text(json.dumps(result, indent=1))
    print(f"wrote {OUT} and {RESULTS} ({time.time() - t0:.0f}s)")
    return result


if __name__ == "__main__":
    main()

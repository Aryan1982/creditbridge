"""CreditBridge training pipeline.

Trains an explainable logistic-regression scorecard on the Statlog German Credit
dataset (OpenML `credit-g`), benchmarks it against gradient boosting and against
bureau-only / alternative-data-only feature sets, audits fairness, and exports a
self-contained model JSON consumed by the browser app in ../public.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.datasets import fetch_openml
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

SEED = 42
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "model.json"

# Features a traditional credit bureau would hold.
BUREAU = ["credit_history", "existing_credits", "other_payment_plans"]
# Alternative / non-bureau signals: banking behaviour, savings, employment,
# housing stability, phone ownership, assets, and the loan request itself.
ALTERNATIVE = [
    "checking_status",
    "savings_status",
    "employment",
    "residence_since",
    "property_magnitude",
    "housing",
    "job",
    "num_dependents",
    "own_telephone",
    "duration",
    "credit_amount",
    "installment_commitment",
    "purpose",
    "other_parties",
    "age",
]
# Protected attributes are excluded from the model and used only for auditing.
PROTECTED = ["personal_status", "foreign_worker"]
THIN_FILE = {"no credits/all paid", "all paid"}


def load() -> tuple[pd.DataFrame, np.ndarray]:
    data = fetch_openml("credit-g", version=1, as_frame=True)
    df = data.frame.copy()
    y = (df.pop("class").astype(str) == "bad").astype(int).to_numpy()
    for col in df.columns:
        if isinstance(df[col].dtype, pd.CategoricalDtype) or df[col].dtype == object:
            df[col] = df[col].astype(str)
        else:
            df[col] = df[col].astype(float)
    return df, y


def split_types(df: pd.DataFrame, cols: list[str]) -> tuple[list[str], list[str]]:
    cat = [c for c in cols if df[c].dtype == object]
    num = [c for c in cols if c not in cat]
    return cat, num


def logreg(df: pd.DataFrame, cols: list[str]) -> Pipeline:
    cat, num = split_types(df, cols)
    pre = ColumnTransformer(
        [
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat),
            ("num", "passthrough", num),
        ]
    )
    return Pipeline(
        [
            ("pre", pre),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(C=0.3, max_iter=2000, class_weight="balanced")),
        ]
    )


def gbm(df: pd.DataFrame, cols: list[str]) -> Pipeline:
    cat, num = split_types(df, cols)
    pre = ColumnTransformer(
        [
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat),
            ("num", "passthrough", num),
        ]
    )
    clf = HistGradientBoostingClassifier(
        max_iter=300,
        learning_rate=0.04,
        max_leaf_nodes=15,
        l2_regularization=1.0,
        categorical_features=list(range(len(cat))),
        class_weight="balanced",
        random_state=SEED,
    )
    return Pipeline([("pre", pre), ("clf", clf)])


def ks_stat(y: np.ndarray, p: np.ndarray) -> float:
    fpr, tpr, _ = roc_curve(y, p)
    return float(np.max(tpr - fpr))


def youden_threshold(y: np.ndarray, p: np.ndarray) -> float:
    fpr, tpr, thr = roc_curve(y, p)
    return float(thr[np.argmax(tpr - fpr)])


def scores(y: np.ndarray, p: np.ndarray, thr: float) -> dict:
    pred = (p >= thr).astype(int)
    return {
        "roc_auc": round(roc_auc_score(y, p), 4),
        "ks": round(ks_stat(y, p), 4),
        "brier": round(brier_score_loss(y, p), 4),
        "accuracy": round(accuracy_score(y, pred), 4),
        "f1_bad": round(f1_score(y, pred), 4),
    }


def oof(model: Pipeline, X: pd.DataFrame, y: np.ndarray) -> np.ndarray:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    return cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]


def fairness(df: pd.DataFrame, y: np.ndarray, p: np.ndarray, thr: float) -> dict:
    approve = p < thr
    groups = {
        "sex": np.where(df["personal_status"].str.startswith("female"), "female", "male"),
        "age": np.where(df["age"] < 25, "under_25", "25_plus"),
    }
    report = {}
    for name, g in groups.items():
        rows = {}
        for value in np.unique(g):
            m = g == value
            good = m & (y == 0)
            rows[value] = {
                "n": int(m.sum()),
                "approval_rate": round(float(approve[m].mean()), 4),
                # Equal opportunity: share of genuinely good payers who get approved.
                "good_payer_approval_rate": round(float(approve[good].mean()), 4),
            }
        rates = [r["approval_rate"] for r in rows.values()]
        tprs = [r["good_payer_approval_rate"] for r in rows.values()]
        report[name] = {
            "groups": rows,
            "demographic_parity_ratio": round(min(rates) / max(rates), 4),
            "equal_opportunity_diff": round(max(tprs) - min(tprs), 4),
        }
    return report


def export_scorecard(model: Pipeline, df: pd.DataFrame, cols: list[str]) -> dict:
    """Decompose the fitted standardized logit into per-feature contributions.

    logit(x) = b0 + sum_j w_j * (x_j - mu_j) / sd_j, so every raw feature gets an
    additive contribution (exact SHAP values for a linear model with
    independent features). Categorical features precompute one value per level.
    """
    pre = model.named_steps["pre"]
    scale = model.named_steps["scale"]
    clf = model.named_steps["clf"]
    w = clf.coef_[0] / scale.scale_
    mu = scale.mean_
    cat, num = split_types(df, cols)
    enc = pre.named_transformers_["cat"]

    features = {}
    k = 0
    for col, levels in zip(cat, enc.categories_):
        n = len(levels)
        wk, mk = w[k : k + n], mu[k : k + n]
        base = -float(np.dot(wk, mk))
        features[col] = {
            "type": "cat",
            "levels": {str(lv): round(base + float(wk[i]), 5) for i, lv in enumerate(levels)},
        }
        k += n
    for col in num:
        features[col] = {
            "type": "num",
            "weight": round(float(w[k]), 6),
            "mean": round(float(mu[k]), 4),
            "min": float(df[col].min()),
            "max": float(df[col].max()),
        }
        k += 1
    return {"intercept": round(float(clf.intercept_[0]), 5), "features": features}


def main() -> None:
    df, y = load()
    combined = BUREAU + ALTERNATIVE
    X = df[combined]

    candidates = {
        "logreg_combined": (logreg(df, combined), combined),
        "gbm_combined": (gbm(df, combined), combined),
        "logreg_bureau_only": (logreg(df, BUREAU), BUREAU),
        "logreg_alternative_only": (logreg(df, ALTERNATIVE), ALTERNATIVE),
    }
    preds, metrics = {}, {}
    for name, (model, cols) in candidates.items():
        p = oof(model, df[cols], y)
        preds[name] = p
        metrics[name] = scores(y, p, youden_threshold(y, p))
        print(f"{name:26s} {metrics[name]}")

    p = preds["logreg_combined"]
    thr = youden_threshold(y, p)
    thin = df["credit_history"].isin(THIN_FILE).to_numpy()
    thin_metrics = {
        "n": int(thin.sum()),
        "bad_rate": round(float(y[thin].mean()), 4),
        **{
            name: round(roc_auc_score(y[thin], preds[name][thin]), 4)
            for name in ("logreg_combined", "logreg_bureau_only", "logreg_alternative_only")
        },
    }
    print("thin-file AUC", thin_metrics)
    fair = fairness(df, y, p, thr)
    print("fairness", json.dumps(fair, indent=1))

    final = logreg(df, combined).fit(X, y)
    scorecard = export_scorecard(final, df, combined)

    # Sanity check: exported JSON scorecard reproduces sklearn probabilities.
    logits = np.full(len(df), scorecard["intercept"])
    for col, spec in scorecard["features"].items():
        if spec["type"] == "cat":
            logits += df[col].map(spec["levels"]).to_numpy()
        else:
            logits += spec["weight"] * (df[col].to_numpy() - spec["mean"])
    drift = np.max(np.abs(1 / (1 + np.exp(-logits)) - final.predict_proba(X)[:, 1]))
    assert drift < 1e-3, f"exported scorecard drifted from sklearn model: {drift}"

    OUT.write_text(
        json.dumps(
            {
                "dataset": "Statlog German Credit (OpenML credit-g), 1000 applicants, 30% default",
                "threshold": round(thr, 4),
                "bureau_features": BUREAU,
                "alternative_features": ALTERNATIVE,
                "excluded_protected": PROTECTED,
                "scorecard": scorecard,
                "metrics": {
                    "cv": "5-fold stratified, out-of-fold",
                    "models": metrics,
                    "thin_file_auc": thin_metrics,
                    "fairness": fair,
                },
            },
            indent=1,
        )
    )
    print(f"wrote {OUT} (export drift {drift:.2e})")


if __name__ == "__main__":
    main()

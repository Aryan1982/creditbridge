"""Train the narration → category model and export it for numpy inference.

* Corpus: statements from simulator applicants disjoint from the risk-model
  population (seed range 2_000_000+).
* Evaluation: hold out ~25% of merchants / counterparties *per category*
  (group split), so test narrations come from merchants, employers, platforms,
  lenders and people the model never saw. A counterparty held out for one
  category is held out for all, so the realised test share of rows is larger
  (reported in `eval`). Bank-system narrations without a counterparty (ATM,
  charges, interest, cash deposits) are split by row.
* Export: vocabulary, idf, coefficients → engine/models/categorizer.json, then
  assert the numpy re-implementation matches sklearn's predict_proba.
"""

from __future__ import annotations

import json
import sys
import time
from collections import defaultdict
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ml"))

from engine import categorize as C  # noqa: E402
import simulator as S  # noqa: E402

OUT = ROOT / "engine" / "models" / "categorizer.json"
RESULTS = ROOT / "ml" / "results" / "categorizer.json"
N_APPLICANTS = 1500
SEED0 = 2_000_000
MAX_PER_CLASS = 12_000
TEST_SHARE = 0.25


def _rows(seed: int) -> list[tuple[str, str, str]]:
    _, txns, _ = S.applicant(seed)
    return [(C.make_doc(C.normalize(t["narration"]), t["credit"] > 0), t["category"], t["group"]) for t in txns]


def corpus() -> list[tuple[str, str, str]]:
    with Pool() as pool:
        chunks = pool.map(_rows, range(SEED0, SEED0 + N_APPLICANTS), chunksize=20)
    seen, rows = set(), []
    for chunk in chunks:
        for doc, cat, grp in chunk:
            if (doc, cat) not in seen:
                seen.add((doc, cat))
                rows.append((doc, cat, grp))
    rng = np.random.default_rng(0)
    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r[1]].append(r)
    out = []
    for cat, rs in by_cat.items():
        if len(rs) > MAX_PER_CLASS:
            rs = [rs[i] for i in rng.choice(len(rs), MAX_PER_CLASS, replace=False)]
        out.extend(rs)
    return out


def group_split(rows) -> np.ndarray:
    """Boolean test mask: hold out whole merchants/counterparties per category."""
    rng = np.random.default_rng(1)
    test = np.zeros(len(rows), dtype=bool)
    groups_by_cat = defaultdict(set)
    for doc, cat, grp in rows:
        if not grp.startswith("x:"):
            groups_by_cat[cat].add(grp)
    held = set()
    for cat, groups in groups_by_cat.items():
        groups = sorted(groups)
        if len(groups) < 2:
            continue
        k = max(1, int(round(len(groups) * TEST_SHARE)))
        held.update((cat, g) for g in rng.choice(groups, k, replace=False))
    held_groups = {g for _, g in held}
    for i, (doc, cat, grp) in enumerate(rows):
        if grp.startswith("x:"):
            test[i] = rng.random() < TEST_SHARE
        else:
            test[i] = grp in held_groups
    return test


def fit(docs, y):
    vec = TfidfVectorizer(analyzer=C.analyzer, sublinear_tf=True, min_df=3, max_features=12_000, dtype=np.float64)
    X = vec.fit_transform(docs)
    clf = LogisticRegression(C=8.0, max_iter=400, tol=1e-4)
    clf.fit(X, y)
    return vec, clf


def export(vec, clf) -> dict:
    vocab = [None] * len(vec.vocabulary_)
    for t, i in vec.vocabulary_.items():
        vocab[i] = t
    classes = list(clf.classes_)
    order = [classes.index(c) for c in C.CATEGORIES if c in classes]
    return {
        "categories": [classes[i] for i in order],
        "vocab": vocab,
        "idf": [round(float(v), 6) for v in vec.idf_],
        "coef": [[round(float(v), 5) for v in clf.coef_[i]] for i in order],
        "intercept": [round(float(clf.intercept_[i]), 6) for i in order],
        "meta": {"model": "char 3-5gram + word TF-IDF (sublinear, l2) → multinomial logistic regression",
                 "n_features": len(vocab)},
    }, order


def main() -> dict:
    t0 = time.time()
    rows = corpus()
    docs = [r[0] for r in rows]
    y = np.array([r[1] for r in rows])
    test = group_split(rows)
    print(f"corpus {len(rows)} unique narrations, test {test.sum()} (held-out merchants), {time.time() - t0:.0f}s")

    vec, clf = fit([d for d, m in zip(docs, test) if not m], y[~test])
    Xte = vec.transform([d for d, m in zip(docs, test) if m])
    pred = clf.predict(Xte)
    acc = accuracy_score(y[test], pred)
    macro = f1_score(y[test], pred, average="macro")
    rep = classification_report(y[test], pred, output_dict=True, zero_division=0)
    per_class = [{"category": c, "f1": round(rep[c]["f1-score"], 4), "support": int(rep[c]["support"])}
                 for c in C.CATEGORIES if c in rep]
    print(f"held-out merchants: accuracy {acc:.4f} macro-F1 {macro:.4f}")
    for pc in sorted(per_class, key=lambda r: r["f1"]):
        print(f"  {pc['category']:20s} f1 {pc['f1']:.3f} n={pc['support']}")

    # parity: numpy reimplementation vs sklearn on the held-out split
    spec, order = export(vec, clf)
    tmp = OUT.with_suffix(".eval.json")
    tmp.write_text(json.dumps(spec))
    model = C.Categorizer(tmp)
    test_docs = [d for d, m in zip(docs, test) if m]
    sk = clf.predict_proba(Xte)[:, order]
    npy = model.predict_proba(test_docs)
    drift = float(np.max(np.abs(sk - npy)))
    tmp.unlink()
    assert drift < 1e-3, f"categorizer parity failed: max |Δp| = {drift}"
    print(f"parity OK: max |p_numpy - p_sklearn| = {drift:.2e} on {len(test_docs)} narrations")

    # final model on all data
    vec, clf = fit(docs, y)
    spec, order = export(vec, clf)
    OUT.write_text(json.dumps(spec, separators=(",", ":")))
    model = C.Categorizer(OUT)
    sample = docs[:: max(1, len(docs) // 5000)]
    drift_full = float(np.max(np.abs(clf.predict_proba(vec.transform(sample))[:, order] - model.predict_proba(sample))))
    assert drift_full < 1e-3, f"exported categorizer drifted: {drift_full}"
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB), export parity {drift_full:.2e}")

    result = {
        "model": spec["meta"]["model"],
        "accuracy": round(acc, 4), "macro_f1": round(macro, 4),
        "eval": (f"held-out unseen merchants/counterparties: about {TEST_SHARE:.0%} of the merchants in each category are "
                 f"never seen in training (a merchant held out in one category is held out everywhere), giving a "
                 f"test set of {int(test.sum()):,} narrations, {test.mean():.0%} of all rows"),
        "n_train": int((~test).sum()), "n_test": int(test.sum()), "n_features": spec["meta"]["n_features"],
        "per_class": per_class, "parity_max_abs_diff": drift,
    }
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    main()

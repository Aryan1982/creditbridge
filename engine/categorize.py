"""Transaction categorizer: narration text → spending / income category.

Runtime re-implementation (numpy + stdlib only) of the model trained in
ml/train_categorizer.py: a character n-gram + word TF-IDF representation
(sublinear tf, l2-normalised) feeding a multinomial logistic regression.
`analyzer()` is the *same* function sklearn's TfidfVectorizer calls during
training, so tokenisation cannot drift between training and serving.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "models" / "categorizer.json"

CATEGORIES = [
    "salary", "gig_income", "business_income", "agri_income", "family_transfer_in", "refund_cashback",
    "interest_in", "rent", "groceries", "utilities", "mobile_recharge", "fuel_transport", "food_delivery",
    "shopping", "healthcare", "education", "emi_loan", "loan_app", "insurance", "investment_savings",
    "betting_gaming", "cash_withdrawal", "bank_charges", "bounce_charge", "transfer_out", "transfer_in_other",
    "other",
]
LABELS = {
    "salary": "Salary", "gig_income": "Gig platform payouts", "business_income": "Business sales",
    "agri_income": "Farm income", "family_transfer_in": "Family & support transfers", "refund_cashback": "Refunds & cashback",
    "interest_in": "Interest earned", "rent": "Rent", "groceries": "Groceries", "utilities": "Utilities & bills",
    "mobile_recharge": "Mobile recharge", "fuel_transport": "Fuel & transport", "food_delivery": "Food delivery & eating out",
    "shopping": "Shopping", "healthcare": "Healthcare", "education": "Education", "emi_loan": "Loan EMIs",
    "loan_app": "Instant loan apps", "insurance": "Insurance", "investment_savings": "Savings & investments",
    "betting_gaming": "Betting & real-money gaming", "cash_withdrawal": "Cash withdrawals", "bank_charges": "Bank charges",
    "bounce_charge": "Bounced payment charges", "transfer_out": "Transfers to people", "transfer_in_other": "Other money received",
    "other": "Other",
}
INCOME_CATEGORIES = {"salary", "gig_income", "business_income", "agri_income", "family_transfer_in"}

_DIGITS = re.compile(r"\d+")
_SPLIT = re.compile(r"[^a-z0]+")


def make_doc(narration: str, is_credit: bool) -> str:
    """Model input: transaction direction + raw narration."""
    return ("C|" if is_credit else "D|") + (narration or "")


def normalize(text: str) -> str:
    return _DIGITS.sub("0", text.lower())


def analyzer(doc: str) -> list[str]:
    """Tokens for one document: direction, words, direction×word, char 3–5 grams."""
    d = doc[0]
    words = [w for w in _SPLIT.split(normalize(doc[2:])) if w]
    out = ["dir=" + d]
    for w in words:
        out.append("w=" + w)
        out.append(d + ":" + w)
        if len(w) < 3:
            continue
        pw = f" {w} "
        n_len = len(pw)
        for n in (3, 4, 5):
            for i in range(0, n_len - n + 1):
                out.append(pw[i:i + n])
    return out


class Categorizer:
    def __init__(self, path: Path = MODEL_PATH):
        spec = json.loads(Path(path).read_text())
        self.categories: list[str] = spec["categories"]
        self.vocab = {t: i for i, t in enumerate(spec["vocab"])}
        self.idf = np.asarray(spec["idf"], dtype=np.float64)
        self.coef_t = np.asarray(spec["coef"], dtype=np.float64).T.copy()  # (V, K)
        self.intercept = np.asarray(spec["intercept"], dtype=np.float64)
        self.meta = spec.get("meta", {})

    def _vector(self, doc: str) -> tuple[np.ndarray, np.ndarray]:
        counts: dict[int, int] = {}
        vocab = self.vocab
        for tok in analyzer(doc):
            j = vocab.get(tok)
            if j is not None:
                counts[j] = counts.get(j, 0) + 1
        if not counts:
            return np.zeros(0, dtype=np.int64), np.zeros(0)
        idx = np.fromiter(counts.keys(), dtype=np.int64, count=len(counts))
        tf = np.fromiter(counts.values(), dtype=np.float64, count=len(counts))
        val = (1.0 + np.log(tf)) * self.idf[idx]
        val /= np.sqrt(np.dot(val, val))
        return idx, val

    def proba_doc(self, doc: str) -> np.ndarray:
        idx, val = self._vector(doc)
        logits = self.intercept + (val @ self.coef_t[idx] if len(idx) else 0.0)
        logits = logits - logits.max()
        e = np.exp(logits)
        return e / e.sum()

    def predict_proba(self, docs: list[str]) -> np.ndarray:
        return np.vstack([self.proba_doc(d) for d in docs]) if docs else np.zeros((0, len(self.categories)))


@lru_cache(maxsize=1)
def _model() -> Categorizer:
    return Categorizer()


@lru_cache(maxsize=200_000)
def _classify_key(key: str) -> tuple[str, float]:
    m = _model()
    p = m.proba_doc(key)
    k = int(np.argmax(p))
    return m.categories[k], float(p[k])


def classify(narration: str, is_credit: bool) -> tuple[str, float]:
    """(category, confidence) for one transaction. Cached on the
    digit-normalised narration, which is all the model sees."""
    return _classify_key(make_doc(normalize(narration or ""), is_credit))


def categorize(transactions: list[dict]) -> list[dict]:
    """Return copies of transactions with `category` and `confidence` added."""
    out = []
    for t in transactions:
        credit = float(t.get("credit") or 0) > 0
        cat, conf = classify(t.get("narration") or "", credit)
        out.append({**t, "category": cat, "confidence": round(conf, 4)})
    return out

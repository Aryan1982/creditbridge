import math
import sys

import pytest

from engine import score as sc
from engine.analyze import analyze
from engine.categorize import classify

LOAN = {"amount": 50000.0, "tenure_months": 12, "purpose": "personal"}


def test_runtime_never_imports_training_libraries(ravi):
    analyze(ravi[0], LOAN, ravi[1])
    assert not {"sklearn", "pandas", "scipy"} & set(sys.modules)


@pytest.mark.parametrize("narration,credit,category", [
    ("NEFT CR-HDFC0000123-INFOSYS LIMITED-SALARY OCT", True, "salary"),
    ("ACH D- BAJAJ FINANCE LTD-0000881234", False, "emi_loan"),
    ("ATM WDL/SBI ATM HYD 0042/412345", False, "cash_withdrawal"),
])
def test_categorizer_common_narrations(narration, credit, category):
    assert classify(narration, credit)[0] == category


def test_score_scale_is_monotonic_and_bounded():
    pds = [0.01, 0.05, 0.1, 0.2, 0.4, 0.8]
    scores = [sc.pd_to_score(p) for p in pds]
    assert scores == sorted(scores, reverse=True)
    assert all(300 <= s <= 900 for s in scores)


def test_bands_and_decisions_follow_pd():
    bands = [sc.band_for(p) for p in (0.01, 0.09, 0.15, 0.25, 0.6)]
    assert bands == ["A", "B", "C", "D", "E"]
    assert [sc.decision_for(p) for p in (0.05, 0.15, 0.5)] == ["approve", "review", "decline"]


def test_reason_codes_sum_to_the_model_logit(ravi):
    report = analyze(ravi[0], LOAN, ravi[1])
    m = sc.model()
    logit = m["intercept"] + sum(f["impact"] for f in report["features"] if f["key"] in {x["key"] for x in m["features"]})
    assert math.isclose(1 / (1 + math.exp(-logit)), report["risk"]["pd"], abs_tol=1e-3)


def test_improvements_raise_the_score(ravi):
    report = analyze(ravi[0], LOAN, ravi[1])
    after = [i["score_after"] for i in report["improvements"]]
    assert after and after == sorted(after)
    assert after[0] > report["risk"]["score"]


def test_affordability_caps_emi_by_income(ravi):
    big = analyze(ravi[0], {**LOAN, "amount": 5_000_000.0}, ravi[1])["affordability"]
    small = analyze(ravi[0], LOAN, ravi[1])["affordability"]
    assert big["max_emi"] == small["max_emi"]
    assert not big["within_limit"] and small["within_limit"]
    assert big["recommended_amount"] < 5_000_000


def test_round_tripped_credits_are_not_income():
    from conftest import TAMPERED, load
    from engine.integrity import check_integrity

    sample = next(s for s in TAMPERED if s["id"] == "ravi_gig-roundtrip")
    txns, meta = load(sample)
    integrity = check_integrity(txns, meta)
    flagged = analyze(txns, LOAN, {**meta, "integrity": integrity})
    assert flagged["risk"]["decision"] != "approve"


def _statement(salary: float, months: int = 7, opening: float = 70_000.0) -> list[dict]:
    """Synthetic statement: monthly salary (optional), rent, power, phone, groceries, food delivery."""
    from datetime import date

    txns, bal = [], opening

    def add(d, narration, debit=0.0, credit=0.0):
        nonlocal bal
        bal += credit - debit
        txns.append({"txn_id": f"T{len(txns)}", "date": d.isoformat(), "narration": narration,
                     "debit": debit, "credit": credit, "balance": round(bal, 2)})

    for m in range(months):
        ms = date(2026, 1 + m, 1)
        if salary:
            add(ms, "NEFT CR-HDFC0000001-ACME SOFTWARE PVT LTD-SALARY", credit=salary)
        add(ms.replace(day=3), "ACH/DR/RENT/NOBROKER", debit=9000)
        add(ms.replace(day=5), "BBPS/BESCOM ELECTRICITY BILL", debit=1200)
        add(ms.replace(day=7), "UPI/DR/412345678901/AIRTEL PREPAID/YESB/airtel@ybl", debit=299)
        for k in range(8):
            add(ms.replace(day=9 + 2 * k), f"UPI/DR/41234567{k:04d}/DMART/YESB/dmart@ybl", debit=900)
        add(ms.replace(day=27), "UPI/DR/412399999999/ZOMATO/YESB/zomato@ybl", debit=450)
    return txns


def test_deployed_weights_respect_domain_signs():
    for f in sc.model()["features"]:
        assert f["weight"] != 0 and f["weight"] * f["expected_sign"] >= 0, f["key"]


def test_no_income_statement_scores_far_below_a_steady_salary():
    salaried = analyze(_statement(30_000), LOAN, {})
    no_income = analyze(_statement(0, opening=200_000), LOAN, {})
    assert salaried["risk"]["score"] - no_income["risk"]["score"] >= 100
    assert no_income["risk"]["decision"] == "decline" and "No regular income" in no_income["risk"]["decision_note"]
    assert no_income["affordability"]["recommended_amount"] == 0 and no_income["improvements"] == []
    summary = no_income["summary"]["en"]
    assert "₹0 a month" not in summary and "Existing EMIs" not in summary
    feats = {f["key"]: f["value"] for f in no_income["features"]}
    assert feats["net_cashflow_ratio"] == -1.0 and feats["buffer_months"] == 0.0
    assert no_income["risk"]["reasons"][0]["key"] == "income_net_monthly"
    assert all("months of income" not in r["detail"] for r in no_income["risk"]["reasons"])


def test_short_history_is_never_auto_approved_and_amount_is_capped():
    two_rows = [
        {"txn_id": "1", "date": "2026-03-01", "narration": "NEFT CR-HDFC0000001-ACME SOFTWARE PVT LTD-SALARY",
         "debit": 0.0, "credit": 60_000.0, "balance": 250_000.0},
        {"txn_id": "2", "date": "2026-03-02", "narration": "ACH/DR/ZERODHA SIP", "debit": 5000.0, "credit": 0.0,
         "balance": 245_000.0},
    ]
    report = analyze(two_rows, {**LOAN, "amount": 200_000.0}, {})
    assert report["risk"]["decision"] != "approve"
    assert "history" in report["risk"]["decision_note"]
    assert 0 < report["affordability"]["recommended_amount"] <= 25_000


def test_income_sources_add_up_to_monthly_income(ravi):
    income = analyze(ravi[0], LOAN, ravi[1])["income"]
    assert abs(sum(s["monthly_avg"] for s in income["sources"]) - income["monthly_avg"]) <= 0.05 * income["monthly_avg"]


def test_transaction_count_is_the_full_statement(ravi):
    report = analyze(ravi[0] * 3, LOAN, ravi[1])
    assert report["applicant"]["transaction_count"] == 3 * len(ravi[0])
    assert len(report["transactions"]) == min(500, 3 * len(ravi[0]))

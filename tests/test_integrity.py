import copy

import pytest

from conftest import CLEAN, TAMPERED, load
from engine.integrity import check_integrity, failed_problems


def statuses(report):
    return {c["id"]: c["status"] for c in report["checks"]}


@pytest.mark.parametrize("sample", CLEAN, ids=lambda s: s["id"])
def test_genuine_statements_pass(sample):
    txns, meta = load(sample)
    report = check_integrity(txns, meta)
    assert report["status"] == "pass", statuses(report)


@pytest.mark.parametrize("sample", TAMPERED, ids=lambda s: s["id"])
def test_tampered_statements_fail_with_evidence(sample):
    txns, meta = load(sample)
    report = check_integrity(txns, meta)
    assert report["status"] == "fail"
    failed = [c for c in report["checks"] if c["status"] == "fail"]
    assert failed and all(c["evidence"] or c["id"] == "pdf_metadata" for c in failed)


def test_edited_pdf_is_caught_by_balance_and_metadata():
    sample = next(s for s in TAMPERED if s["id"] == "priya_salaried-edited")
    report = check_integrity(*load(sample))
    s = statuses(report)
    assert s["balance_continuity"] == "fail"
    assert s["pdf_metadata"] == "fail"


def test_round_tripped_income_is_caught():
    sample = next(s for s in TAMPERED if s["id"] == "ravi_gig-roundtrip")
    assert statuses(check_integrity(*load(sample)))["round_tripping"] == "fail"


def test_editing_one_amount_breaks_balance_continuity(ravi):
    txns, meta = copy.deepcopy(ravi)
    i = next(i for i, t in enumerate(txns) if t["credit"] > 1000)
    txns[i]["credit"] += 5000  # inflate one credit without fixing the running balance
    report = check_integrity(txns, meta)
    check = next(c for c in report["checks"] if c["id"] == "balance_continuity")
    assert check["status"] == "fail"
    assert any(e["date"] == txns[i]["date"] for e in check["evidence"])


def test_does_not_mutate_input(ravi):
    txns, meta = ravi
    before = copy.deepcopy(txns)
    check_integrity(txns, meta)
    assert txns == before


def check(report, cid):
    return next(c for c in report["checks"] if c["id"] == cid)


def test_problem_headline_only_when_not_passing():
    sample = next(s for s in TAMPERED if s["id"] == "priya_salaried-edited")
    report = check_integrity(*load(sample))
    for c in report["checks"]:
        assert (c["problem"] is None) == (c["status"] == "pass")
        if c["problem"]:
            assert c["problem"][0].isupper()
    assert "running balance doesn't add up" in failed_problems(report)


# --- #6: a row without a printed balance must not break continuity

def _row(date, narr, debit=0.0, credit=0.0, balance=None):
    return {"txn_id": None, "date": date, "narration": narr, "debit": debit, "credit": credit, "balance": balance}


def test_blank_middle_balance_is_carried_forward_not_failed():
    txns = [
        _row("2026-01-01", "NEFT CR ACME SALARY", credit=30000, balance=30000),
        _row("2026-01-02", "UPI/DR/1/SWIGGY", debit=500, balance=None),
        _row("2026-01-03", "UPI/DR/2/ZEPTO", debit=1000, balance=28500),
    ]
    c = check(check_integrity(txns, {"source": "csv"}), "balance_continuity")
    assert c["status"] == "pass", c["detail"]


def test_tampering_hidden_behind_blank_balance_is_still_caught():
    txns = [
        _row("2026-01-01", "NEFT CR ACME SALARY", credit=30000, balance=30000),
        _row("2026-01-02", "UPI/DR/1/SWIGGY", debit=500, balance=None),
        _row("2026-01-03", "UPI/DR/2/ZEPTO", debit=1000, balance=29500),  # ignores the ₹500 above
    ]
    c = check(check_integrity(txns, {"source": "csv"}), "balance_continuity")
    assert c["status"] == "fail"


def test_statement_with_some_blank_balances_still_passes(ravi):
    txns, meta = copy.deepcopy(ravi)
    for i in range(5, len(txns), 17):
        txns[i]["balance"] = None
    assert check(check_integrity(txns, meta), "balance_continuity")["status"] == "pass"


# --- #9: small friend-to-friend back-and-forth is a warning, not fraud

def test_small_p2p_back_and_forth_only_warns(ravi):
    txns, meta = copy.deepcopy(ravi)
    extra = [
        _row("2026-03-10", "UPI/CR/700000000001/RAHUL SHARMA/HDFC/rahul@okhdfc", credit=2000),
        _row("2026-03-11", "UPI/DR/700000000002/RAHUL SHARMA/HDFC/rahul@okhdfc", debit=2000),
        _row("2026-05-20", "UPI/CR/700000000003/RAHUL SHARMA/HDFC/rahul@okhdfc", credit=1500),
        _row("2026-05-21", "UPI/DR/700000000004/RAHUL SHARMA/HDFC/rahul@okhdfc", debit=1500),
    ]
    txns = sorted(txns + extra, key=lambda t: t["date"])
    for t in txns:
        t["balance"] = None  # balances no longer chain after the insert; this test is about round-tripping
    report = check_integrity(txns, meta)
    c = check(report, "round_tripping")
    assert c["status"] == "warn", c["detail"]
    assert report["status"] != "fail"
    assert sum("round_trip" in f for f in report["txn_flags"]) >= 4  # still excluded from income


# --- #10: PDF editor traces alone are a warning; corroborated by altered figures they fail

def test_pdf_resaved_in_editor_with_intact_figures_only_warns():
    sample = next(s for s in CLEAN if s["id"] == "priya_salaried-pdf")
    txns, meta = load(sample)
    meta = copy.deepcopy(meta)
    meta["pdf_metadata"].update(Producer="iLovePDF", ModDate="D:20261020120000+05'30'")
    report = check_integrity(txns, meta)
    c = check(report, "pdf_metadata")
    assert c["status"] == "warn", c["detail"]
    assert c["problem"] == "The PDF was re-saved after the bank issued it"
    assert report["status"] == "warn"


def test_pdf_editor_traces_plus_altered_salary_fail():
    sample = next(s for s in TAMPERED if s["id"] == "priya_salaried-edited")
    report = check_integrity(*load(sample))
    c = check(report, "pdf_metadata")
    assert c["status"] == "fail" and "running balance" in c["detail"]
    assert report["status"] == "fail"

import pytest
from fastapi.testclient import TestClient

from api.index import MAX_UPLOAD_BYTES, app

client = TestClient(app)
LOAN = {"loan_amount": "50000", "tenure_months": "12", "purpose": "personal"}


def test_health_and_samples():
    assert client.get("/api/health").json() == {"ok": True}
    samples = client.get("/api/samples").json()
    assert {s["format"] for s in samples} == {"csv", "pdf", "aa_json"}
    assert any(s["tampered"] for s in samples)


def test_analyze_sample_returns_full_report():
    r = client.post("/api/analyze", data={**LOAN, "sample_id": "ravi_gig"})
    assert r.status_code == 200
    body = r.json()
    assert {"applicant", "integrity", "income", "spending", "obligations", "risk", "features",
            "affordability", "improvements", "transactions", "summary"} <= body.keys()
    assert set(body["summary"]) == {"en", "hi", "te"}


def test_tampered_upload_is_never_auto_approved():
    pdf = open("data/samples/priya_salaried-edited.pdf", "rb").read()
    r = client.post("/api/analyze", data=LOAN, files={"file": ("statement.pdf", pdf, "application/pdf")})
    body = r.json()
    assert body["integrity"]["status"] == "fail"
    assert body["risk"]["decision"] != "approve"


@pytest.mark.parametrize("data", [
    {**LOAN, "sample_id": "../../engine/models/risk"},
    {**LOAN, "sample_id": "missing"},
    LOAN,
    {**LOAN, "loan_amount": "-5", "sample_id": "ravi_gig"},
])
def test_bad_requests_get_readable_400s(data):
    r = client.post("/api/analyze", data=data)
    assert r.status_code == 400
    assert isinstance(r.json()["detail"], str)


def test_portfolio_scores_each_applicant_once_and_flags_tampering():
    rows = client.post("/api/portfolio").json()["applicants"]
    samples = client.get("/api/samples").json()
    # format variants (PDF / Account Aggregator copies) of a clean statement are not scored twice
    assert len(rows) == len({s["id"] for s in samples if s["format"] == "csv" or s["tampered"]})
    assert all(300 <= r["score"] <= 900 for r in rows)
    assert {r["id"] for r in rows if r["integrity_status"] == "fail"} == {s["id"] for s in samples if s["tampered"]}


def test_upload_over_limit_gets_413_with_readable_message():
    assert MAX_UPLOAD_BYTES == 4 * 1024 * 1024  # below Vercel's 4.5 MB request body limit
    big = b"Date,Narration,Debit,Credit,Balance\n" + b"x" * MAX_UPLOAD_BYTES
    r = client.post("/api/analyze", data=LOAN, files={"file": ("big.csv", big, "text/csv")})
    assert r.status_code == 413
    assert "4 MB" in r.json()["detail"]


@pytest.mark.parametrize("name,content", [
    ("deep.json", b"[" * 100_000 + b"]" * 100_000),
    ("nan.csv", b"Date,Narration,Debit,Credit,Balance\n01/08/26,X,inf,,1\n02/08/26,Y,,nan,1\n"),
])
def test_malformed_uploads_get_400_not_500(name, content):
    r = client.post("/api/analyze", data=LOAN, files={"file": (name, content, "application/octet-stream")})
    assert r.status_code == 400
    assert isinstance(r.json()["detail"], str)

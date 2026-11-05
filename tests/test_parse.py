import json
import math

import pytest

from conftest import ALL_SAMPLES, load
from engine.parse import ParseError, parse_amount, parse_date, parse_upload


@pytest.mark.parametrize("raw,iso", [
    ("05/10/2026", "2026-10-05"),   # day-first, not US month-first
    ("05-Oct-26", "2026-10-05"),
    ("2026-10-05", "2026-10-05"),
    ("not a date", None),
])
def test_parse_date_is_day_first(raw, iso):
    assert parse_date(raw) == iso


@pytest.mark.parametrize("raw,value", [
    ("₹1,23,456.50", 123456.5),
    ("(500)", -500.0),
    ("1,000 Dr", -1000.0),
    ("", None),
    ("-", None),
])
def test_parse_amount_indian_formats(raw, value):
    assert parse_amount(raw) == value


@pytest.mark.parametrize("raw", ["nan", "NaN", "inf", "-inf", "Infinity", "1e400", float("nan"), float("inf"), 10**400])
def test_parse_amount_rejects_non_finite(raw):
    assert parse_amount(raw) is None


def test_nan_and_inf_cells_never_reach_transactions():
    csv = (
        "Date,Narration,Withdrawal,Deposit,Balance\n"
        "01/08/26,SALARY ACME,,30000.00,35000.00\n"
        "02/08/26,UPI-SWIGGY,inf,,34750.00\n"
        "03/08/26,UPI-ZEPTO,,nan,34750.00\n"
        "04/08/26,UPI-AMAZON,250.00,,1e400\n"
    ).encode()
    txns, _ = parse_upload("s.csv", csv)
    assert [t["narration"] for t in txns] == ["SALARY ACME", "UPI-AMAZON"]
    assert txns[1]["balance"] is None
    for t in txns:
        assert all(v is None or math.isfinite(v) for v in (t["debit"], t["credit"], t["balance"]))


def _aa(transactions) -> bytes:
    return json.dumps({"Account": {"Transactions": {"Transaction": transactions}}}).encode()


@pytest.mark.parametrize("content", [
    b"[" * 100_000 + b"]" * 100_000,                       # nesting deeper than the recursion limit
    b'{"a":' * 5_000 + b'{"Transactions": []}' + b"}" * 5_000,
    b'{"Account": {"Transactions": ' + b"1" * 5_000 + b"}}",  # integer over Python's digit limit
    b'{"Account": {"Transactions": [',                      # truncated
    _aa([{"type": "CREDIT", "amount": "nan", "valueDate": "2026-01-01"}]),
    _aa([{"type": "CREDIT", "amount": {"x": 1}, "valueDate": "2026-01-01", "narration": ["a"]}]),
    _aa("not a list"),
    b'{"Account": {"Transactions": {"Transaction": [null, 3, "x"]}}}',
])
def test_malformed_aa_json_is_a_parse_error(content):
    with pytest.raises(ParseError):
        parse_upload("aa.json", content)


def test_aa_json_with_object_fields_is_coerced_safely():
    content = json.dumps({"Account": {
        "Profile": {"Holders": {"Holder": {"name": {"first": "x"}}}},
        "Summary": {"ifscCode": ["HDFC0001"], "type": None},
        "Transactions": {"Transaction": [
            {"type": "CREDIT", "amount": "5000", "valueDate": "2026-01-01", "narration": {"n": 1}, "txnId": {"t": 1}},
        ]},
    }}).encode()
    txns, meta = parse_upload("aa.json", content)
    assert txns[0]["narration"] == "" and txns[0]["txn_id"] is None
    assert meta["account_holder"] is None and meta["bank"] is None


def test_csv_cell_over_field_limit_is_a_parse_error():
    content = b"Date,Narration,Debit,Credit,Balance\n01/08/26,\"" + b"x" * 200_000 + b"\",1,,1\n"
    with pytest.raises(ParseError):
        parse_upload("s.csv", content)


def test_corrupt_pdf_is_a_parse_error():
    with pytest.raises(ParseError):
        parse_upload("s.pdf", b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\ntrailer\n%%EOF")


def test_csv_with_bank_style_headers():
    csv = (
        "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\n"
        "01/08/26,NEFT CR-ACME PVT LTD-SALARY,0001,01/08/26,,30000.00,35000.00\n"
        "03/08/26,UPI-SWIGGY-swiggy@icici-412345678901,0002,03/08/26,250.00,,34750.00\n"
    ).encode()
    txns, meta = parse_upload("hdfc.csv", csv)
    assert meta["source"] == "csv"
    assert [(t["date"], t["debit"], t["credit"], t["balance"]) for t in txns] == [
        ("2026-08-01", 0.0, 30000.0, 35000.0),
        ("2026-08-03", 250.0, 0.0, 34750.0),
    ]


@pytest.mark.parametrize("content", [b"", b"   ", b"hello world", b"a,b,c\n1,2,3\n"])
def test_rejects_files_that_are_not_statements(content):
    with pytest.raises(ParseError):
        parse_upload("x.csv", content)


@pytest.mark.parametrize("sample", ALL_SAMPLES, ids=lambda s: s["id"])
def test_every_sample_format_parses(sample):
    txns, meta = load(sample)
    assert meta["source"] == sample["format"]
    assert len(txns) > 100
    assert all(t["date"] and (t["debit"] > 0) != (t["credit"] > 0) for t in txns)


def test_pdf_and_csv_of_same_statement_agree():
    by_id = {s["id"]: s for s in ALL_SAMPLES}
    csv_txns, _ = load(by_id["priya_salaried"])
    pdf_txns, pdf_meta = load(by_id["priya_salaried-pdf"])
    key = lambda ts: [(t["date"], round(t["debit"], 2), round(t["credit"], 2), round(t["balance"], 2)) for t in ts]
    assert key(pdf_txns) == key(csv_txns)
    assert pdf_meta["account_holder"] == "Priya Sharma"

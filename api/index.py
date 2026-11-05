"""CreditBridge API — FastAPI app served as a Vercel Python function (module-level `app`).

Local:  .venv/bin/uvicorn api.index:app --port 8000
Vercel: vercel.json rewrites /api/(.*) -> /api/index; routes keep their /api prefix.
Runtime deps: fastapi, python-multipart, numpy, pdfplumber (+ stdlib). No data is stored.
"""
from __future__ import annotations

import json
import logging
import sys
from functools import lru_cache
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402

from engine.analyze import analyze, model_card  # noqa: E402
from engine.integrity import check_integrity, failed_problems  # noqa: E402
from engine.parse import ParseError, parse_upload  # noqa: E402

log = logging.getLogger("creditbridge.api")

SAMPLES_DIR = ROOT / "data" / "samples"
# Vercel rejects request bodies over 4.5 MB before the function runs; stay safely below it (multipart overhead).
MAX_UPLOAD_BYTES = 4 * 1024 * 1024
UPLOAD_TOO_LARGE = "This file is larger than 4 MB. Please upload a smaller file — a CSV export is usually much smaller than a PDF."
FORMATS = {".csv": "csv", ".pdf": "pdf", ".json": "aa_json"}

# Loan asked for by each demo persona when the sample doesn't specify one.
DEFAULT_LOANS = {
    "salaried": {"amount": 100000.0, "tenure_months": 24, "purpose": "personal"},
    "gig_worker": {"amount": 40000.0, "tenure_months": 12, "purpose": "vehicle"},
    "student": {"amount": 25000.0, "tenure_months": 12, "purpose": "education"},
    "farmer": {"amount": 60000.0, "tenure_months": 12, "purpose": "agriculture"},
    "shopkeeper": {"amount": 75000.0, "tenure_months": 18, "purpose": "business"},
    "homemaker": {"amount": 30000.0, "tenure_months": 12, "purpose": "business"},
}
FALLBACK_LOAN = {"amount": 50000.0, "tenure_months": 12, "purpose": "personal"}

app = FastAPI(title="CreditBridge API", version="2.0", docs_url="/api/docs", openapi_url="/api/openapi.json")


_FIELD_NAMES = {"loan_amount": "Loan amount", "tenure_months": "Tenure (months)", "purpose": "Purpose",
                "sample_id": "Sample", "file": "File"}


@app.exception_handler(RequestValidationError)
async def _invalid(_: Request, exc: RequestValidationError):
    msgs = []
    for err in exc.errors():
        field = next((str(p) for p in reversed(err.get("loc", ())) if isinstance(p, str) and p != "body"), "input")
        msgs.append(f"{_FIELD_NAMES.get(field, field)}: {err.get('msg', 'invalid value').lower()}")
    return JSONResponse(status_code=400, content={"detail": "; ".join(msgs) or "Invalid request."})


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):  # pragma: no cover - safety net
    log.exception("unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong while analysing this statement."})


# --------------------------------------------------------------------------- samples

def _read_items(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        items = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        log.exception("could not read %s", path)
        return []
    return items if isinstance(items, list) else []


def _sample_mtime() -> float:
    files = [SAMPLES_DIR / "index.json", SAMPLES_DIR / "extra.json"]
    return max((f.stat().st_mtime for f in files if f.exists()), default=0.0)


@lru_cache(maxsize=4)
def _samples(_mtime: float) -> tuple[dict, ...]:
    out = []
    seen = set()
    for item in _read_items(SAMPLES_DIR / "index.json") + _read_items(SAMPLES_DIR / "extra.json"):
        sid = item.get("id")
        if not sid or sid in seen:
            continue
        fname = item.get("file") or f"{sid}.csv"
        if not (SAMPLES_DIR / fname).is_file():
            continue
        seen.add(sid)
        persona = item.get("persona")
        loan = item.get("loan") or DEFAULT_LOANS.get(persona or "", FALLBACK_LOAN)
        out.append({
            "id": sid,
            "name": item.get("name") or sid,
            "persona": persona,
            "description": item.get("description", ""),
            "format": item.get("format") or FORMATS.get(Path(fname).suffix.lower(), "csv"),
            "tampered": bool(item.get("tampered", False)),
            "file": fname,
            "variant_of": item.get("variant_of"),
            "loan": {"amount": float(loan["amount"]), "tenure_months": int(loan["tenure_months"]),
                     "purpose": str(loan.get("purpose") or "personal")},
        })
    return tuple(out)


def samples() -> list[dict]:
    return list(_samples(_sample_mtime()))


def get_sample(sample_id: str) -> dict:
    for s in samples():
        if s["id"] == sample_id:
            return s
    raise HTTPException(400, f"Unknown sample '{sample_id}'. See /api/samples for the list.")


# --------------------------------------------------------------------------- pipeline

def run_pipeline(filename: str, content: bytes, loan: Optional[dict], sample: Optional[dict] = None) -> dict:
    try:
        txns, meta = parse_upload(filename, content)
    except ParseError as e:
        raise HTTPException(400, str(e)) from e
    meta["name"] = (sample or {}).get("name") or meta.get("account_holder")
    meta["persona"] = (sample or {}).get("persona")
    meta["sample_id"] = (sample or {}).get("id")

    integrity = check_integrity(txns, meta)
    # analyze uses these: flags pass through to report.transactions ("round_trip" credits aren't income);
    # a failed integrity status downgrades approve -> review and is explained in the summary.
    for t, f in zip(txns, integrity.pop("txn_flags")):
        t["flags"] = list(f)
    meta["integrity"] = {"status": integrity["status"], "failed": failed_problems(integrity)}

    try:
        report = analyze(txns, loan, meta)
    except ValueError as e:
        raise HTTPException(400, f"This statement couldn't be analysed: {e}") from e
    # contract key order: applicant, integrity, then the rest
    out = {"applicant": report.get("applicant"), "integrity": integrity}
    out.update({k: v for k, v in report.items() if k not in out})
    return out


@lru_cache(maxsize=256)
def _sample_report(sample_id: str, amount: float, tenure: int, purpose: str, _mtime: float) -> str:
    s = get_sample(sample_id)
    path = SAMPLES_DIR / s["file"]
    report = run_pipeline(path.name, path.read_bytes(), {"amount": amount, "tenure_months": tenure, "purpose": purpose}, s)
    return json.dumps(report)


def sample_report(sample_id: str, loan: dict) -> dict:
    return json.loads(_sample_report(sample_id, float(loan["amount"]), int(loan["tenure_months"]),
                                     str(loan["purpose"]), _sample_mtime()))


def _loan_from_form(amount: Optional[float], tenure: Optional[int], purpose: Optional[str]) -> Optional[dict]:
    if amount is None and tenure is None and not purpose:
        return None
    if amount is None:
        raise HTTPException(400, "Please enter the loan amount.")
    if not (1000 <= amount <= 5_000_000):
        raise HTTPException(400, "Loan amount must be between ₹1,000 and ₹50,00,000.")
    tenure = 12 if tenure is None else tenure
    if not (1 <= tenure <= 120):
        raise HTTPException(400, "Tenure must be between 1 and 120 months.")
    return {"amount": float(amount), "tenure_months": int(tenure), "purpose": (purpose or "personal").strip()[:40]}


# --------------------------------------------------------------------------- routes

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/samples")
def list_samples():
    return samples()


@app.get("/api/samples/{sample_id}/file")
def sample_file(sample_id: str):
    s = get_sample(sample_id)
    media = {"csv": "text/csv", "pdf": "application/pdf", "aa_json": "application/json"}[s["format"]]
    return FileResponse(SAMPLES_DIR / s["file"], media_type=media, filename=s["file"])


@app.post("/api/analyze")
async def analyze_endpoint(
    file: Optional[UploadFile] = File(None),
    sample_id: Optional[str] = Form(None),
    loan_amount: Optional[float] = Form(None),
    tenure_months: Optional[int] = Form(None),
    purpose: Optional[str] = Form(None),
):
    loan = _loan_from_form(loan_amount, tenure_months, purpose)
    if file is not None and file.filename:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, UPLOAD_TOO_LARGE)
        if not content:
            raise HTTPException(400, "The uploaded file is empty.")
        return run_pipeline(file.filename, content, loan)
    if sample_id:
        s = get_sample(sample_id)
        return sample_report(s["id"], loan or s["loan"])
    raise HTTPException(400, "Upload a bank statement (CSV, PDF or Account Aggregator JSON) or choose a sample.")


@app.api_route("/api/portfolio", methods=["GET", "POST"])
def portfolio():
    rows = []
    for s in samples():
        if s["variant_of"] and not s["tampered"]:
            continue  # same applicant in another file format
        r = sample_report(s["id"], s["loan"])
        risk, aff = r.get("risk") or {}, r.get("affordability") or {}
        rows.append({
            "id": s["id"], "name": s["name"], "persona": s["persona"], "format": s["format"], "tampered": s["tampered"],
            "score": risk.get("score"), "band": risk.get("band"), "decision": risk.get("decision"), "pd": risk.get("pd"),
            "integrity_status": r["integrity"]["status"], "integrity_score": r["integrity"]["score"],
            "max_emi": aff.get("max_emi"), "requested_emi": aff.get("requested_emi"),
            "loan_amount": s["loan"]["amount"], "recommended_amount": aff.get("recommended_amount"),
        })
    n = len(rows)
    decisions = {d: sum(1 for r in rows if r["decision"] == d) for d in ("approve", "review", "decline")}
    scores = [r["score"] for r in rows if isinstance(r["score"], (int, float))]
    pds = [r["pd"] for r in rows if isinstance(r["pd"], (int, float))]
    approved = [r for r in rows if r["decision"] == "approve"]
    summary = {
        "applicants": n,
        "decisions": decisions,
        "approval_rate": round(decisions["approve"] / n, 3) if n else 0.0,
        "avg_score": round(sum(scores) / len(scores)) if scores else None,
        "avg_pd": round(sum(pds) / len(pds), 4) if pds else None,
        "integrity_flagged": sum(1 for r in rows if r["integrity_status"] == "fail"),
        "requested_total": round(sum(r["loan_amount"] for r in rows), 2),
        "approved_total": round(sum(r["loan_amount"] for r in approved), 2),
        "expected_loss_approved": round(sum(r["loan_amount"] * (r["pd"] or 0) for r in approved), 2),
    }
    return {"applicants": rows, "summary": summary}


@app.get("/api/model-card")
def get_model_card():
    return model_card()

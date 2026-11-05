"""Build PDF / Account Aggregator variants and tampered statements from the sample CSVs.

Offline tool (reportlab allowed). Reads ML's `data/samples/index.json` + `<id>.csv` and writes:
  * bank-statement PDFs for 3 applicants            -> <id>-statement.pdf
  * RBI Account Aggregator (ReBIT FI) JSON for 2     -> <id>-aa.json
  * tampered (a): salary amount edited in the PDF, breaking the running balance, re-saved in iLovePDF
                  (Producer 'iLovePDF', ModDate 12 days after CreationDate) -> <id>-edited.pdf
  * tampered (b): round-tripped funds to inflate income (consistent balances, clean metadata)
                                                     -> <id>-roundtrip.pdf
  * `extra.json` listing them (same item shape as index.json, plus `variant_of`)

Usage (run after ML's sample generator; rerun whenever data/samples/*.csv change):
  .venv/bin/python ml/make_sample_variants.py
It finishes by running the runtime integrity check on every sample and exits non-zero unless all genuine
samples pass and all tampered ones fail.
"""
from __future__ import annotations

import csv
import hashlib
import json
import random
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfdoc import PDFDictionary, PDFInfo, PDFName, PDFString
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent

BANKS = (  # fictional banks: (name, IFSC prefix, FIP id, branch)
    ("Navodaya Bank", "NVDB", "NAVODAYA-FIP", "Andheri East, Mumbai"),
    ("Kaveri Gramin Bank", "KVGB", "KAVERI-FIP", "Mandya, Karnataka"),
    ("Sahyadri Sahakari Bank", "SHYB", "SAHYADRI-FIP", "Kothrud, Pune"),
)
SALARY_RE = re.compile(r"\b(salary|sal|payroll|wages|stipend)\b", re.I)


# --------------------------------------------------------------------------- io

def load_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    out = []
    for r in rows:
        bal = r.get("balance")
        out.append({
            "txn_id": r.get("txn_id") or None,
            "date": r["date"],
            "narration": r["narration"],
            "debit": float(r.get("debit") or 0),
            "credit": float(r.get("credit") or 0),
            "balance": float(bal) if bal not in (None, "") else None,
        })
    return out


def stable_seed(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:8], 16)


def inr(x: float) -> str:
    """Indian grouping with 2 decimals: 123456.5 -> '1,23,456.50'."""
    neg = x < 0
    whole, frac = f"{abs(x):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return ("-" if neg else "") + whole + "." + frac


def pdf_date(dt: datetime) -> str:
    return dt.strftime("D:%Y%m%d%H%M%S+05'30'")


# --------------------------------------------------------------------------- PDF

class StatementInfo(PDFInfo):
    """PDF /Info dictionary with explicit CreationDate / ModDate (reportlab always sets them equal)."""

    def __init__(self, title, author, creator, producer, created: datetime, modified: datetime):
        super().__init__()
        self.title, self.author, self.creator, self.producer = title, author, creator, producer
        self.subject = "Account statement"
        self._created, self._modified = created, modified

    def format(self, document):
        d = {
            "Title": PDFString(self.title), "Author": PDFString(self.author), "Subject": PDFString(self.subject),
            "Creator": PDFString(self.creator), "Producer": PDFString(self.producer),
            "CreationDate": PDFString(pdf_date(self._created)), "ModDate": PDFString(pdf_date(self._modified)),
            "Trapped": PDFName("False"),
        }
        return PDFDictionary(d).format(document)


class StatementDoc(SimpleDocTemplate):
    """Doc template that installs our /Info dictionary right before saving (build() restores its own otherwise)."""

    def __init__(self, filename, info: StatementInfo, **kw):
        super().__init__(filename, **kw)
        self.statement_info = info

    def _endBuild(self):
        self.canv._doc.info = self.statement_info
        super()._endBuild()



NARRATION_FONT = ("Helvetica", 7)
NARRATION_COL_W = 128 * mm


def wrap_narration(s: str, max_w: float = NARRATION_COL_W - 14) -> str:
    """Break long narrations at spaces or after '/' to fit the column (the parser rejoins them losslessly)."""
    fits = lambda text: stringWidth(text, *NARRATION_FONT) <= max_w  # noqa: E731
    lines, cur = [], ""
    for tok in re.findall(r"[^ /]+/?|\s+", s):
        if cur and not fits(cur + tok):
            lines.append(cur.rstrip(" "))
            cur = tok.lstrip(" ")
        else:
            cur += tok
    if cur:
        lines.append(cur)
    return "\n".join(lines)


def write_pdf(path: Path, txns: list[dict], applicant: dict, bank: tuple, acct_no: str, *,
              producer: str, created: datetime, modified: datetime) -> None:
    bank_name, ifsc_prefix, _fip, branch = bank
    start, end = txns[0]["date"], txns[-1]["date"]
    opening = round(txns[0]["balance"] - txns[0]["credit"] + txns[0]["debit"], 2)
    closing = txns[-1]["balance"]
    fmt_d = lambda s: datetime.strptime(s, "%Y-%m-%d").strftime("%d-%b-%y")  # noqa: E731

    title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=16, leading=19, textColor=colors.HexColor("#0b3d6e"))
    small = ParagraphStyle("s", fontName="Helvetica", fontSize=8, leading=10.5)
    story = [
        Paragraph(bank_name, title),
        Paragraph(f"{branch} Branch &nbsp;|&nbsp; IFSC: {ifsc_prefix}0{acct_no[-6:]} &nbsp;|&nbsp; "
                  "Customer care 1800-000-0000", small),
        Spacer(1, 4 * mm),
        Paragraph("<b>STATEMENT OF ACCOUNT</b>", ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11)),
        Spacer(1, 2 * mm),
        Paragraph(f"Account Holder: {applicant['name']}", small),
        Paragraph(f"Account No: XXXXXX{acct_no[-4:]} &nbsp; Account Type: Savings", small),
        Paragraph(f"Statement Period: {fmt_d(start)} to {fmt_d(end)}", small),
        Paragraph(f"Opening Balance: INR {inr(opening)} &nbsp; Closing Balance: INR {inr(closing)}", small),
        Spacer(1, 4 * mm),
    ]
    data = [["Date", "Narration", "Ref No.", "Withdrawal (Dr)", "Deposit (Cr)", "Balance"]]
    for t in txns:
        data.append([
            fmt_d(t["date"]), wrap_narration(t["narration"]), t["txn_id"] or "",
            inr(t["debit"]) if t["debit"] else "", inr(t["credit"]) if t["credit"] else "", inr(t["balance"]),
        ])
    table = Table(data, colWidths=[17 * mm, NARRATION_COL_W, 30 * mm, 30 * mm, 30 * mm, 32 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 7),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dfe8f3")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#8a9bb0")),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    story += [table, Spacer(1, 4 * mm),
              Paragraph("This is a computer-generated statement and does not require a signature.", small)]

    info = StatementInfo(f"Statement {acct_no[-4:]} {start} to {end}", bank_name,
                         f"{bank_name} e-Statement Service", producer, created, modified)

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(landscape(A4)[0] - 12 * mm, 8 * mm, f"Page {doc.page}")
        canvas.drawString(12 * mm, 8 * mm, f"{bank_name} | Generated {created.strftime('%d-%b-%Y %H:%M')} IST")
        canvas.restoreState()

    doc = StatementDoc(str(path), info, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm,
                       topMargin=12 * mm, bottomMargin=14 * mm, invariant=1, title=info.title)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


# --------------------------------------------------------------------------- Account Aggregator (ReBIT FI)

def txn_mode(narr: str) -> str:
    n = narr.upper()
    for key in ("UPI", "NEFT", "IMPS", "RTGS", "ATM", "ACH", "NACH", "ECS"):
        if n.startswith(key) or f"/{key}/" in n or f" {key} " in n:
            return {"ACH": "OTHERS", "NACH": "OTHERS", "ECS": "OTHERS"}.get(key, key)
    if "POS" in n or "CARD" in n:
        return "CARD"
    return "OTHERS"


def write_aa_json(path: Path, txns: list[dict], applicant: dict, bank: tuple, acct_no: str) -> None:
    bank_name, ifsc_prefix, fip, branch = bank
    rnd = random.Random(stable_seed(applicant["id"], "aa"))
    end = datetime.strptime(txns[-1]["date"], "%Y-%m-%d")
    fetched = (end + timedelta(days=1)).replace(hour=11, minute=2, second=41)
    out_txns = []
    for i, t in enumerate(txns):
        ts = datetime.strptime(t["date"], "%Y-%m-%d").replace(hour=8 + (i * 7) % 13, minute=(i * 17) % 60,
                                                             second=(i * 31) % 60)
        out_txns.append({
            "txnId": t["txn_id"] or f"AA{stable_seed(applicant['id'], str(i)):010d}",
            "type": "CREDIT" if t["credit"] > 0 else "DEBIT",
            "mode": txn_mode(t["narration"]),
            "amount": f"{(t['credit'] or t['debit']):.2f}",
            "currentBalance": f"{t['balance']:.2f}",
            "transactionTimestamp": ts.strftime("%Y-%m-%dT%H:%M:%S+05:30"),
            "valueDate": t["date"],
            "narration": t["narration"],
            "reference": t["txn_id"] or "",
        })
    account = {
        "type": "deposit", "maskedAccNumber": f"XXXXXX{acct_no[-4:]}", "linkedAccRef": f"LAR-{acct_no[-8:]}",
        "version": "1.1",
        "Profile": {"Holders": {"type": "SINGLE", "Holder": {
            "name": applicant["name"], "dob": None, "mobile": f"XXXXXX{rnd.randint(1000, 9999)}",
            "nominee": "REGISTERED", "email": None, "pan": f"XXXXX{rnd.randint(1000, 9999)}X",
            "ckycCompliance": True}}},
        "Summary": {
            "currentBalance": f"{txns[-1]['balance']:.2f}", "currency": "INR", "exchgeRate": "",
            "balanceDateTime": fetched.strftime("%Y-%m-%dT%H:%M:%S+05:30"), "type": "SAVINGS",
            "branch": branch, "facility": "OD", "ifscCode": f"{ifsc_prefix}0{acct_no[-6:]}", "micrCode": "",
            "openingDate": "2021-04-12", "currentODLimit": "0", "drawingLimit": "0", "status": "ACTIVE",
            "Pending": {"amount": "0", "transactionType": "DEBIT"}},
        "Transactions": {"startDate": txns[0]["date"], "endDate": txns[-1]["date"], "Transaction": out_txns},
    }
    payload = {
        "ver": "2.0.0", "timestamp": fetched.strftime("%Y-%m-%dT%H:%M:%S.000+05:30"),
        "txnid": f"{stable_seed(applicant['id'], 'session'):08x}-cb00-4e1a-9d2f-{stable_seed(applicant['id']):012x}",
        "FI": [{"fipID": fip, "fipName": bank_name, "data": [{
            "linkRefNumber": f"LAR-{acct_no[-8:]}", "maskedAccNumber": f"XXXXXX{acct_no[-4:]}",
            "decryptedFI": {"Account": account}}]}],
    }
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------- tampering

def edit_salary(txns: list[dict]) -> tuple[list[dict], dict]:
    """Inflate one mid-statement salary credit without touching the printed balances (what a forger does)."""
    out = [dict(t) for t in txns]
    sal = [i for i, t in enumerate(out) if t["credit"] > 0 and SALARY_RE.search(t["narration"])]
    if not sal:  # fall back to the largest recurring credit
        biggest = max(t["credit"] for t in out)
        sal = [i for i, t in enumerate(out) if t["credit"] >= 0.8 * biggest]
    i = sal[len(sal) // 2]
    old = out[i]["credit"]
    new = float(round(old * 1.6 / 1000) * 1000)
    out[i]["credit"] = new
    return out, {"date": out[i]["date"], "old": old, "new": new}


def add_round_trips(txns: list[dict], applicant_id: str) -> tuple[list[dict], list[dict]]:
    """Insert 3 'credit from a friend, sent straight back' pairs and recompute running balances."""
    rnd = random.Random(stable_seed(applicant_id, "roundtrip"))
    months: dict[str, float] = {}
    for t in txns:
        months[t["date"][:7]] = months.get(t["date"][:7], 0) + t["credit"]
    monthly_income = sorted(months.values())[len(months) // 2] or 20000
    keys = sorted(months)
    picks = [keys[k] for k in (len(keys) // 4, len(keys) // 2, (3 * len(keys)) // 4)]
    parties = [("SURESH PATEL", "ICIC", "suresh.patel88@okicici"), ("SURESH PATEL", "ICIC", "suresh.patel88@okicici"),
               ("MAHESH TRADERS", "KKBK", "maheshtraders@kotak")]
    inserts, pairs = [], []
    for n, (month, (name, bk, vpa)) in enumerate(zip(picks, parties)):
        amt = float(round(monthly_income * rnd.uniform(0.9, 1.3) / 500) * 500)
        d_in = date.fromisoformat(f"{month}-{rnd.randint(8, 20):02d}")
        d_out = d_in + timedelta(days=1 + n % 2)
        ref_in = f"{rnd.randint(10**11, 10**12 - 1)}"
        ref_out = f"{rnd.randint(10**11, 10**12 - 1)}"
        back = amt - (0 if n != 2 else 200)  # one returned slightly short to dodge exact matching
        inserts.append({"txn_id": f"RT{ref_in[-8:]}", "date": d_in.isoformat(),
                        "narration": f"UPI/CR/{ref_in}/{name}/{bk}/{vpa}/Payment", "debit": 0.0, "credit": amt})
        inserts.append({"txn_id": f"RT{ref_out[-8:]}", "date": d_out.isoformat(),
                        "narration": f"UPI/DR/{ref_out}/{name}/{bk}/{vpa}/Return", "debit": back, "credit": 0.0})
        pairs.append({"in": d_in.isoformat(), "out": d_out.isoformat(), "amount": amt, "party": name})
    merged = [dict(t) for t in txns]
    for ins in inserts:  # place after the last existing row on the same date (stable chronological order)
        pos = len(merged)
        for k, t in enumerate(merged):
            if t["date"] > ins["date"]:
                pos = k
                break
        merged.insert(pos, ins)
    opening = round(txns[0]["balance"] - txns[0]["credit"] + txns[0]["debit"], 2)
    bal = opening
    for t in merged:
        bal = round(bal - t["debit"] + t["credit"], 2)
        t["balance"] = bal
    return merged, pairs


# --------------------------------------------------------------------------- main

def pick(items: list[dict], personas: tuple[str, ...], exclude: set[str]) -> dict | None:
    for p in personas:
        for it in items:
            if it.get("persona") == p and it["id"] not in exclude:
                return it
    for it in items:
        if it["id"] not in exclude:
            return it
    return None


def main() -> None:
    src = out_dir = ROOT / "data" / "samples"
    index = src / "index.json"
    if not index.exists():
        sys.exit(f"{index} not found — run ML's sample generator first")
    base = [it for it in json.loads(index.read_text()) if it.get("format", "csv") == "csv" and not it.get("tampered")]
    if not base:
        sys.exit("no base CSV samples found")
    data = {it["id"]: load_csv(src / it.get("file", f"{it['id']}.csv")) for it in base}

    def salary_count(it):
        return sum(1 for t in data[it["id"]] if t["credit"] > 0 and SALARY_RE.search(t["narration"]))

    def acct_for(it):
        return f"{stable_seed(it['id'], 'acct') % 10**12:012d}"

    def stmt_times(txns, edited_days=0):
        end = datetime.strptime(txns[-1]["date"], "%Y-%m-%d")
        created = (end + timedelta(days=1)).replace(hour=9, minute=14, second=22)
        modified = created + timedelta(days=edited_days, hours=5 if edited_days else 0, minutes=37 if edited_days else 0)
        return created, modified

    salaried = sorted((it for it in base if salary_count(it) >= 3), key=salary_count, reverse=True)
    used: set[str] = set()
    extra: list[dict] = []
    producer = "ReportLab PDF Library - www.reportlab.com"

    # 1) clean PDFs for up to 3 applicants
    pdf_items = []
    for personas in (("salaried",), ("gig_worker",), ("homemaker", "student", "shopkeeper", "farmer")):
        it = pick(base, personas, used)
        if it and len(pdf_items) < min(3, len(base)):
            pdf_items.append(it)
            used.add(it["id"])
    for k, it in enumerate(pdf_items):
        txns = data[it["id"]]
        created, modified = stmt_times(txns)
        fname = f"{it['id']}-statement.pdf"
        write_pdf(out_dir / fname, txns, it, BANKS[k % len(BANKS)], acct_for(it), producer=producer,
                  created=created, modified=modified)
        extra.append({"id": f"{it['id']}-pdf", "name": it["name"], "persona": it["persona"],
                      "description": f"{it['name']}'s bank statement as a PDF downloaded from the bank.",
                      "format": "pdf", "tampered": False, "file": fname, "variant_of": it["id"]})

    # 2) Account Aggregator JSON for 2 applicants of different personas (prefer ones without a PDF)
    aa_used: set[str] = set(used)
    aa_personas = ["farmer", "student", "shopkeeper", "homemaker", "gig_worker", "salaried"]
    for _ in range(min(2, len(base))):
        it = pick(base, tuple(aa_personas), aa_used)
        if not it:
            it = pick(base, tuple(aa_personas), {e.get("variant_of") for e in extra if e["format"] == "aa_json"})
        if not it:
            break
        aa_used.add(it["id"])
        if it["persona"] in aa_personas:
            aa_personas.remove(it["persona"])
        fname = f"{it['id']}-aa.json"
        write_aa_json(out_dir / fname, data[it["id"]], it, BANKS[(len(extra) + 1) % len(BANKS)], acct_for(it))
        extra.append({"id": f"{it['id']}-aa", "name": it["name"], "persona": it["persona"],
                      "description": f"{it['name']}'s account data shared through the RBI Account Aggregator "
                                     "network (consent-based, straight from the bank).",
                      "format": "aa_json", "tampered": False, "file": fname, "variant_of": it["id"]})

    # 3a) edited salary + editor metadata
    victim = salaried[0] if salaried else pick(base, ("salaried",), set())
    edited, info = edit_salary(data[victim["id"]])
    created, modified = stmt_times(edited, edited_days=12)
    fname = f"{victim['id']}-edited.pdf"
    write_pdf(out_dir / fname, edited, victim, BANKS[0], acct_for(victim), producer="iLovePDF",
              created=created, modified=modified)
    extra.append({"id": f"{victim['id']}-edited", "name": victim["name"], "persona": victim["persona"],
                  "description": f"Tampered: the {info['date']} salary was changed from ₹{info['old']:,.0f} to "
                                 f"₹{info['new']:,.0f} in a PDF editor.",
                  "format": "pdf", "tampered": True, "file": fname, "variant_of": victim["id"]})

    # 3b) round-tripped funds (consistent arithmetic, clean metadata — only the flow pattern gives it away)
    rt_base = pick(base, ("gig_worker", "shopkeeper", "salaried"), {victim["id"]}) or victim
    rt, pairs = add_round_trips(data[rt_base["id"]], rt_base["id"])
    created, modified = stmt_times(rt)
    fname = f"{rt_base['id']}-roundtrip.pdf"
    write_pdf(out_dir / fname, rt, rt_base, BANKS[1], acct_for(rt_base), producer=producer,
              created=created, modified=modified)
    total = sum(p["amount"] for p in pairs)
    extra.append({"id": f"{rt_base['id']}-roundtrip", "name": rt_base["name"], "persona": rt_base["persona"],
                  "description": f"Tampered: ₹{total:,.0f} was received from a friend and sent straight back "
                                 f"{len(pairs)} times to make income look higher.",
                  "format": "pdf", "tampered": True, "file": fname, "variant_of": rt_base["id"]})

    (out_dir / "extra.json").write_text(json.dumps(extra, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for e in extra:
        print(f"{e['id']:<34} {e['format']:<8} tampered={e['tampered']}  {e['file']}")
    print(f"wrote {out_dir / 'extra.json'} ({len(extra)} items)")
    verify(out_dir, json.loads(index.read_text(encoding="utf-8")) + extra)


def verify(out_dir: Path, items: list[dict]) -> None:
    """Every genuine sample must pass the runtime integrity check and every tampered one must fail."""
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from engine.integrity import check_integrity
    from engine.parse import parse_upload

    wrong = []
    for it in items:
        path = out_dir / it["file"]
        report = check_integrity(*parse_upload(path.name, path.read_bytes()))
        expected = "fail" if it["tampered"] else "pass"
        if report["status"] != expected:
            wrong.append(f"{it['id']}: integrity {report['status']}, expected {expected} "
                         f"({[(c['id'], c['status']) for c in report['checks'] if c['status'] != 'pass']})")
    if wrong:
        sys.exit("integrity verification failed:\n  " + "\n  ".join(wrong))
    print(f"verified integrity of {len(items)} samples: genuine pass, tampered fail")


if __name__ == "__main__":
    main()

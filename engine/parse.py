"""Parse bank statements (CSV, PDF, RBI Account Aggregator FI JSON) into normalized transactions.

Runtime module: stdlib + pdfplumber only.

Normalized transaction:
    {"txn_id": str|None, "date": "YYYY-MM-DD", "narration": str,
     "debit": float, "credit": float, "balance": float|None}
"""
from __future__ import annotations

import csv
import io
import json
import re
from datetime import date, datetime

__all__ = ["parse_upload", "ParseError"]


class ParseError(ValueError):
    """Raised with a human-readable message when an upload cannot be parsed."""


# --------------------------------------------------------------------------- dates

_DATE_FORMATS = (
    "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y", "%d.%m.%Y", "%d.%m.%y",
    "%d-%b-%y", "%d-%b-%Y", "%d %b %Y", "%d %b %y", "%d-%B-%Y", "%d %B %Y", "%d/%b/%Y",
    "%d/%b/%y", "%Y/%m/%d", "%b %d, %Y", "%d%b%Y",
)
_DATE_TOKEN = (
    r"(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}"
    r"|\d{1,2}[\-/ ][A-Za-z]{3,9}[\-/ ]\d{2,4})"
)
_DATE_RE = re.compile(rf"^\s*({_DATE_TOKEN})")


def parse_date(value) -> str | None:
    """Return ISO date for common Indian bank statement formats (day-first), else None."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    if not s:
        return None
    m = _DATE_RE.match(s)
    if m:
        s = m.group(1)
    elif "T" in s:  # ISO timestamp, e.g. 2026-01-05T10:22:00+05:30
        s = s.split("T", 1)[0]
    s = re.sub(r"\s+", " ", s)
    for fmt in _DATE_FORMATS:
        try:
            d = datetime.strptime(s, fmt)
        except ValueError:
            continue
        if d.year < 100:
            d = d.replace(year=2000 + d.year)
        return d.strftime("%Y-%m-%d")
    return None


# --------------------------------------------------------------------------- amounts

_AMOUNT_STRIP = re.compile(r"(₹|rs\.?|inr|\s|,)", re.I)
_AMOUNT_TOKEN = r"-?\(?(?:₹\s?)?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\)?(?:\s?(?:Cr|Dr|CR|DR))?|-?\d+\.\d{2}"


def parse_amount(value) -> float | None:
    """'₹1,23,456.50' -> 123456.5; '(500)' -> -500; '1,000 Dr' -> -1000; ''/'-' -> None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s or s in {"-", "--", "—", "NA", "N/A", "nil", "Nil"}:
        return None
    sign = 1.0
    low = s.lower()
    if low.endswith("dr"):
        sign, s = -1.0, s[:-2]
    elif low.endswith("cr"):
        s = s[:-2]
    s = _AMOUNT_STRIP.sub("", s)
    if s.startswith("(") and s.endswith(")"):
        sign, s = -sign, s[1:-1]
    if s.startswith("-"):
        sign, s = -sign, s[1:]
    elif s.startswith("+"):
        s = s[1:]
    try:
        return sign * float(s)
    except ValueError:
        return None


# --------------------------------------------------------------------------- headers

def _norm(h) -> str:
    return re.sub(r"[^a-z]", "", str(h or "").lower())


# Ordered: earlier patterns win. Each entry: (field, exact names, substrings)
_HEADER_RULES = (
    ("txn_id", {"txnid", "transactionid", "refno", "chqrefno", "chqno", "chequeno", "referenceno",
                "reference", "refnumber", "utr", "utrno", "chqrefnumber", "tranid", "id"},
     ("refno", "txnid", "transactionid", "utr", "chq", "cheque", "reference")),
    ("date", {"date", "txndate", "transactiondate", "trandate", "postingdate", "postdate", "valuedate",
              "valuedt", "txndt", "transactiondt"},
     ("txndate", "transactiondate", "trandate", "postingdate")),
    ("narration", {"narration", "description", "particulars", "details", "remarks", "transactiondetails",
                   "transactionremarks", "transactiondescription", "narrative"},
     ("narration", "description", "particular", "remark", "details")),
    ("debit", {"withdrawal", "withdrawals", "withdrawalamt", "withdrawalamount", "debit", "debits", "dr",
               "debitamount", "debitamt", "withdrawaldr", "debitdr", "paidout", "moneyout"},
     ("withdrawal", "debit")),
    ("credit", {"deposit", "deposits", "depositamt", "depositamount", "credit", "credits", "cr",
                "creditamount", "creditamt", "depositcr", "creditcr", "paidin", "moneyin"},
     ("deposit", "credit")),
    ("balance", {"balance", "closingbalance", "runningbalance", "availablebalance", "bal", "balanceinr"},
     ("balance",)),
    ("amount", {"amount", "amt", "transactionamount", "txnamount", "amountinr"}, ("amount",)),
    ("drcr", {"drcr", "crdr", "type", "txntype", "transactiontype", "debitcredit"}, ("drcr", "crdr")),
)


def map_header(cells) -> dict[str, int] | None:
    """Map a header row to {field: column_index}. Returns None if it doesn't look like a header."""
    norm = [_norm(c) for c in cells]
    out: dict[str, int] = {}
    # exact matches first, then substring matches, never reusing a column
    for pass_exact in (True, False):
        for field, exact, subs in _HEADER_RULES:
            if field in out:
                continue
            for i, n in enumerate(norm):
                if not n or i in out.values():
                    continue
                if (pass_exact and n in exact) or (not pass_exact and any(s in n for s in subs)):
                    # 'Value Date' should only be used when no transaction date column exists
                    if field == "date" and n.startswith("value") and any(
                        m in ("date", "txndate", "transactiondate", "trandate", "postingdate")
                        for j, m in enumerate(norm) if j != i
                    ):
                        continue
                    out[field] = i
                    break
    if "date" not in out or "narration" not in out:
        return None
    if not (("debit" in out and "credit" in out) or "amount" in out):
        return None
    return out


def _cell(row, idx):
    if idx is None or idx >= len(row):
        return None
    v = row[idx]
    return v.strip() if isinstance(v, str) else v


def _row_to_txn(row, cols: dict[str, int]) -> dict | None:
    d = parse_date(_cell(row, cols["date"]))
    if not d:
        return None
    narration = re.sub(r"\s+", " ", str(_cell(row, cols["narration"]) or "")).strip()
    if "debit" in cols:
        debit = parse_amount(_cell(row, cols["debit"])) or 0.0
        credit = parse_amount(_cell(row, cols["credit"])) or 0.0
        debit, credit = abs(debit), abs(credit)
    else:
        amt = parse_amount(_cell(row, cols["amount"]))
        if amt is None:
            return None
        kind = _norm(_cell(row, cols.get("drcr")))
        raw_amt = str(_cell(row, cols["amount"]) or "").lower()
        is_debit = kind.startswith("d") or kind.startswith("w") or (not kind and (amt < 0 or raw_amt.endswith("dr")))
        debit, credit = (abs(amt), 0.0) if is_debit else (0.0, abs(amt))
    if debit == 0 and credit == 0:
        return None
    bal = parse_amount(_cell(row, cols.get("balance"))) if "balance" in cols else None
    tid = _cell(row, cols.get("txn_id")) if "txn_id" in cols else None
    tid = str(tid).strip() if tid not in (None, "") else None
    return {"txn_id": tid, "date": d, "narration": narration, "debit": round(debit, 2),
            "credit": round(credit, 2), "balance": None if bal is None else round(bal, 2)}


# --------------------------------------------------------------------------- statement header info

_BANKS = (
    ("state bank of india", "State Bank of India"), ("sbi", "State Bank of India"),
    ("hdfc", "HDFC Bank"), ("icici", "ICICI Bank"), ("axis", "Axis Bank"), ("kotak", "Kotak Mahindra Bank"),
    ("punjab national", "Punjab National Bank"), ("bank of baroda", "Bank of Baroda"),
    ("canara", "Canara Bank"), ("union bank", "Union Bank of India"), ("yes bank", "Yes Bank"),
    ("idfc", "IDFC FIRST Bank"), ("indusind", "IndusInd Bank"), ("bank of india", "Bank of India"),
    ("federal bank", "Federal Bank"), ("au small finance", "AU Small Finance Bank"),
    ("airtel payments", "Airtel Payments Bank"), ("india post payments", "India Post Payments Bank"),
    ("paytm payments", "Paytm Payments Bank"),
)
_IFSC_BANKS = {
    "SBIN": "State Bank of India", "HDFC": "HDFC Bank", "ICIC": "ICICI Bank", "UTIB": "Axis Bank",
    "KKBK": "Kotak Mahindra Bank", "PUNB": "Punjab National Bank", "BARB": "Bank of Baroda",
    "CNRB": "Canara Bank", "UBIN": "Union Bank of India", "YESB": "Yes Bank", "IDFB": "IDFC FIRST Bank",
    "INDB": "IndusInd Bank", "BKID": "Bank of India", "FDRL": "Federal Bank", "AUBL": "AU Small Finance Bank",
    "AIRP": "Airtel Payments Bank", "IPOS": "India Post Payments Bank", "PYTM": "Paytm Payments Bank",
}
_HOLDER_RE = re.compile(
    r"(?:account\s*holder(?:\s*name)?|customer\s*name|account\s*name|name\s*of\s*(?:the\s*)?customer|^\s*name)"
    r"\s*[:\-]\s*([A-Za-z][A-Za-z .']{1,60})",
    re.I | re.M,
)
_BANK_LINE_RE = re.compile(
    r"\b((?:[A-Z][A-Za-z&.\-]*[ \t]+){1,4}Bank(?:[ \t]+of[ \t]+[A-Z][a-z]+)?|Bank[ \t]+of[ \t]+[A-Z][a-z]+)\b"
)
_IFSC_RE = re.compile(r"\b([A-Z]{4})0[A-Z0-9]{6}\b")
_ACCT_RE = re.compile(r"(?:a/?c|account)\s*(?:no\.?|number)\s*[:\-]?\s*([X\d*]{4,20})", re.I)


def _header_info(text: str) -> dict:
    info: dict = {}
    m = _HOLDER_RE.search(text)
    if m:
        info["account_holder"] = re.split(r"\s{2,}|\s+(?:Account|A/c|IFSC|Branch|Statement)\b", m.group(1).strip())[0].strip()
    m = _ACCT_RE.search(text)
    if m:
        info["account_number"] = m.group(1)
    m = _BANK_LINE_RE.search(text)
    if m:
        info["bank"] = re.sub(r"\s+", " ", m.group(1)).strip()
    else:
        low = text.lower()
        for key, name in _BANKS:
            if re.search(rf"\b{re.escape(key)}\b", low):
                info["bank"] = name
                break
    if "bank" not in info:
        m = _IFSC_RE.search(text)
        if m and m.group(1) in _IFSC_BANKS:
            info["bank"] = _IFSC_BANKS[m.group(1)]
    return info


# --------------------------------------------------------------------------- finalize

def _finalize(txns: list[dict], meta: dict) -> tuple[list[dict], dict]:
    if not txns:
        raise ParseError(
            "No transactions found. Upload a bank statement with date, description and amount columns "
            "(CSV, PDF or Account Aggregator JSON)."
        )
    # Statements are often newest-first; normalize to chronological while keeping intra-day order.
    if txns[0]["date"] > txns[-1]["date"]:
        txns.reverse()
    meta.setdefault("account_holder", None)
    meta.setdefault("bank", None)
    meta["start_date"] = min(t["date"] for t in txns)
    meta["end_date"] = max(t["date"] for t in txns)
    meta["transaction_count"] = len(txns)
    return txns, meta


# --------------------------------------------------------------------------- CSV

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            text = content.decode(enc)
        except UnicodeDecodeError:
            continue
        if enc == "utf-16" and "\x00" in text:
            continue
        return text
    raise ParseError("Could not read the file's text encoding.")


def parse_csv(content: bytes) -> tuple[list[dict], dict]:
    text = _decode(content)
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    cols = None
    header_idx = -1
    for i, row in enumerate(rows[:60]):
        cols = map_header(row)
        if cols:
            header_idx = i
            break
    if not cols:
        raise ParseError(
            "Couldn't find the transaction table header. Expected columns like Date, Narration/Description, "
            "Withdrawal/Debit, Deposit/Credit and Balance."
        )
    preamble = "\n".join(" ".join(c for c in r if c) for r in rows[:header_idx])
    meta = {"source": "csv", **_header_info(preamble)}
    txns, skipped = [], 0
    for row in rows[header_idx + 1:]:
        if not any((c or "").strip() for c in row):
            continue
        t = _row_to_txn(row, cols)
        if t:
            txns.append(t)
        else:
            skipped += 1
    meta["skipped_rows"] = skipped
    return _finalize(txns, meta)


# --------------------------------------------------------------------------- PDF

_PDF_META_KEYS = ("Producer", "Creator", "CreationDate", "ModDate", "Author", "Title")


def _pdf_str(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, bytes):
        for enc in ("utf-16" if v[:2] in (b"\xfe\xff", b"\xff\xfe") else "utf-8", "latin-1"):
            try:
                return v.decode(enc)
            except UnicodeDecodeError:
                continue
    return str(v)


def parse_pdf_date(s: str | None) -> str | None:
    """PDF date 'D:20261004103000+05'30'' -> ISO 8601 '2026-10-04T10:30:00+05:30'."""
    if not s:
        return None
    m = re.match(r"^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+\-])?(\d{2})?'?(\d{2})?", s.strip())
    if not m:
        return None
    y, mo, d, hh, mi, ss, tz, tzh, tzm = m.groups()
    iso = f"{y}-{mo or '01'}-{d or '01'}T{hh or '00'}:{mi or '00'}:{ss or '00'}"
    if tz in ("Z", "z"):
        iso += "+00:00"
    elif tz in ("+", "-"):
        iso += f"{tz}{tzh or '00'}:{tzm or '00'}"
    return iso


# Row printed as text: date, narration, then 1-3 amount columns (blank columns collapse in text mode).
_TEXT_ROW_RE = re.compile(
    rf"^\s*(?P<date>{_DATE_TOKEN})\s+(?:(?:{_DATE_TOKEN})\s+)?(?P<narr>.+?)\s+"
    rf"(?P<nums>(?:(?:{_AMOUNT_TOKEN})\s+){{0,2}}(?:{_AMOUNT_TOKEN}))\s*$"
)
_NUM_RE = re.compile(_AMOUNT_TOKEN)


def _text_rows(lines: list[str]) -> list[dict]:
    """Best-effort generic statement line parser; infers debit/credit from running balance."""
    out: list[dict] = []
    prev_bal: float | None = None
    for line in lines:
        m = _TEXT_ROW_RE.match(line)
        if not m:
            # continuation of previous narration (wrapped line)
            if out and line.strip() and not _DATE_RE.match(line) and len(line.strip()) < 80 \
                    and not re.search(r"(page \d|opening balance|closing balance|total)", line, re.I):
                out[-1]["narration"] = (out[-1]["narration"] + " " + line.strip()).strip()
            continue
        d = parse_date(m.group("date"))
        if not d:
            continue
        nums = [parse_amount(x) for x in _NUM_RE.findall(m.group("nums"))]
        nums = [n for n in nums if n is not None]
        narr = m.group("narr").strip()
        # strip a trailing reference number column from the narration if present
        ref = None
        rm = re.search(r"\s(\d{8,22})$", narr)
        if rm:
            ref, narr = rm.group(1), narr[: rm.start()].strip()
        debit = credit = 0.0
        bal: float | None = None
        if len(nums) >= 3:
            debit, credit, bal = abs(nums[-3]), abs(nums[-2]), nums[-1]
        elif len(nums) == 2:
            amt, bal = abs(nums[0]), nums[1]
            if prev_bal is not None and abs(prev_bal + amt - bal) <= 1:
                credit = amt
            elif prev_bal is not None and abs(prev_bal - amt - bal) <= 1:
                debit = amt
            elif re.search(r"(/cr/|\bcr\b|credit|deposit|salary|refund|received)", narr, re.I):
                credit = amt
            else:
                debit = amt
        elif len(nums) == 1:
            amt = nums[0]
            if amt < 0 or re.search(r"\bdr\b|/dr/", m.group("nums") + " " + narr, re.I):
                debit = abs(amt)
            else:
                credit = abs(amt)
        if debit == 0 and credit == 0:
            continue
        out.append({"txn_id": ref, "date": d, "narration": narr, "debit": round(debit, 2),
                    "credit": round(credit, 2), "balance": None if bal is None else round(bal, 2)})
        if bal is not None:
            prev_bal = bal
    return out


def parse_pdf(content: bytes) -> tuple[list[dict], dict]:
    try:
        import pdfplumber
    except ImportError as e:  # pragma: no cover - deployment misconfiguration
        raise ParseError("PDF support is not available on this server.") from e
    try:
        pdf = pdfplumber.open(io.BytesIO(content))
    except Exception as e:
        raise ParseError("This PDF could not be opened. It may be corrupted or password-protected.") from e
    with pdf:
        raw_meta = pdf.metadata or {}
        pdf_metadata = {k: _pdf_str(raw_meta.get(k)) for k in _PDF_META_KEYS}
        pdf_metadata["page_count"] = len(pdf.pages)
        txns: list[dict] = []
        cols: dict[str, int] | None = None
        ncols = 0
        first_text = (pdf.pages[0].extract_text() or "") if pdf.pages else ""
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    # wrapped cells: a break right after '/' was a mid-token wrap; otherwise it was a space
                    cells = [re.sub(r"\s*\n\s*", " ", re.sub(r"/\n", "/", c)).strip() if isinstance(c, str) else ""
                             for c in row]
                    hdr = map_header(cells)
                    if hdr:
                        cols, ncols = hdr, len(cells)
                        continue
                    if cols and len(cells) == ncols:
                        t = _row_to_txn(cells, cols)
                        if t:
                            txns.append(t)
        source_mode = "table"
        all_text = ""
        if not txns:  # no ruled table: fall back to line-by-line text parsing
            all_text = "\n".join((p.extract_text() or "") for p in pdf.pages)
            txns = _text_rows(all_text.splitlines())
            source_mode = "text"
    if not txns and not all_text.strip():
        raise ParseError("This PDF has no selectable text (it looks like a scanned image). "
                         "Please upload the e-statement PDF downloaded from your bank, or a CSV export.")
    # header details live above the transaction table; avoid matching bank codes inside narrations
    header_text = "\n".join(first_text.splitlines()[:15])
    meta = {"source": "pdf", **_header_info(header_text), "pdf_metadata": pdf_metadata, "pdf_extraction": source_mode}
    return _finalize(txns, meta)


# --------------------------------------------------------------------------- Account Aggregator (ReBIT FI schema)

def _ci_get(d: dict, *names):
    """Case-insensitive dict get trying several key names."""
    if not isinstance(d, dict):
        return None
    lower = {k.lower(): v for k, v in d.items()} if isinstance(d, dict) else {}
    for n in names:
        if n in d:
            return d[n]
        v = lower.get(n.lower())
        if v is not None:
            return v
    return None


def _as_list(v) -> list:
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def _find_accounts(obj, found: list) -> None:
    """Collect every ReBIT 'Account' object (one with Transactions) anywhere in the payload."""
    if isinstance(obj, dict):
        tx = _ci_get(obj, "Transactions")
        if tx is not None and (isinstance(tx, dict) or isinstance(tx, list)):
            found.append(obj)
            return
        for v in obj.values():
            _find_accounts(v, found)
    elif isinstance(obj, list):
        for v in obj:
            _find_accounts(v, found)


def _find_key(obj, key: str):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() == key.lower() and isinstance(v, (str, int)):
                return v
        for v in obj.values():
            r = _find_key(v, key)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find_key(v, key)
            if r is not None:
                return r
    return None


def parse_aa_json(content: bytes) -> tuple[list[dict], dict]:
    try:
        data = json.loads(_decode(content))
    except json.JSONDecodeError as e:
        raise ParseError(f"The JSON file is not valid (line {e.lineno}).") from e
    accounts: list = []
    _find_accounts(data, accounts)
    if not accounts:
        raise ParseError("This JSON doesn't look like Account Aggregator FI data (no Account.Transactions found).")

    def txn_list(acc):
        tx = _ci_get(acc, "Transactions")
        if isinstance(tx, dict):
            return _as_list(_ci_get(tx, "Transaction"))
        return _as_list(tx)

    acc = max(accounts, key=lambda a: len(txn_list(a)))
    txns = []
    skipped = 0
    for t in txn_list(acc):
        if not isinstance(t, dict):
            skipped += 1
            continue
        d = parse_date(_ci_get(t, "valueDate", "transactionTimestamp", "txnDate", "date"))
        amt = parse_amount(_ci_get(t, "amount"))
        kind = str(_ci_get(t, "type") or "").upper()
        if not d or amt is None or kind not in ("DEBIT", "CREDIT"):
            skipped += 1
            continue
        bal = parse_amount(_ci_get(t, "currentBalance", "balance"))
        tid = _ci_get(t, "txnId", "reference")
        txns.append({
            "txn_id": str(tid) if tid not in (None, "") else None,
            "date": d,
            "narration": re.sub(r"\s+", " ", str(_ci_get(t, "narration") or "")).strip(),
            "debit": round(abs(amt), 2) if kind == "DEBIT" else 0.0,
            "credit": round(abs(amt), 2) if kind == "CREDIT" else 0.0,
            "balance": None if bal is None else round(bal, 2),
        })

    profile = _ci_get(acc, "Profile") or {}
    holders = _ci_get(profile, "Holders") or {}
    holder = _as_list(_ci_get(holders, "Holder"))
    holder_name = _ci_get(holder[0], "name") if holder and isinstance(holder[0], dict) else None
    summary = _ci_get(acc, "Summary") or {}
    ifsc = str(_ci_get(summary, "ifscCode") or "")
    bank = _IFSC_BANKS.get(ifsc[:4].upper()) if ifsc else None
    fip = _find_key(data, "fipName") or _find_key(data, "fipId") or _find_key(data, "fipID")
    if not bank and fip:
        bank = str(fip)
    meta = {
        "source": "aa_json",
        "account_holder": holder_name,
        "bank": bank,
        "account_number": _ci_get(acc, "maskedAccNumber"),
        "account_type": _ci_get(summary, "type"),
        "accounts_found": len(accounts),
        "skipped_rows": skipped,
    }
    return _finalize(txns, meta)


# --------------------------------------------------------------------------- entry point

def parse_upload(filename: str, content: bytes) -> tuple[list[dict], dict]:
    """Detect the format from content (falling back to extension) and parse it."""
    if not content or not content.strip():
        raise ParseError("The uploaded file is empty.")
    name = (filename or "").lower()
    head = content.lstrip()[:8]
    if head.startswith(b"%PDF") or name.endswith(".pdf"):
        return parse_pdf(content)
    if head[:1] in (b"{", b"[") or name.endswith(".json"):
        return parse_aa_json(content)
    if name.endswith((".xls", ".xlsx")) or head.startswith(b"PK"):
        raise ParseError("Excel files aren't supported yet. Please export the statement as CSV or PDF.")
    return parse_csv(content)

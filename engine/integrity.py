"""Statement integrity / tamper checks (stdlib only).

check_integrity(transactions, meta) -> Report.integrity:
    {"status": "pass|warn|fail", "score": 0-100,
     "checks": [{"id", "label", "problem", "status", "detail", "critical",
                 "evidence": [{"date", "narration", "amount", "note"}]}],
     "txn_flags": [[flag, ...] per input transaction]}   # popped by the API before responding
`label` is phrased as the passing condition, `problem` as the failure. Evidence "amount" is signed: +credit, -debit.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date, datetime

__all__ = ["check_integrity"]

BALANCE_TOLERANCE = 1.0          # ₹
ROUND_TRIP_WINDOW_DAYS = 3       # 72 hours (statements carry dates, not times)
ROUND_TRIP_MIN_AMOUNT = 1000.0
MAX_EVIDENCE = 12

# Producers/creators of consumer PDF editors and office tools. Bank e-statements are produced by
# statement engines (iText, Jasper, Crystal, PDFlib, ReportLab, ...), never by these.
_EDITOR_PATTERNS = (
    ("ilovepdf", "iLovePDF"), ("pdfescape", "PDFescape"), ("sejda", "Sejda"), ("smallpdf", "Smallpdf"),
    ("pdffiller", "pdfFiller"), ("dochub", "DocHub"), ("pdf24", "PDF24"), ("foxit phantom", "Foxit PhantomPDF"),
    ("foxit pdf editor", "Foxit PDF Editor"), ("nitro", "Nitro PDF"), ("pdfelement", "Wondershare PDFelement"),
    ("wondershare", "Wondershare PDFelement"), ("pdf-xchange", "PDF-XChange Editor"), ("canva", "Canva"),
    ("adobe acrobat pro", "Adobe Acrobat (edit)"), ("acrobat pro dc", "Adobe Acrobat (edit)"),
    ("adobe acrobat standard", "Adobe Acrobat (edit)"), ("adobe acrobat 2", "Adobe Acrobat (edit)"),
    ("microsoft® word", "Microsoft Word"), ("microsoft word", "Microsoft Word"), ("libreoffice", "LibreOffice"),
    ("openoffice", "OpenOffice"), ("google docs", "Google Docs"), ("wps", "WPS Office"),
    ("photoshop", "Adobe Photoshop"), ("inkscape", "Inkscape"),
)

_SALARY_RE = re.compile(r"\b(salary|sal|payroll|wages|stipend)\b|sal(?:ary)?[ /_-]?cr|/sal/", re.I)
_REVERSAL_RE = re.compile(r"\b(rev|reversal|reversed|refund|return|failed|chargeback)\b", re.I)
_CHANNEL_TOKENS = {
    "upi", "neft", "imps", "rtgs", "cr", "dr", "p2a", "p2m", "p2p", "inb", "mob", "mb", "trf", "transfer", "to",
    "from", "by", "ib", "ft", "ach", "nach", "ecs", "pos", "atm", "cash", "chq", "clg", "inft", "bil", "billpay",
    "payment", "paid", "received", "rcvd", "credit", "debit", "sent", "via", "ref", "txn", "no", "mmt", "self",
    "tpt", "onl", "net", "netbanking", "funds", "fund", "the", "ac", "acct", "account", "bank",
}
_KNOWN_BANK_CODES = {
    "sbin", "hdfc", "icic", "utib", "kkbk", "punb", "barb", "cnrb", "ubin", "yesb", "idfb", "indb", "bkid",
    "fdrl", "aubl", "airp", "ipos", "pytm", "ibkl", "mahb", "cbin", "ioba", "uco", "ucba", "psib",
    "sbi", "axis", "kotak", "ybl", "okaxis", "oksbi", "okhdfcbank", "okicici", "paytm", "apl", "ibl",
}


# --------------------------------------------------------------------------- helpers

def _d(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _amount(t: dict) -> float:
    return round(float(t.get("credit") or 0) - float(t.get("debit") or 0), 2)


def _ev(t: dict, note: str | None = None) -> dict:
    e = {"date": t["date"], "narration": t.get("narration", ""), "amount": _amount(t)}
    if note:
        e["note"] = note
    return e


def _inr(x: float) -> str:
    """Indian digit grouping: 123456.5 -> ₹1,23,456."""
    neg = x < 0
    s = str(int(round(abs(x))))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups + [tail])
    return ("-₹" if neg else "₹") + s


def counterparty(narration: str) -> str | None:
    """Best-effort counterparty key from UPI/NEFT/IMPS-style narrations.

    'UPI/CR/412345678901/RAHUL SHARMA/HDFC/rahul.s@okhdfcbank' -> 'rahulsharma'
    """
    if not narration:
        return None
    vpa = re.search(r"([a-z0-9._\-]{3,})@[a-z]{2,}", narration, re.I)
    for p in re.split(r"[/|:]+|-|\s{2,}", narration):
        p = p.strip()
        if not p or "@" in p or re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", p):  # VPA / IFSC
            continue
        # drop reference numbers and channel words ("NEFT PYTMN2608371953479 MAA DURGA" -> "maadurga")
        words = [w.lower() for w in p.split() if not any(c.isdigit() for c in w)]
        words = [re.sub(r"[^a-z]", "", w) for w in words if w not in _CHANNEL_TOKENS]
        words = [w for w in words if w and w not in _CHANNEL_TOKENS]
        key = "".join(words)
        if len(key) < 3 or (len(words) == 1 and key in _KNOWN_BANK_CODES):
            continue
        return key
    if vpa:
        return re.sub(r"[^a-z]", "", vpa.group(1).lower()) or None
    return None


def _same_party(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return a == b or (min(len(a), len(b)) >= 5 and (a in b or b in a))


def _month_key(s: str) -> str:
    return s[:7]


def _months_between(a: str, b: str) -> list[str]:
    y, m = int(a[:4]), int(a[5:7])
    ey, em = int(b[:4]), int(b[5:7])
    out = []
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


# Failure-phrased name of each check, for summaries ("the statement failed checks: running balance doesn't add up").
_PROBLEMS = {
    "balance_continuity": "running balance doesn't add up",
    "duplicate_txn_ids": "repeated transactions",
    "date_order_and_gaps": "missing or out-of-order dates",
    "pdf_metadata": "the PDF was edited after the bank issued it",
    "round_tripping": "money sent straight back to the payer to inflate income",
    "salary_consistency": "salary amounts look altered",
    "statement_period": "statement period is too short",
}


def _check(cid: str, label: str, status: str, detail: str, critical: bool, evidence=None) -> dict:
    return {"id": cid, "label": label, "problem": _PROBLEMS[cid], "status": status, "detail": detail,
            "critical": critical, "evidence": (evidence or [])[:MAX_EVIDENCE]}


# --------------------------------------------------------------------------- checks

def _balance_continuity(txns: list[dict], flags: list[list[str]]) -> tuple[dict, set[int]]:
    label = "Running balance is consistent"
    pairs = 0
    bad: list[int] = []
    prev_bal = None
    for i, t in enumerate(txns):
        bal = t.get("balance")
        if bal is None:
            continue
        if prev_bal is not None:
            pairs += 1
            expected = round(prev_bal - float(t.get("debit") or 0) + float(t.get("credit") or 0), 2)
            if abs(expected - bal) > BALANCE_TOLERANCE:
                bad.append(i)
                t["_expected_balance"] = expected
        prev_bal = bal
    if pairs == 0:
        return _check("balance_continuity", label, "warn",
                      "This statement has no running balance column, so the arithmetic can't be verified.",
                      True), set()
    evidence = []
    for i in bad:
        t = txns[i]
        flags[i].append("balance_mismatch")
        evidence.append(_ev(t, f"Balance shown {_inr(t['balance'])}, but previous balance "
                               f"{'+' if _amount(t) >= 0 else '−'} amount = {_inr(t.pop('_expected_balance'))}"))
    if bad:
        return _check("balance_continuity", label, "fail",
                      f"{len(bad)} of {pairs} rows don't add up: previous balance ± amount ≠ the balance printed. "
                      "Amounts or balances were likely altered.", True, evidence), set(bad)
    return _check("balance_continuity", label, "pass",
                  f"All {pairs} rows add up to the printed running balance (±₹1).", True), set()


def _duplicates(txns: list[dict], flags: list[list[str]]) -> dict:
    label = "No duplicate transactions"
    ids = [t.get("txn_id") for t in txns]
    with_ids = [i for i in ids if i]
    if with_ids:
        counts = Counter(with_ids)
        dups = {k for k, c in counts.items() if c > 1}
        if dups:
            ev = []
            for i, t in enumerate(txns):
                if t.get("txn_id") in dups:
                    flags[i].append("duplicate_id")
                    ev.append(_ev(t, f"Reference {t['txn_id']} appears {counts[t['txn_id']]} times"))
            return _check("duplicate_txn_ids", label, "fail",
                          f"{len(dups)} transaction reference number(s) appear more than once. "
                          "Bank reference numbers are unique, so rows were copied.", True, ev)
        return _check("duplicate_txn_ids", label, "pass",
                      f"All {len(with_ids)} transaction reference numbers are unique.", True)
    # No ids: look for byte-identical rows including the running balance (impossible in a real ledger)
    keyed = Counter((t["date"], t.get("narration"), t.get("debit"), t.get("credit"), t.get("balance"))
                    for t in txns if t.get("balance") is not None)
    dups = {k for k, c in keyed.items() if c > 1}
    if dups:
        ev = []
        for i, t in enumerate(txns):
            if (t["date"], t.get("narration"), t.get("debit"), t.get("credit"), t.get("balance")) in dups:
                flags[i].append("duplicate_row")
                ev.append(_ev(t, "Identical row (same date, amount and balance)"))
        return _check("duplicate_txn_ids", label, "fail",
                      f"{len(dups)} row(s) are exact copies including the running balance.", True, ev)
    return _check("duplicate_txn_ids", label, "pass",
                  "No repeated rows found (statement has no reference numbers to compare).", True)


def _date_order_and_gaps(txns: list[dict]) -> dict:
    label = "Dates are in order with no missing months"
    out_of_order = [i for i in range(1, len(txns)) if txns[i]["date"] < txns[i - 1]["date"]]
    dates = sorted({t["date"] for t in txns})
    months_present = {_month_key(d) for d in dates}
    all_months = _months_between(dates[0], dates[-1])
    missing = [m for m in all_months if m not in months_present]
    longest, gap_from, gap_to = 0, None, None
    for a, b in zip(dates, dates[1:]):
        g = (_d(b) - _d(a)).days
        if g > longest:
            longest, gap_from, gap_to = g, a, b
    ev = [_ev(txns[i], f"Dated before the previous row ({txns[i - 1]['date']})") for i in out_of_order]
    if gap_from and longest > 30:
        ev.append({"date": gap_from, "narration": f"No transactions from {gap_from} to {gap_to}", "amount": 0,
                   "note": f"{longest}-day gap"})
    problems = []
    if out_of_order:
        problems.append(f"{len(out_of_order)} row(s) are out of date order")
    if missing:
        problems.append(f"no transactions at all in {', '.join(missing)}")
    if longest > 30:
        problems.append(f"a {longest}-day gap with no activity")
    if not problems:
        return _check("date_order_and_gaps", label, "pass",
                      f"Every month from {all_months[0]} to {all_months[-1]} has activity; longest quiet spell "
                      f"is {longest} days.", False)
    status = "fail" if (len(out_of_order) > 2 or len(missing) >= 2) else "warn"
    return _check("date_order_and_gaps", label, status,
                  "; ".join(problems).capitalize() + ". Pages or rows may have been removed.", False, ev)


def _parse_pdf_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    from .parse import parse_pdf_date
    iso = parse_pdf_date(s) if not re.match(r"^\d{4}-\d{2}-\d{2}T", s) else s
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso)
    except ValueError:
        return None


def _pdf_metadata(meta: dict) -> dict | None:
    if meta.get("source") != "pdf":
        return None
    label = "PDF file hasn't been edited"
    md = meta.get("pdf_metadata") or {}
    producer = md.get("Producer") or ""
    creator = md.get("Creator") or ""
    created = _parse_pdf_iso(md.get("CreationDate"))
    modified = _parse_pdf_iso(md.get("ModDate"))
    ev = []
    for k in ("Producer", "Creator", "CreationDate", "ModDate"):
        if md.get(k):
            when = _parse_pdf_iso(md[k]) if k.endswith("Date") else None
            shown = when.strftime("%d %b %Y %H:%M") if when else md[k]
            ev.append({"date": when.date().isoformat() if when else "", "narration": f"{k}: {shown}", "amount": 0})
    issues, fail = [], False
    tools = {name for pat, name in _EDITOR_PATTERNS if pat in producer.lower() or pat in creator.lower()}
    if tools:
        fail = True
        issues.append(f"the file was last saved by {', '.join(sorted(tools))}, a PDF/document editor — "
                      "bank e-statements are generated by the bank's own system")
    if created and modified:
        try:
            delta = (modified - created).total_seconds()
        except TypeError:  # naive vs aware
            delta = (modified.replace(tzinfo=None) - created.replace(tzinfo=None)).total_seconds()
        if delta > 60:
            fail = True
            hrs = delta / 3600
            when = f"{hrs / 24:.0f} days" if hrs >= 48 else f"{hrs:.1f} hours"
            issues.append(f"it was modified {when} after the bank created it")
    elif md.get("ModDate") and md.get("CreationDate") and md.get("ModDate") != md.get("CreationDate"):
        fail = True
        issues.append("its modification date differs from its creation date")
    if not producer and not creator and not md.get("CreationDate"):
        return _check("pdf_metadata", label, "warn",
                      "The PDF has no producer or creation-date information; it may have been re-saved or scrubbed.",
                      True, ev)
    if fail:
        return _check("pdf_metadata", label, "fail", "The PDF shows signs of editing: " + "; ".join(issues) + ".",
                      True, ev)
    return _check("pdf_metadata", label, "pass",
                  f"Produced by '{producer or creator}', never modified after creation.", True, ev)


def _round_tripping(txns: list[dict], flags: list[list[str]]) -> dict:
    label = "No money going in and straight back out"
    total_credit = sum(float(t.get("credit") or 0) for t in txns) or 1.0
    parties = [counterparty(t.get("narration", "")) for t in txns]
    used_debits: set[int] = set()
    pairs: list[tuple[int, int]] = []
    for i, t in enumerate(txns):
        c = float(t.get("credit") or 0)
        if c < ROUND_TRIP_MIN_AMOUNT or not parties[i] or _REVERSAL_RE.search(t.get("narration", "")):
            continue
        di = _d(t["date"])
        for j in range(i + 1, len(txns)):
            u = txns[j]
            gap = (_d(u["date"]) - di).days
            if gap > ROUND_TRIP_WINDOW_DAYS:
                break
            dbt = float(u.get("debit") or 0)
            if j in used_debits or dbt <= 0 or gap < 0:
                continue
            if abs(dbt - c) <= max(100.0, 0.02 * c) and _same_party(parties[i], parties[j]):
                pairs.append((i, j))
                used_debits.add(j)
                break
    if not pairs:
        return _check("round_tripping", label, "pass",
                      "No credits were sent back to the same person within 72 hours.", True)
    inflated = sum(float(txns[i]["credit"]) for i, _ in pairs)
    share = inflated / total_credit
    ev = []
    for i, j in pairs:
        flags[i].append("round_trip")
        flags[j].append("round_trip")
        hrs = (_d(txns[j]["date"]) - _d(txns[i]["date"])).days * 24
        ev.append(_ev(txns[i], "Money in"))
        ev.append(_ev(txns[j], f"Same amount sent back to the same person within {hrs or '<24'} hours"))
    status = "fail" if (len(pairs) >= 2 or share >= 0.10) else "warn"
    return _check("round_tripping", label, status,
                  f"{len(pairs)} credit(s) totalling {_inr(inflated)} ({share:.0%} of all money in) were returned to "
                  "the sender within 72 hours. This inflates apparent income; these amounts shouldn't count as income.",
                  True, ev)


def _salary_consistency(txns: list[dict], bad_rows: set[int], flags: list[list[str]]) -> dict:
    label = "Salary credits look regular"
    sal = [i for i, t in enumerate(txns) if float(t.get("credit") or 0) > 0 and _SALARY_RE.search(t.get("narration", ""))]
    if not sal:
        return _check("salary_consistency", label, "pass",
                      "No salary credits are claimed on this statement; income is assessed from cash flow instead.",
                      False)
    amounts = sorted(float(txns[i]["credit"]) for i in sal)
    median = amounts[len(amounts) // 2] if len(amounts) % 2 else (amounts[len(amounts) // 2 - 1] + amounts[len(amounts) // 2]) / 2
    dev = {i: (float(txns[i]["credit"]) - median) / median for i in sal} if median > 0 else {i: 0.0 for i in sal}
    # Higher-than-usual salary is how income gets inflated; a lower month (leave without pay, joining/exit month)
    # is common and only matters if it keeps happening.
    high = [i for i in sal if dev[i] > 0.25]
    low = [i for i in sal if dev[i] < -0.25]
    days = [int(txns[i]["date"][8:10]) for i in sal]
    day_med = sorted(days)[len(days) // 2]
    off_day = [i for i in sal if min(abs(int(txns[i]["date"][8:10]) - day_med),
                                     31 - abs(int(txns[i]["date"][8:10]) - day_med)) > 7]
    close = [j for k, j in enumerate(sal[1:], 1) if (_d(txns[j]["date"]) - _d(txns[sal[k - 1]]["date"])).days < 20]
    ev = []
    for i in high + low:
        if i in high:
            flags[i].append("salary_outlier")
        ev.append(_ev(txns[i], f"{abs(dev[i]):.0%} {'above' if dev[i] > 0 else 'below'} the usual salary of {_inr(median)}"))
    for i in off_day:
        if i not in high and i not in low:
            ev.append(_ev(txns[i], f"Paid on day {txns[i]['date'][8:10]}; usually around day {day_med}"))
    for j in close:
        ev.append(_ev(txns[j], "Second salary credit within 20 days"))
    problems = []
    if high:
        problems.append(f"{len(high)} salary credit(s) are more than 25% above the usual {_inr(median)}")
    if len(low) >= 3:
        problems.append(f"{len(low)} salary credit(s) are more than 25% below the usual {_inr(median)}")
    if len(off_day) > max(1, len(sal) // 4):
        problems.append(f"{len(off_day)} salary credit(s) arrive on unusual dates")
    if close:
        problems.append(f"{len(close)} extra salary credit(s) arrive within 20 days of the previous one")
    if not problems:
        note = f" {len(low)} month(s) paid less than usual, which is common (leave or a partial month)." if low else ""
        return _check("salary_consistency", label, "pass",
                      f"{len(sal)} salary credits of about {_inr(median)}, paid around day {day_med} each month.{note}",
                      False, ev)
    edited = any(i in bad_rows for i in high)
    status = "fail" if edited or len(high) >= 2 or len(close) >= 2 else "warn"
    detail = "; ".join(problems).capitalize() + "."
    if edited:
        detail += " The unusual salary row also breaks the running balance, which suggests the amount was edited."
    return _check("salary_consistency", label, status, detail, False, ev)


def _statement_period(txns: list[dict]) -> dict:
    label = "Statement covers at least 6 months"
    start, end = _d(txns[0]["date"]), _d(txns[-1]["date"])
    start, end = min(start, end), max(start, end)
    months = ((end - start).days + 1) / 30.44
    detail = f"Covers {months:.1f} months ({start.isoformat()} to {end.isoformat()})."
    if months >= 5.8:
        return _check("statement_period", label, "pass", detail, False)
    if months >= 3:
        return _check("statement_period", label, "warn", detail + " At least 6 months gives a more reliable assessment.", False)
    return _check("statement_period", label, "fail", detail + " Too short to judge income stability — please upload 6+ months.", False)


# --------------------------------------------------------------------------- entry point

_WEIGHTS = {  # (critical, status) -> penalty
    (True, "fail"): 40, (True, "warn"): 12, (False, "fail"): 15, (False, "warn"): 7,
}


def check_integrity(transactions: list[dict], meta: dict) -> dict:
    txns = [dict(t) for t in transactions]  # never mutate caller data
    flags: list[list[str]] = [[] for _ in txns]
    if not txns:
        return {"status": "fail", "score": 0, "checks": [
            _check("statement_period", "Statement covers at least 6 months", "fail", "No transactions found.", False)],
            "txn_flags": []}
    bal_check, bad_rows = _balance_continuity(txns, flags)
    checks = [
        bal_check,
        _duplicates(txns, flags),
        _date_order_and_gaps(txns),
    ]
    pdf = _pdf_metadata(meta or {})
    if pdf:
        checks.append(pdf)
    checks += [
        _round_tripping(txns, flags),
        _salary_consistency(txns, bad_rows, flags),
        _statement_period(txns),
    ]
    score = 100
    for c in checks:
        score -= _WEIGHTS.get((c["critical"], c["status"]), 0)
    if any(c["critical"] and c["status"] == "fail" for c in checks):
        status = "fail"
        score = min(score, 45)
    elif any(c["status"] != "pass" for c in checks):
        status = "warn"
    else:
        status = "pass"
    return {"status": status, "score": max(0, min(100, score)), "checks": checks,
            "txn_flags": [sorted(set(f)) for f in flags]}

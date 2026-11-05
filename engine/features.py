"""Cash-flow feature engineering from categorized transactions.

One implementation shared by training (ml/train_risk.py) and runtime
(engine/analyze.py); numpy + stdlib only.
"""

from __future__ import annotations

import math
import re
from collections import defaultdict
from difflib import SequenceMatcher
from datetime import date, timedelta

import numpy as np

from .categorize import INCOME_CATEGORIES
from .text import inr, months_between, to_date

ESSENTIALS = {"rent", "groceries", "utilities", "mobile_recharge", "fuel_transport", "healthcare", "education", "insurance"}
DISCRETIONARY = {"food_delivery", "shopping", "betting_gaming"}
RECURRING_BILLS = ("rent", "utilities", "mobile_recharge", "emi_loan", "insurance")
SOURCE_TYPE = {"salary": "salary", "gig_income": "gig", "business_income": "business", "agri_income": "agri",
               "family_transfer_in": "transfer"}
MIN_INCOME = 1000.0          # ₹/month below which a statement has no verifiable income
MAX_BUFFER_MONTHS = 12.0     # balance buffer is capped (also the scorecard's clip)
LOW_BALANCE = 1000.0

# key → (label, display format)
FEATURES = {
    "income_monthly_avg": ("Average monthly income", "inr"),
    "income_monthly_median": ("Typical monthly income", "inr"),
    "income_net_monthly": ("Income available for repayments", "inr"),
    "income_cv": ("Income variability", "ratio"),
    "income_months_ratio": ("Months with income", "pct"),
    "income_sources": ("Income sources", "count"),
    "avg_balance": ("Average balance", "inr"),
    "min_balance": ("Lowest balance", "inr"),
    "low_balance_days": ("Days with balance under ₹1,000", "pct"),
    "buffer_months": ("Savings buffer (months of income)", "ratio"),
    "net_cashflow_ratio": ("Money left over each month", "pct"),
    "essentials_share": ("Spend on essentials", "pct"),
    "discretionary_share": ("Spend on non-essentials", "pct"),
    "emi_monthly": ("Existing loan EMIs per month", "inr"),
    "foir": ("Income already going to EMIs", "pct"),
    "bounces": ("Bounced payments", "count"),
    "bounce_rate": ("Bounced payments per month", "ratio"),
    "loan_app_txns": ("Instant loan app transactions", "count"),
    "loan_app_rate": ("Instant loan app use per month", "ratio"),
    "betting_share": ("Spend on betting & gaming", "pct"),
    "cash_share": ("Spend withdrawn as cash", "pct"),
    "bill_regularity": ("Bills paid regularly", "pct"),
    "savings_rate": ("Income saved or invested", "pct"),
    "pre_income_buffer": ("Balance left before income arrives", "ratio"),
    "bank_charge_rate": ("Penalty charges per month", "ratio"),
    "months_covered": ("Months of history", "count"),
}

_STOP = {
    "UPI", "CR", "DR", "NEFT", "IMPS", "RTGS", "ACH", "NACH", "ECS", "P2A", "P2M", "MMT", "PAYOUT", "WEEKLY",
    "PARTNER", "SETTLEMENT", "SETTL", "SALARY", "SAL", "PAYMENT", "PAY", "NA", "SENT", "EARNINGS", "INCENTIVE",
    "MERCHANT", "BY", "TO", "TRANSFER", "DEBIT", "CREDIT", "ACHDR", "ACHCR", "BIL", "BPAY", "BBPS", "INT", "REV",
    "OK", "PAID", "QR", "GOODS", "DBT", "LOAN", "DISB", "DISBURSAL", "EMI", "REIMB", "BONUS", "PAYROLL", "UPI PAYMENT",
    "FROM", "THANKS", "STOCK", "BILL", "MILK", "MSP", "PADDY", "CROP", "PROCUREMENT", "FORTNIGHT", "SHG", "C", "D",
}
_KNOWN_INCOME = [  # regex on narration → display name
    (r"BUNDL|SWIGGY", "Swiggy"), (r"ZOMATO", "Zomato"), (r"UBER", "Uber"), (r"ROPPEN|RAPIDO", "Rapido"),
    (r"URBANCLAP|URBAN COMPANY", "Urban Company"), (r"ANI TECH|OLA ", "Ola"), (r"SMARTSHIFT|PORTER", "Porter"),
    (r"KIRANAKART|ZEPTO", "Zepto"), (r"BLINK COMM|BLINKIT", "Blinkit"), (r"SHADOWFAX", "Shadowfax"),
    (r"DUNZO", "Dunzo"), (r"AMAZON FLEX", "Amazon Flex"), (r"PHONEPE", "PhonePe settlements"),
    (r"PAYTM ?PAY|PAYTM\.?SETTLE", "Paytm settlements"), (r"BHARATPE", "BharatPe settlements"),
    (r"RAZORPAY", "Razorpay settlements"), (r"GOOGLE PAY|GPAYMERCHANT", "Google Pay settlements"),
    (r"PINE LABS", "Card machine settlements"), (r"KISAN|PMKSNY", "PM-KISAN"), (r"RYTHU", "Rythu Bharosa"),
    (r"SCHOLARSHIP|VIDYA DEEVENA|EPASS", "Scholarship"),
]
_KNOWN_LENDERS = [
    (r"BAJAJ", "Bajaj Finance"), (r"HDB FIN", "HDB Financial"), (r"HDFC BANK|HDFC LTD", "HDFC Bank"),
    (r"ICICI BANK", "ICICI Bank"), (r"TATA CAP", "Tata Capital"), (r"HOME CREDIT", "Home Credit"),
    (r"SHRIRAM", "Shriram Finance"), (r"MAHINDRA", "Mahindra Finance"), (r"L AND T|L&T", "L&T Finance"),
    (r"HERO FIN", "Hero FinCorp"), (r"TVS CRED", "TVS Credit"), (r"MUTHOOT", "Muthoot Finance"),
    (r"MANAPPURAM", "Manappuram Finance"), (r"AXIS BANK", "Axis Bank"), (r"IDFC", "IDFC FIRST Bank"),
    (r"CHOLA", "Cholamandalam"), (r"AAVAS", "Aavas"), (r"SBI CARD", "SBI Card"), (r"KCC", "Kisan Credit Card"),
    (r"STREE NIDHI|SHG|DWCRA|SERP|MAHILA", "SHG loan"),
]
_INCOME_RE = [(re.compile(p), n) for p, n in _KNOWN_INCOME]
_LENDER_RE = [(re.compile(p), n) for p, n in _KNOWN_LENDERS]

_MONTHS = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "FOR", "THE", "MONTH"}


def counterparty(narration: str, lender: bool = False) -> str:
    """Best-effort payer/payee name from a bank narration."""
    s = (narration or "").upper()
    for rx, name in (_LENDER_RE if lender else _INCOME_RE):
        if rx.search(s):
            return name
    s = re.sub(r"^(BY|TO) TRANSFER-", "", s)
    for part in re.split(r"[/\-\*:]|\s{2,}", s):
        if "@" in part:
            continue
        words = [re.sub(r"[^A-Z&]", "", w) for w in part.split() if sum(ch.isdigit() for ch in w) < 2]
        run: list[str] = []
        for w in words:
            if not w:
                continue
            if w in _STOP or w in _MONTHS:
                if run:
                    break
                continue
            run.append(w)
        while len(run) > 1 and len(run[-1]) <= 2:  # bank-truncated tail ("BLUE DART SO")
            run.pop()
        if run and len("".join(run)) >= 3:
            return " ".join(run[:3]).title()
    m = re.search(r"([a-z0-9.\-_]+)@", narration or "")
    return m.group(1) if m else "Unknown"


def _month(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _daily_balances(rows: list[dict], start: date, end: date) -> np.ndarray:
    """End-of-day balance for every calendar day in [start, end]."""
    eod: dict[date, float] = {}
    for r in rows:
        eod[r["_d"]] = r["_bal"]
    first_bal = rows[0]["_bal"] + rows[0]["debit"] - rows[0]["credit"]
    out, cur, d = [], first_bal, start
    while d <= end:
        cur = eod.get(d, cur)
        out.append(cur)
        d += timedelta(days=1)
    return np.asarray(out, dtype=float)


def income_sources(rows: list[dict], months: float) -> list[dict]:
    """Cluster income credits by payer; tiny one-off payers fold into a bucket per type."""
    clusters: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in rows:
        if r["credit"] > 0 and r["category"] in INCOME_CATEGORIES:
            clusters[(counterparty(r["narration"]), r["category"])].append(r["credit"])
    # typo'd / truncated spellings of a regular payer ("Blue Dart" vs "Bue Dart") join its cluster
    big = [k for k, v in clusters.items() if len(v) >= 3]
    for k in [k for k in clusters if k not in big]:
        for b in big:
            if b[1] == k[1]:
                sm = SequenceMatcher(None, b[0], k[0])
                if sm.quick_ratio() >= 0.8 and sm.ratio() >= 0.8:
                    clusters[b].extend(clusters.pop(k))
                    break
    merged: dict[tuple[str, str], list[float]] = defaultdict(list)
    total = sum(sum(v) for v in clusters.values()) or 1.0
    bucket = {"business_income": "Customer UPI payments", "family_transfer_in": "Family & friends",
              "gig_income": "Other gig payouts", "agri_income": "Other farm income", "salary": "Other employer pay"}
    for (name, cat), amts in clusters.items():
        if name == "Unknown" or (len(amts) < 3 and sum(amts) < 0.1 * total):
            merged[(bucket[cat], cat)].extend(amts)
        else:
            merged[(name, cat)].extend(amts)
    out = [{"name": name, "type": SOURCE_TYPE[cat], "monthly_avg": round(sum(a) / max(months, 1.0), 2), "count": len(a)}
           for (name, cat), a in merged.items() if sum(a) >= 0.02 * total]
    return sorted(out, key=lambda s: -s["monthly_avg"])


def _prepare(transactions: list[dict]) -> tuple[list[dict], bool]:
    rows = []
    for i, t in enumerate(transactions):
        row = {**t, "_d": to_date(t["date"]), "_i": i, "debit": float(t.get("debit") or 0.0),
               "credit": float(t.get("credit") or 0.0)}
        # money that round-trips back out (integrity flag) is not income
        if "round_trip" in (t.get("flags") or ()) and row["category"] in INCOME_CATEGORIES:
            row["category"] = "transfer_in_other"
        rows.append(row)
    rows.sort(key=lambda r: (r["_d"], r["_i"]))
    has_balance = all(r.get("balance") is not None for r in rows)
    if has_balance:
        for r in rows:
            r["_bal"] = float(r["balance"])
    else:  # reconstruct relative balance; anchor its minimum at zero (conservative)
        cum = np.cumsum([r["credit"] - r["debit"] for r in rows])
        cum = cum - min(0.0, float(cum.min()))
        for r, b in zip(rows, cum):
            r["_bal"] = float(b)
    return rows, has_balance


def compute(transactions: list[dict]) -> dict:
    """Features + the aggregates the report needs. `transactions` must carry `category`."""
    if not transactions:
        raise ValueError("No transactions to analyse")
    rows, has_balance = _prepare(transactions)
    start, end = rows[0]["_d"], rows[-1]["_d"]
    months = months_between(start, end)
    n_m = len(months)
    span_days = (end - start).days + 1
    eff_months = max(1.0, span_days / 30.4)

    inc_m = dict.fromkeys(months, 0.0)
    exp_m = dict.fromkeys(months, 0.0)
    close_m: dict[str, float] = {}
    cat_debit: dict[str, float] = defaultdict(float)
    cat_count: dict[str, int] = defaultdict(int)
    bill_days: dict[str, dict[str, int]] = defaultdict(dict)
    for r in rows:
        m, c = _month(r["_d"]), r["category"]
        cat_count[c] += 1
        if r["credit"] > 0 and c in INCOME_CATEGORIES:
            inc_m[m] += r["credit"]
        if r["debit"] > 0:
            exp_m[m] += r["debit"]
            cat_debit[c] += r["debit"]
            if c in RECURRING_BILLS and m not in bill_days[c]:
                bill_days[c][m] = r["_d"].day
        close_m[m] = r["_bal"]

    inc = np.array([inc_m[m] for m in months])
    # first/last month may be partial: use full months for central tendency when available
    full = inc[1:-1] if n_m >= 4 else inc
    total_income = float(inc.sum())
    income_avg = total_income / eff_months
    income_med = float(np.median(full))
    income_mean_full = float(full.mean())
    income_cv = float(full.std() / income_mean_full) if income_mean_full > 0 else 3.0
    income_months_ratio = float((full > 0.1 * max(income_med, 1.0)).mean()) if income_med > 0 else float((full > 0).mean())

    total_debit = sum(r["debit"] for r in rows) or 1.0
    total_credit = sum(r["credit"] for r in rows)
    bal = _daily_balances(rows, start, end)
    # same denominator as income_monthly_avg, so the sources' monthly averages add up to it
    sources = income_sources(rows, eff_months)
    by_type: dict[str, float] = defaultdict(float)
    for s in sources:
        by_type[s["type"]] += s["monthly_avg"]
    tot_t = sum(by_type.values())
    primary_type = "mixed"
    if tot_t > 0:
        t, v = max(by_type.items(), key=lambda kv: kv[1])
        primary_type = t if v >= 0.6 * tot_t else "mixed"
    # income that can service debt: shop receipts net of stock purchases; seasonal farm income
    # on the average month; everyone else on a typical (median) month
    business_costs = cat_debit.get("other", 0.0) / eff_months
    if primary_type == "business":
        # shop takings also arrive as cash deposits / small transfers, stock purchases leave as "other"
        receipts = sum(r["credit"] for r in rows if r["category"] in INCOME_CATEGORIES | {"transfer_in_other"}) / eff_months
        net_income = max(0.0, min(income_med, receipts - business_costs))
    elif primary_type == "agri":
        net_income = income_avg
    else:
        net_income = income_med
    base_income = max(net_income, MIN_INCOME) if primary_type == "business" else max(income_med, income_avg, MIN_INCOME)
    # below ₹1,000 a month there is no income to measure balances or savings against: ratios that
    # divide by income would otherwise reward an all-debit statement (balance / ₹1,000 floor = years)
    has_income = max(income_med, income_avg) >= MIN_INCOME

    emi_monthly = cat_debit.get("emi_loan", 0.0) / eff_months
    lenders = sorted({counterparty(r["narration"], lender=True) for r in rows if r["category"] == "emi_loan" and r["debit"] > 0})

    regs = []
    for c, by_m in bill_days.items():
        if len(by_m) < 2:
            continue
        ms = sorted(by_m)
        span = len(months_between(ms[0] + "-01", ms[-1] + "-01"))
        coverage = len(ms) / span
        days = np.array([by_m[m] for m in ms], dtype=float)
        consistency = 1.0 - min(1.0, float(days.std()) / 8.0)
        regs.append(coverage * (0.4 + 0.6 * consistency))
    bill_regularity = float(np.mean(regs)) if regs else 0.5

    big = [r for r in rows if r["credit"] > 0 and r["category"] in INCOME_CATEGORIES and r["credit"] >= 0.25 * base_income]
    if not big:
        big = [r for r in rows if r["credit"] > 0 and r["category"] in INCOME_CATEGORIES]
    pre_income = float(np.mean([r["_bal"] - r["credit"] for r in big])) / base_income if big and has_income else 0.0
    if total_credit > 0:
        net_cashflow = max(-1.0, (total_credit - total_debit) / total_credit)
    else:
        net_cashflow = -1.0 if sum(r["debit"] for r in rows) > 0 else 0.0

    bounces = cat_count.get("bounce_charge", 0)
    loan_app_txns = cat_count.get("loan_app", 0)
    values = {
        "income_monthly_avg": income_avg,
        "income_monthly_median": income_med,
        "income_net_monthly": net_income,
        "income_cv": min(income_cv, 3.0),
        "income_months_ratio": income_months_ratio,
        "income_sources": float(sum(1 for s in sources if s["monthly_avg"] >= 0.1 * max(tot_t, 1.0))),
        "avg_balance": float(bal.mean()),
        "min_balance": float(bal.min()),
        "low_balance_days": float((bal < LOW_BALANCE).mean()),
        "buffer_months": min(float(bal.mean()) / base_income, MAX_BUFFER_MONTHS) if has_income else 0.0,
        "net_cashflow_ratio": net_cashflow,
        "essentials_share": sum(cat_debit.get(c, 0.0) for c in ESSENTIALS) / total_debit,
        "discretionary_share": sum(cat_debit.get(c, 0.0) for c in DISCRETIONARY) / total_debit,
        "emi_monthly": emi_monthly,
        "foir": emi_monthly / base_income,
        "bounces": float(bounces),
        "bounce_rate": bounces / eff_months,
        "loan_app_txns": float(loan_app_txns),
        "loan_app_rate": loan_app_txns / eff_months,
        "betting_share": cat_debit.get("betting_gaming", 0.0) / total_debit,
        "cash_share": cat_debit.get("cash_withdrawal", 0.0) / total_debit,
        "bill_regularity": bill_regularity,
        "savings_rate": cat_debit.get("investment_savings", 0.0) / total_income if has_income else 0.0,
        "pre_income_buffer": pre_income,
        "bank_charge_rate": cat_count.get("bank_charges", 0) / eff_months,
        "months_covered": float(n_m),
    }
    monthly = [{"month": m, "income": round(inc_m[m], 2), "expense": round(exp_m[m], 2),
                "closing_balance": round(close_m.get(m, float("nan")), 2) if m in close_m else None} for m in months]
    spend = [{"category": c, "monthly_avg": round(v / eff_months, 2), "share": round(v / total_debit, 4)}
             for c, v in sorted(cat_debit.items(), key=lambda kv: -kv[1])]
    return {
        "values": {k: (0.0 if (isinstance(v, float) and math.isnan(v)) else float(v)) for k, v in values.items()},
        "monthly": monthly, "sources": sources, "primary_type": primary_type, "spending": spend,
        "lenders": lenders, "start": start.isoformat(), "end": end.isoformat(), "has_balance": has_balance,
        "base_income": base_income, "has_income": has_income, "total_credit": total_credit,
        "span_days": span_days,
        "months": n_m,
    }


def display(key: str, value: float) -> str:
    fmt = FEATURES[key][1]
    if fmt == "inr":
        return inr(value)
    if fmt == "pct":
        return f"{value * 100:.0f}%"
    if fmt == "count":
        return f"{value:.0f}"
    return f"{value:.2f}"


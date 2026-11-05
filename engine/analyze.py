"""End-to-end applicant analysis: categorize → features → score → affordability
→ counterfactual improvements → multilingual summary.

`analyze()` returns the contract Report minus `integrity` (added by the API).
Runtime imports: numpy + stdlib only.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from . import score as SC
from .categorize import LABELS, categorize
from .features import FEATURES, MAX_BUFFER_MONTHS, compute, display
from .text import inr

MODELS = Path(__file__).resolve().parent / "models"
MAX_TRANSACTIONS = 500  # rows returned in report.transactions (latest); applicant.transaction_count is the full count
# minimum history: shorter statements are never auto-approved and the loan amount is capped
MIN_HISTORY_DAYS = 90
MIN_TRANSACTIONS = 30
THIN_MAX_AMOUNT = 25_000
# no verifiable income (< ₹1,000/month) is outside the training population (simulated incomes start
# at ₹4,000): the model PD is not extrapolated, the case is scored at this policy PD and declined
NO_INCOME_PD = 0.5
FOIR_CAP = {"A": 0.50, "B": 0.50, "C": 0.45, "D": 0.40, "E": 0.35}
PERSONA_FROM_TYPE = {"salary": "salaried", "gig": "gig_worker", "business": "shopkeeper", "agri": "farmer"}
PERSONAS = {"salaried", "gig_worker", "shopkeeper", "farmer", "student", "homemaker"}


# ----------------------------------------------------------------------------- reason details

def _detail(key: str, v: dict, f: dict) -> str:
    n = f["months"]
    x = v[key]
    if key == "income_net_monthly":
        return (f"A typical month leaves about {inr(x)} that can go towards repayments" if f["has_income"]
                else "No regular income was found in this statement")
    if key == "income_cv":
        return f"Monthly income changes by about {x * 100:.0f}% from month to month"
    if key == "income_months_ratio":
        got = round(x * max(n - 2, 1)) if n >= 4 else round(x * n)
        return f"Income arrived in {got} of {max(n - 2, 1) if n >= 4 else n} full months"
    if key == "income_sources":
        return f"{x:.0f} regular source{'s' if x != 1 else ''} of income"
    if key == "buffer_months":
        if not f["has_income"]:
            return f"Average balance of {inr(v['avg_balance'])}, but no regular income to measure it against"
        if x >= MAX_BUFFER_MONTHS:
            return f"Average balance of {inr(v['avg_balance'])} covers {MAX_BUFFER_MONTHS:.0f} or more months of income"
        return f"Average balance of {inr(v['avg_balance'])} covers about {x:.1f} months of income"
    if key == "low_balance_days":
        return f"Balance was below ₹1,000 on {x * 100:.0f}% of days"
    if key == "net_cashflow_ratio":
        if f["total_credit"] <= 0:
            return "No money came into the account; all spending came out of the existing balance"
        if x <= -1.0:
            return "Spends at least twice the money received"
        return (f"Keeps about {x * 100:.0f}% of the money received" if x >= 0
                else f"Spends about {-x * 100:.0f}% more than the money received")
    if key == "discretionary_share":
        return f"{x * 100:.0f}% of spending goes to food delivery, shopping and gaming"
    if key == "foir":
        if not f["has_income"]:
            return f"Existing EMIs of {inr(v['emi_monthly'])} a month with no regular income to pay them from"
        return f"Existing EMIs of {inr(v['emi_monthly'])} a month take {x * 100:.0f}% of income"
    if key == "bounce_rate":
        return f"{v['bounces']:.0f} auto-debit payment{'s' if v['bounces'] != 1 else ''} bounced in {n} months"
    if key == "loan_app_rate":
        return f"{v['loan_app_txns']:.0f} instant loan app transaction{'s' if v['loan_app_txns'] != 1 else ''} in {n} months"
    if key == "betting_share":
        return f"{x * 100:.1f}% of spending goes to betting or real-money games"
    if key == "cash_share":
        return f"{x * 100:.0f}% of spending is withdrawn as cash"
    if key == "bill_regularity":
        return f"Regular bills (rent, power, phone, EMIs) are paid on a steady schedule {x * 100:.0f}% of the time"
    if key == "savings_rate":
        return f"Saves or invests {x * 100:.1f}% of income (SIP, RD, insurance)"
    if key == "pre_income_buffer":
        return f"Just before income arrives, the balance is typically {inr(x * f['base_income'])}"
    if key == "bank_charge_rate":
        return f"About {x:.1f} penalty charges a month (minimum balance, card fees)"
    return display(key, x)


# ----------------------------------------------------------------------------- improvements

def _improvement_targets(v: dict, inc: float) -> dict[str, tuple[float, str, str, str]]:
    """key → (target raw value, label, current display, target display) for actionable levers.
    `inc` is the income base the ratio features were computed against."""
    t = {}
    tgt_bal = max(5000.0, round(0.5 * inc, -3))
    t["buffer_months"] = (tgt_bal / inc, f"Keep an average balance above {inr(tgt_bal)}", inr(v["avg_balance"]), inr(tgt_bal))
    t["low_balance_days"] = (0.05, "Keep at least ₹1,000 in the account on most days",
                             f"{v['low_balance_days'] * 100:.0f}% of days below ₹1,000", "under 5% of days")
    t["discretionary_share"] = (0.10, "Cut food delivery, shopping and gaming to a tenth of spending",
                                f"{v['discretionary_share'] * 100:.0f}% of spending", "10% of spending")
    t["foir"] = (0.30, "Pay down existing loans so EMIs stay under 30% of income",
                 f"{v['foir'] * 100:.0f}% of income", "30% of income")
    t["bounce_rate"] = (0.0, "Keep enough balance on EMI dates so no auto-debit bounces",
                        f"{v['bounces']:.0f} bounced", "0 bounced")
    t["loan_app_rate"] = (0.0, "Stop borrowing from instant loan apps",
                          f"{v['loan_app_txns']:.0f} transaction{'s' if v['loan_app_txns'] != 1 else ''}", "none")
    t["betting_share"] = (0.0, "Stop betting and real-money gaming",
                          f"{v['betting_share'] * 100:.1f}% of spending", "0%")
    t["cash_share"] = (0.10, "Pay digitally (UPI) instead of withdrawing cash",
                       f"{v['cash_share'] * 100:.0f}% as cash", "10% as cash")
    t["bill_regularity"] = (0.95, "Pay rent, power and phone bills on the same date every month",
                            f"{v['bill_regularity'] * 100:.0f}% regular", "95% regular")
    t["savings_rate"] = (0.05, "Save at least 5% of income every month with an RD or SIP",
                         f"{v['savings_rate'] * 100:.1f}% saved", "5% saved")
    tgt_pre = max(2000.0, round(0.2 * inc, -3))
    t["pre_income_buffer"] = (tgt_pre / inc, f"Keep at least {inr(tgt_pre)} left when your next income arrives",
                              inr(v["pre_income_buffer"] * inc), inr(tgt_pre))
    t["bank_charge_rate"] = (0.0, "Avoid minimum-balance and other penalty charges",
                             f"{v['bank_charge_rate']:.1f} a month", "none")
    return t


def improvements(values: dict, base_income: float, limit: int = 4) -> list[dict]:
    """Greedy counterfactual: repeatedly apply the single actionable change that
    lowers PD the most; `score_after` is the re-scored result after this and all
    earlier steps."""
    m = SC.model()
    specs = {f["key"]: f for f in m["features"] if f.get("actionable")}
    targets = _improvement_targets(values, base_income)
    cur = dict(values)
    base_pd = SC.score(cur)["pd"]
    out = []
    remaining = {k for k in specs if k in targets}
    while remaining and len(out) < limit:
        best = None
        for k in remaining:
            tgt = targets[k][0]
            trial = dict(cur, **{k: tgt})
            pd = SC.score(trial)["pd"]
            if pd < base_pd - 1e-4 and (best is None or pd < best[1]):
                best = (k, pd)
        if best is None:
            break
        k, pd = best
        cur[k] = targets[k][0]
        remaining.discard(k)
        s_after = SC.pd_to_score(pd)
        if out and s_after <= out[-1]["score_after"]:
            break
        _, label, cur_disp, tgt_disp = targets[k]
        out.append({"key": k, "label": label, "current": cur_disp, "target": tgt_disp, "score_after": s_after})
        base_pd = pd
    return out


# ----------------------------------------------------------------------------- affordability

def _emi(principal: float, annual_rate_pct: float, months: int) -> float:
    r = annual_rate_pct / 1200.0
    if months <= 0:
        return 0.0
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1) if r > 0 else principal / months


def _principal(emi: float, annual_rate_pct: float, months: int) -> float:
    r = annual_rate_pct / 1200.0
    return emi * ((1 + r) ** months - 1) / (r * (1 + r) ** months) if r > 0 else emi * months


def affordability(values: dict, band: str, decision: str, loan: dict | None, max_amount: float | None = None) -> dict:
    """FOIR-based repayment capacity. `max_amount` caps the recommended principal (thin history)."""
    # repayment capacity: shop receipts net of stock purchases, farm income on the average
    # month, everyone else a typical (median) month — see engine.features
    income = values["income_net_monthly"]
    cap = FOIR_CAP[band]
    max_emi = max(0.0, cap * income - values["emi_monthly"])
    rate = SC.model()["rates"][band]
    tenure = int((loan or {}).get("tenure_months") or 12)
    amount = float((loan or {}).get("amount") or 0.0)
    requested = _emi(amount, rate, tenure) if amount > 0 else 0.0
    affordable = _principal(max_emi, rate, tenure)
    if max_amount is not None:
        affordable = min(affordable, max_amount)
    recommended = 0.0 if decision == "decline" else math.floor(min(affordable, amount if amount > 0 else affordable) / 1000) * 1000
    return {"max_emi": round(max_emi), "requested_emi": round(requested), "recommended_amount": int(recommended),
            "tenure_months": tenure, "rate_pct": rate, "within_limit": bool(requested <= max_emi + 0.5),
            "foir_cap": cap, "income_basis": round(income)}


# ----------------------------------------------------------------------------- summary

_SRC = {
    "en": {"salary": "a salary", "gig": "gig platform payouts", "business": "business sales", "agri": "farming",
           "transfer": "family support", "mixed": "several sources"},
    "hi": {"salary": "वेतन", "gig": "गिग प्लेटफ़ॉर्म भुगतान", "business": "व्यापार की बिक्री", "agri": "खेती",
           "transfer": "परिवार से मिलने वाली राशि", "mixed": "कई स्रोतों"},
    "te": {"salary": "జీతం", "gig": "గిగ్ ప్లాట్‌ఫామ్ చెల్లింపుల", "business": "వ్యాపార అమ్మకాల", "agri": "వ్యవసాయం",
           "transfer": "కుటుంబం పంపే డబ్బు", "mixed": "అనేక మార్గాల"},
}


def summary(name: str | None, income: float, ptype: str, risk: dict, aff: dict, has_loan: bool, top_fix: str | None,
            failed_checks: list[str] | None = None, *, no_income: bool = False, thin: bool = False,
            existing_emi: float = 0.0) -> dict:
    s, b, dec = risk["score"], risk["band"], risk["decision"]
    m, r = inr(aff["max_emi"]), inr(aff["requested_emi"])
    who_en, who_hi, who_te = name or "The applicant", name or "आवेदक", name or "దరఖాస్తుదారు"

    if no_income:
        en = [f"We could not find any regular income in {who_en if name else 'this'}{'’s' if name else ''} statement "
              "(less than ₹1,000 a month), so a safe repayment amount cannot be worked out.",
              f"The CreditBridge score is {s} (band {b}); the loan cannot be approved until a statement from the "
              "account that receives their income is provided."]
    else:
        en = [f"{who_en} earns about {inr(income)} a month, mainly from {_SRC['en'][ptype]}."]
        en.append({
            "approve": f"Their banking history gives a CreditBridge score of {s} (band {b}), so the loan can be approved.",
            "review": f"Their banking history gives a CreditBridge score of {s} (band {b}), so a loan officer should review the application before approving.",
            "decline": f"Their banking history gives a CreditBridge score of {s} (band {b}), which is too low to approve a loan right now"
                       + (f"; the most helpful change would be to {top_fix[0].lower() + top_fix[1:]}." if top_fix else "."),
        }[dec])
    if thin:
        en.append("The statement is short (under 3 months or fewer than 30 transactions), so a loan officer must "
                  "review it and the recommended amount is kept small.")
    if failed_checks is not None:
        what = f": {'; '.join(failed_checks)}" if failed_checks else ""
        en.append(f"However, the statement failed authenticity checks{what}. The original documents must be "
                  "verified before any loan is given.")
    if no_income:
        pass
    elif aff["max_emi"] <= 0:
        en.append("Existing EMIs already use up the safe repayment limit, so there is no room for a new EMI yet."
                  if existing_emi > 0 else "Their income is too low to support a new EMI.")
    elif has_loan:
        en.append(f"They can safely repay up to {m} a month, and the requested EMI of {r} is "
                  + ("within this limit." if aff["within_limit"] else "above this limit."))
    else:
        en.append(f"They can safely repay up to {m} a month.")

    if no_income:
        hi = [f"{who_hi} के स्टेटमेंट में कोई नियमित आय (₹1,000 प्रति माह से अधिक) नहीं मिली, इसलिए सुरक्षित किस्त तय नहीं की जा सकती।",
              f"क्रेडिटब्रिज स्कोर {s} (बैंड {b}) है; आय वाले खाते का स्टेटमेंट मिलने तक ऋण स्वीकृत नहीं किया जा सकता।"]
    else:
        hi = [f"{who_hi} की औसत मासिक आय लगभग {inr(income)} है, जो मुख्य रूप से {_SRC['hi'][ptype]} से आती है।"]
        hi.append({
            "approve": f"बैंक लेन-देन के आधार पर क्रेडिटब्रिज स्कोर {s} (बैंड {b}) है, इसलिए ऋण स्वीकृत किया जा सकता है।",
            "review": f"बैंक लेन-देन के आधार पर क्रेडिटब्रिज स्कोर {s} (बैंड {b}) है, इसलिए स्वीकृति से पहले ऋण अधिकारी को आवेदन की समीक्षा करनी चाहिए।",
            "decline": f"बैंक लेन-देन के आधार पर क्रेडिटब्रिज स्कोर {s} (बैंड {b}) है, जो अभी ऋण स्वीकृति के लिए पर्याप्त नहीं है।",
        }[dec])
    if thin:
        hi.append("स्टेटमेंट छोटा है (3 महीने से कम या 30 से कम लेन-देन), इसलिए ऋण अधिकारी को इसकी समीक्षा करनी चाहिए "
                  "और अनुशंसित राशि कम रखी गई है।")
    if failed_checks is not None:
        n = f" {len(failed_checks)}" if failed_checks else ""
        hi.append(f"लेकिन स्टेटमेंट{n} प्रामाणिकता जाँच{'ों' if len(failed_checks) > 1 else ''} में विफल रहा, "
                  "इसलिए ऋण देने से पहले मूल दस्तावेज़ों की पुष्टि करनी चाहिए।")
    if no_income:
        pass
    elif aff["max_emi"] <= 0:
        hi.append("मौजूदा किस्तों के कारण अभी नई किस्त की गुंजाइश नहीं है।" if existing_emi > 0
                  else "आय कम होने के कारण अभी नई किस्त की गुंजाइश नहीं है।")
    elif has_loan:
        hi.append(f"अधिकतम सुरक्षित मासिक किस्त (EMI) {m} है, और माँगी गई किस्त {r} इस सीमा के "
                  + ("भीतर है।" if aff["within_limit"] else "बाहर है।"))
    else:
        hi.append(f"अधिकतम सुरक्षित मासिक किस्त (EMI) {m} है।")

    if no_income:
        te = [f"{who_te} స్టేట్‌మెంట్‌లో క్రమమైన ఆదాయం (నెలకు ₹1,000 పైగా) కనిపించలేదు, కాబట్టి సురక్షితమైన వాయిదాను నిర్ణయించలేము.",
              f"క్రెడిట్‌బ్రిడ్జ్ స్కోర్ {s} (బ్యాండ్ {b}); ఆదాయం జమ అయ్యే ఖాతా స్టేట్‌మెంట్ ఇచ్చే వరకు రుణాన్ని ఆమోదించలేము."]
    else:
        te = [f"{who_te} సగటు నెలవారీ ఆదాయం సుమారు {inr(income)}; ఇది ప్రధానంగా {_SRC['te'][ptype]} ద్వారా వస్తుంది."]
        te.append({
            "approve": f"బ్యాంకు లావాదేవీల ఆధారంగా క్రెడిట్‌బ్రిడ్జ్ స్కోర్ {s} (బ్యాండ్ {b}), కాబట్టి రుణాన్ని ఆమోదించవచ్చు.",
            "review": f"బ్యాంకు లావాదేవీల ఆధారంగా క్రెడిట్‌బ్రిడ్జ్ స్కోర్ {s} (బ్యాండ్ {b}), కాబట్టి ఆమోదించే ముందు రుణ అధికారి దరఖాస్తును పరిశీలించాలి.",
            "decline": f"బ్యాంకు లావాదేవీల ఆధారంగా క్రెడిట్‌బ్రిడ్జ్ స్కోర్ {s} (బ్యాండ్ {b}), ఇది ప్రస్తుతం రుణ ఆమోదానికి సరిపోదు.",
        }[dec])
    if thin:
        te.append("స్టేట్‌మెంట్ చిన్నది (3 నెలల కంటే తక్కువ లేదా 30 కంటే తక్కువ లావాదేవీలు), కాబట్టి రుణ అధికారి "
                  "పరిశీలించాలి మరియు సిఫార్సు చేసిన మొత్తాన్ని తక్కువగా ఉంచాం.")
    if failed_checks is not None:
        n = f" {len(failed_checks)}" if failed_checks else ""
        te.append(f"అయితే స్టేట్‌మెంట్{n} ప్రామాణికత తనిఖీ{'ల' if len(failed_checks) != 1 else ''}లో విఫలమైంది, "
                  "కాబట్టి రుణం ఇచ్చే ముందు అసలు పత్రాలను ధృవీకరించాలి.")
    if no_income:
        pass
    elif aff["max_emi"] <= 0:
        te.append("ప్రస్తుత వాయిదాల వల్ల కొత్త వాయిదాకు ఇప్పుడు అవకాశం లేదు." if existing_emi > 0
                  else "ఆదాయం తక్కువగా ఉండటం వల్ల కొత్త వాయిదాకు ఇప్పుడు అవకాశం లేదు.")
    elif has_loan:
        te.append(f"సురక్షితంగా చెల్లించగల గరిష్ఠ నెలవారీ వాయిదా (EMI) {m}; కోరిన వాయిదా {r} ఈ పరిమితి"
                  + ("లోనే ఉంది." if aff["within_limit"] else "ని మించింది."))
    else:
        te.append(f"సురక్షితంగా చెల్లించగల గరిష్ఠ నెలవారీ వాయిదా (EMI) {m}.")
    return {"en": " ".join(en), "hi": " ".join(hi), "te": " ".join(te)}


# ----------------------------------------------------------------------------- main entry

def _reason(key: str, impact: float, v: dict, f: dict) -> dict:
    return {"key": key, "label": FEATURES[key][0], "value_display": display(key, v[key]), "impact": round(impact, 4),
            "direction": "hurts" if impact > 0 else "helps", "detail": _detail(key, v, f)}


def analyze(transactions: list[dict], loan: dict | None, meta: dict) -> dict:
    """Report (contract) minus `integrity`."""
    if not transactions:
        raise ValueError("The statement has no transactions to analyse")
    meta = meta or {}
    cat = categorize(transactions)
    f = compute(cat)
    v = f["values"]
    r = SC.score(v)
    contrib = r["contributions"]
    reasons = [_reason(k, c, v, f) for k, c in sorted(contrib.items(), key=lambda kv: -abs(kv[1]))[:6] if abs(c) >= 0.01]
    feats = [{"key": k, "label": lab, "value": round(v[k], 4), "value_display": display(k, v[k]),
              "impact": round(contrib.get(k, 0.0), 4)} for k, (lab, _) in FEATURES.items()]

    notes = []
    no_income = not f["has_income"]
    if no_income and r["pd"] < NO_INCOME_PD:
        # outside the model's training support: score at the policy PD; the gap is the reason code
        gap = math.log(NO_INCOME_PD / (1 - NO_INCOME_PD)) - r["logit"]
        r = {**r, "pd": NO_INCOME_PD, "score": SC.pd_to_score(NO_INCOME_PD), "band": SC.band_for(NO_INCOME_PD)}
        reasons = [_reason("income_net_monthly", gap + contrib.get("income_net_monthly", 0.0), v, f)] + \
                  [x for x in reasons if x["key"] != "income_net_monthly"][:5]
    decision = r["decision"]
    if no_income:
        decision = "decline"
        notes.append("No regular income (₹1,000 a month or more) was found, so repayment capacity cannot be assessed.")
    thin = f["span_days"] < MIN_HISTORY_DAYS or len(transactions) < MIN_TRANSACTIONS
    if thin:
        if decision == "approve":
            decision = "review"
        notes.append(f"Only {f['span_days']} days and {len(transactions)} transactions of history (minimum "
                     f"{MIN_HISTORY_DAYS} days and {MIN_TRANSACTIONS} transactions for an automatic decision); "
                     f"verify more history before lending. The recommended amount is capped at {inr(THIN_MAX_AMOUNT)}.")
    # a statement that fails authenticity checks is never auto-approved
    integ = meta.get("integrity") or {}
    failed = integ.get("status") == "fail"
    if failed:
        if decision == "approve":
            decision = "review"
        notes.append("The statement failed authenticity checks; verify the original documents before lending.")
    risk = {"pd": round(r["pd"], 4), "score": r["score"], "band": r["band"], "decision": decision, "reasons": reasons}
    if notes:
        risk["decision_note"] = " ".join(notes)

    ptype = f["primary_type"]
    aff = affordability(v, r["band"], decision, loan, THIN_MAX_AMOUNT if thin else None)
    # counterfactuals re-score the model; without income the policy PD above applies regardless
    imps = [] if no_income else improvements(v, f["base_income"])
    persona = meta.get("persona") if meta.get("persona") in PERSONAS else PERSONA_FROM_TYPE.get(ptype)
    name = meta.get("name") or meta.get("account_holder")

    stability = max(0.0, min(1.0, v["income_months_ratio"] * (1.0 - min(v["income_cv"], 1.0))))
    rows = sorted(enumerate(cat), key=lambda it: (str(it[1]["date"])[:10], it[0]))
    txns = [{"date": str(t["date"])[:10], "narration": t.get("narration") or "",
             "debit": float(t.get("debit") or 0.0), "credit": float(t.get("credit") or 0.0),
             "balance": None if t.get("balance") is None else float(t["balance"]),
             "category": t["category"], "category_label": LABELS[t["category"]],
             "confidence": t["confidence"], "flags": list(t.get("flags") or [])}
            for _, t in rows[-MAX_TRANSACTIONS:]]

    return {
        "applicant": {"name": name, "persona": persona, "bank": meta.get("bank"), "months_covered": f["months"],
                      "start_date": f["start"], "end_date": f["end"], "transaction_count": len(transactions)},
        "income": {"monthly_avg": round(v["income_monthly_avg"]), "monthly_median": round(v["income_monthly_median"]),
                   "stability": round(stability, 3), "primary_type": ptype,
                   "sources": [{**s, "monthly_avg": round(s["monthly_avg"])} for s in f["sources"]],
                   "monthly": f["monthly"]},
        "spending": {"categories": [{"category": s["category"], "label": LABELS[s["category"]],
                                     "monthly_avg": round(s["monthly_avg"]), "share": s["share"]} for s in f["spending"]],
                     "essentials_share": round(v["essentials_share"], 4), "discretionary_share": round(v["discretionary_share"], 4)},
        "obligations": {"existing_emi_monthly": round(v["emi_monthly"]), "lenders": f["lenders"],
                        "bounces": int(v["bounces"]), "foir": round(v["foir"], 4)},
        "risk": risk,
        "features": feats,
        "affordability": aff,
        "improvements": imps,
        "transactions": txns,
        "summary": summary(name, v["income_net_monthly"], ptype, {**r, "decision": decision}, aff,
                           bool(loan and loan.get("amount")), imps[0]["label"] if imps else None,
                           list(integ.get("failed") or []) if failed else None,
                           no_income=no_income, thin=thin, existing_emi=v["emi_monthly"]),
    }


def model_card() -> dict:
    return json.loads((MODELS / "model_card.json").read_text())

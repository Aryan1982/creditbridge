"""Generate curated demo applicants into data/samples/.

Each sample is a simulator applicant with chosen persona/traits. The seed is
searched deterministically (first seed in the sample's range whose runtime
decision matches the intended outcome), so reruns reproduce the same files.
Writes `<id>.csv` (txn_id,date,narration,debit,credit,balance) + `index.json`.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ml"))

import simulator as S  # noqa: E402
from engine import score as SC  # noqa: E402
from engine.analyze import analyze  # noqa: E402

OUT = ROOT / "data" / "samples"

# id, name, persona, gender, (city, state), intended decision, trait overrides
SPECS = [
    ("ravi_gig", "Ravi Kumar", "gig_worker", "M", ("HYDERABAD", "TS"), "approve",
     dict(discipline=0.85, stress=0.15, bettor=0.0, loanapp=0.02, emi_ratio=0.12, wtp=0.95, shock_p=0.03, income=26000, months=9)),
    ("priya_salaried", "Priya Sharma", "salaried", "F", ("PUNE", "MH"), "approve",
     dict(discipline=0.85, stress=0.12, bettor=0.0, loanapp=0.02, emi_ratio=0.15, wtp=0.95, shock_p=0.01, income=42000, months=12)),
    ("mohammed_shop", "Mohammed Irfan", "shopkeeper", "M", ("WARANGAL", "TS"), "approve",
     dict(discipline=0.8, stress=0.2, bettor=0.0, loanapp=0.03, emi_ratio=0.1, wtp=0.92, shock_p=0.03, income=30000, months=12)),
    ("lakshmi_homemaker", "Lakshmi Devi", "homemaker", "F", ("KARIMNAGAR", "TS"), "approve",
     dict(discipline=0.82, stress=0.18, bettor=0.0, loanapp=0.02, emi_ratio=0.0, wtp=0.95, shock_p=0.02, income=15000, months=9)),
    ("suresh_farmer", "Suresh Patil", "farmer", "M", ("AHMEDNAGAR", "MH"), "review",
     dict(discipline=0.6, stress=0.35, bettor=0.0, loanapp=0.1, emi_ratio=0.15, wtp=0.8, shock_p=0.08, income=19000, months=12)),
    ("ananya_student", "Ananya Reddy", "student", "F", ("HYDERABAD", "TS"), "review",
     dict(discipline=0.55, stress=0.35, bettor=0.0, loanapp=0.25, emi_ratio=0.0, wtp=0.8, shock_p=0.04, income=11000, months=8)),
    ("kavya_salaried", "Kavya Nair", "salaried", "F", ("KOCHI", "KL"), "review",
     dict(discipline=0.5, stress=0.45, bettor=0.0, loanapp=0.3, emi_ratio=0.35, wtp=0.6, shock_p=0.03, income=36000, months=10)),
    ("fatima_shop", "Fatima Shaikh", "shopkeeper", "F", ("NASHIK", "MH"), "review",
     dict(discipline=0.55, stress=0.4, bettor=0.0, loanapp=0.2, emi_ratio=0.25, wtp=0.75, shock_p=0.06, income=24000, months=9)),
    ("arjun_gig", "Arjun Singh", "gig_worker", "M", ("BENGALURU", "KA"), "decline",
     dict(discipline=0.3, stress=0.6, bettor=0.08, loanapp=0.7, emi_ratio=0.2, wtp=0.5, shock_p=0.1, income=21000, months=8)),
    ("ramesh_farmer", "Ramesh Yadav", "farmer", "M", ("SITAPUR", "UP"), "decline",
     dict(discipline=0.35, stress=0.65, bettor=0.0, loanapp=0.5, emi_ratio=0.45, wtp=0.45, shock_p=0.12, income=15000, months=12)),
]
PERSONA_WORD = {"salaried": "Salaried employee", "gig_worker": "Gig worker", "shopkeeper": "Shop owner",
                "farmer": "Farmer", "student": "Student", "homemaker": "Homemaker"}
LOAN = {"amount": 50000, "tenure_months": 12, "purpose": "working capital"}


def describe(persona: str, city: str, report: dict) -> str:
    generic = {"Customer UPI payments", "Family & friends", "Other gig payouts", "Other farm income", "Other employer pay"}
    srcs = list(dict.fromkeys(s["name"] for s in report["income"]["sources"] if s["name"] not in generic))[:2]
    extra = ""
    if persona == "shopkeeper":
        extra = "daily UPI/QR shop sales"
    elif persona == "homemaker":
        extra = "household money from family plus tailoring income"
    elif persona == "student":
        extra = "family support" + (" and a scholarship" if any(s["name"] == "Scholarship" for s in report["income"]["sources"]) else "")
    elif persona == "farmer":
        extra = "seasonal crop sales" + (" and PM-KISAN" if any(s["name"] == "PM-KISAN" for s in report["income"]["sources"]) else "")
    elif srcs:
        extra = ("payouts from " if persona == "gig_worker" else "salary from ") + " and ".join(srcs)
    months = report["applicant"]["months_covered"]
    return f"{PERSONA_WORD[persona]} in {city.title()} — {extra}; {months} months of statements."


def write_csv(path: Path, txns: list[dict]) -> None:
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["txn_id", "date", "narration", "debit", "credit", "balance"])
        for t in txns:
            w.writerow([t["txn_id"], t["date"], t["narration"], f"{t['debit']:.2f}" if t["debit"] else "",
                        f"{t['credit']:.2f}" if t["credit"] else "", f"{t['balance']:.2f}"])


def main() -> list[dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    SC.model.cache_clear()
    index = []
    for i, (sid, name, persona, gender, (city, state), want, ov) in enumerate(SPECS):
        found = None
        for seed in range(900_000 + i * 1000, 900_000 + i * 1000 + 400):
            p = S.draw_profile(seed, persona, gender=gender, name=name, city=city, state=state, **ov)
            txns = S.simulate(p)
            raw = [{k: t[k] for k in ("txn_id", "date", "narration", "debit", "credit", "balance")} for t in txns]
            rep = analyze(raw, LOAN, {"name": name, "persona": persona})
            ok = rep["risk"]["decision"] == want
            if want == "decline":
                ok = ok and len(rep["improvements"]) >= 2
            if ok:
                found = (seed, p, txns, rep)
                break
        if not found:
            raise RuntimeError(f"no seed produced decision={want} for {sid}")
        seed, p, txns, rep = found
        write_csv(OUT / f"{sid}.csv", txns)
        index.append({"id": sid, "name": name, "persona": persona, "description": describe(persona, city, rep),
                      "format": "csv", "tampered": False, "file": f"{sid}.csv"})
        r = rep["risk"]
        print(f"{sid:18s} seed {seed} {persona:10s} txns {len(txns):4d} score {r['score']} band {r['band']} "
              f"{r['decision']:8s} pd {r['pd']:.3f} max_emi {rep['affordability']['max_emi']}")
    (OUT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
    print(f"wrote {len(index)} samples to {OUT}")
    return index


if __name__ == "__main__":
    main()

"""Assemble engine/models/model_card.json from the training result files."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "ml" / "results"
OUT = ROOT / "engine" / "models" / "model_card.json"


def build() -> dict:
    cat = json.loads((RES / "categorizer.json").read_text())
    risk = json.loads((RES / "risk.json").read_text())
    gc = json.loads((RES / "german_credit.json").read_text())["metrics"]
    d = risk["data"]
    card = {
        "version": "2.0",
        "data": {
            "description": ("Synthetic Indian bank/UPI statements from a persona-based simulator (salaried, gig workers, "
                            "shopkeepers, farmers, students, homemakers) with bank-specific narration formats "
                            "(SBI, HDFC, ICICI, Axis, Kotak, Canara, Bank of Baroda, PNB), truncation and typos."),
            "n_applicants": d["n_applicants"], "n_transactions": d["n_transactions"], "synthetic": True,
            "default_rate": d["default_rate"], "default_rate_by_persona": d["default_rate_by_persona"],
            "history_months": "6–12 per applicant",
            "simulator_notes": [
                "Hidden traits (money discipline, repayment priority, income-shock risk, liquidity stress, betting and "
                "loan-app propensity) drive what appears in the statement: bill timing, NACH/ECS bounces with return "
                "charges, minimum-balance penalties, instant-loan-app borrowing, betting, savings and balances.",
                "Default is simulated over a separate future 12-month window from the hidden traits plus fresh income "
                "shocks and individual noise, so it is not a deterministic function of statement features.",
                "Default rates are calibrated per persona (≈14–26%); gender is simulated only for the fairness audit.",
                "Categorizer corpus and risk population use disjoint simulator seeds.",
            ],
        },
        "categorizer": {
            "model": cat["model"], "accuracy": cat["accuracy"], "macro_f1": cat["macro_f1"], "eval": cat["eval"],
            "n_train": cat["n_train"], "n_test": cat["n_test"], "n_features": cat["n_features"],
            "in_population_agreement": d["categorizer_agreement_in_population"],
            "per_class": cat["per_class"], "runtime_parity_max_abs_diff": cat["parity_max_abs_diff"],
        },
        "risk": {
            "model": risk["model"], "cv": "5-fold stratified, out-of-fold predictions",
            "benchmark": risk["benchmark"], "auc": risk["auc"], "ks": risk["ks"], "gini": risk["gini"], "brier": risk["brier"],
            "calibration": risk["calibration"],
            "by_persona": [{"persona": r["persona"], "auc": r["auc"], "n": r["n"], "approval_rate": r["approval_rate"],
                            "default_rate": r["default_rate"]} for r in risk["by_persona"]],
            "ablations": risk["ablations"], "feature_importance": risk["feature_importance"],
            "bands": risk["bands"], "policy": risk["policy"],
            "score_scale": "300–900; 650 at 4:1 good:bad odds, 50 points to double the odds",
            "features_dropped_for_sign_consistency": risk["dropped_features"],
            "runtime_parity_max_abs_diff": risk["parity_max_abs_diff"],
        },
        "fairness": {"by_gender": risk["by_gender"], "by_persona": risk["by_persona"], "notes": risk["fairness_notes"]},
        "external_validation": {
            "dataset": "Statlog German Credit (OpenML credit-g, 1,000 real applicants)",
            "alt_only_auc": gc["models"]["logreg_alternative_only"]["roc_auc"],
            "bureau_only_auc": gc["models"]["logreg_bureau_only"]["roc_auc"],
            "combined_auc": gc["models"]["logreg_combined"]["roc_auc"],
            "gbm_combined_auc": gc["models"]["gbm_combined"]["roc_auc"],
            "thin_file": {"n": gc["thin_file_auc"]["n"], "bad_rate": gc["thin_file_auc"]["bad_rate"],
                          "alt_only_auc": gc["thin_file_auc"]["logreg_alternative_only"],
                          "bureau_only_auc": gc["thin_file_auc"]["logreg_bureau_only"]},
            "note": "Real-data check that non-bureau signals rank risk where bureau history is thin; 5-fold CV.",
        },
        "limitations": [
            "The risk model is trained on simulated statements; it must be re-fitted and validated on real repayment outcomes before lending decisions.",
            "Narration formats vary by bank and change over time; unseen merchants are categorised less accurately (see per-class F1).",
            "Cash deposits and transfers from individuals cannot be verified as income and are counted conservatively.",
            "Six months of history may miss seasonal income (harvests); farm income is judged on the average month.",
            "Fairness was audited on simulated gender and persona labels only; a real deployment needs audits on real outcomes.",
            "Scores describe repayment risk from cash flow only; identity/KYC and fraud checks happen separately.",
        ],
    }
    OUT.write_text(json.dumps(card, indent=1, ensure_ascii=False))
    print(f"wrote {OUT}")
    return card


if __name__ == "__main__":
    build()

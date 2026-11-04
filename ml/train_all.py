"""Run the full offline pipeline end-to-end.

    .venv/bin/python ml/train_all.py

1. External validation on Statlog German Credit → ml/results/german_credit.json
2. Narration categorizer (unseen-merchant eval, numpy parity) → engine/models/categorizer.json
3. Cash-flow risk scorecard (CV benchmark, ablations, fairness, parity) → engine/models/risk.json
4. Model card → engine/models/model_card.json
5. Curated demo applicants → data/samples/*.csv + index.json
"""

from __future__ import annotations

import time

import make_samples
import model_card
import train_categorizer
import train_risk
import validate_german_credit


def main() -> None:
    t0 = time.time()
    for name, step in [("german credit validation", validate_german_credit.main),
                       ("categorizer", train_categorizer.main),
                       ("risk model", train_risk.main),
                       ("model card", model_card.build),
                       ("samples", make_samples.main)]:
        print(f"\n=== {name} ===")
        step()
    print(f"\nall done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()

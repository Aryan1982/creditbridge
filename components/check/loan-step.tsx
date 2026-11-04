"use client";

import { useId } from "react";
import { emi, inr, titleCase } from "@/lib/format";
import type { LoanRequest } from "@/lib/types";
import { Button, Segmented } from "@/components/ui";
import type { Source } from "./connect-step";

const TENURES = [6, 12, 18, 24, 36];
const PURPOSES = [
  { value: "business", label: "Grow my business" },
  { value: "education", label: "Education" },
  { value: "medical", label: "Medical expenses" },
  { value: "home_improvement", label: "Home repair or improvement" },
  { value: "vehicle", label: "Two-wheeler or vehicle" },
  { value: "agriculture", label: "Farming inputs" },
  { value: "personal", label: "Personal or family needs" },
];
const MIN = 5000;
const MAX = 500000;
const STEP = 5000;
const INDICATIVE_RATE = 18;

function sourceLabel(s: Source) {
  if (s.kind === "upload") return s.file.name;
  if (s.kind === "aa") return `${s.label} · via Account Aggregator`;
  return `${s.label} · sample profile`;
}

export function LoanStep({
  loan,
  onLoan,
  source,
  onBack,
  onContinue,
}: {
  loan: LoanRequest;
  onLoan: (l: LoanRequest) => void;
  source: Source;
  onBack: () => void;
  onContinue: () => void;
}) {
  const amountId = useId();
  const purposeId = useId();
  const monthly = emi(loan.amount, INDICATIVE_RATE, loan.tenure_months);
  const pctFill = ((loan.amount - MIN) / (MAX - MIN)) * 100;
  const purposes = PURPOSES.some((p) => p.value === loan.purpose) ? PURPOSES : [...PURPOSES, { value: loan.purpose, label: titleCase(loan.purpose) }];
  const tenure = String(loan.tenure_months);

  return (
    <section aria-labelledby="loan-title">
      <div className="flex items-center gap-2.5 px-1 text-[13px] text-muted">
        <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-positive" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="truncate">
          Connected · <span className="font-medium text-fg">{sourceLabel(source)}</span>
        </span>
      </div>

      <div className="card mt-4 p-5 sm:p-7">
        <h2 id="loan-title" className="section-title">
          What would you like to borrow?
        </h2>
        <p className="mt-1 text-[13px] text-muted">We’ll check this against what your cash flow can comfortably support.</p>

        <div className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor={amountId} className="text-[13px] font-medium text-muted">
              Loan amount
            </label>
            <output htmlFor={amountId} className="big">
              {inr(loan.amount)}
            </output>
          </div>
          <input
            id={amountId}
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={loan.amount}
            onChange={(e) => onLoan({ ...loan, amount: Number(e.target.value) })}
            aria-valuetext={inr(loan.amount)}
            className="mt-5 h-[5px] w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16),0_0_0_0.5px_rgba(0,0,0,0.04)]"
            style={{ background: `linear-gradient(to right, var(--accent) ${pctFill}%, var(--fill) ${pctFill}%)` }}
          />
          <div className="mt-2.5 flex justify-between text-[12px] text-faint tnum">
            <span>{inr(MIN)}</span>
            <span>{inr(MAX)}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted" id={`${amountId}-tenure`}>
              Repay over
            </p>
            <Segmented
              label="Repayment period in months"
              value={tenure}
              onChange={(v) => onLoan({ ...loan, tenure_months: Number(v) })}
              options={TENURES.map((t) => ({ value: String(t), label: `${t} mo`, ariaLabel: `${t} months` }))}
              className="flex w-full"
              itemClassName="flex-1 px-2!"
            />
          </div>
          <div>
            <label htmlFor={purposeId} className="mb-2 block text-[13px] font-medium text-muted">
              Purpose
            </label>
            <select
              id={purposeId}
              value={loan.purpose}
              onChange={(e) => onLoan({ ...loan, purpose: e.target.value })}
              className="pill-select h-[34px]! w-full max-w-none! rounded-[9px]! bg-fill! shadow-none!"
            >
              {purposes.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="headline mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="k">Estimated EMI</p>
            <p className="range-line">Indicative, at {INDICATIVE_RATE}% a year for {loan.tenure_months} months</p>
          </div>
          <p className="big">
            {inr(monthly)}
            <small>/mo</small>
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onContinue}>
          Check eligibility
        </Button>
      </div>
    </section>
  );
}

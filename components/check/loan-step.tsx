"use client";

import { useId } from "react";
import { emi, inr, titleCase } from "@/lib/format";
import type { LoanRequest } from "@/lib/types";
import { Button } from "@/components/ui";
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

  return (
    <section aria-labelledby="loan-title">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-4 py-2.5 text-[13px] text-zinc-600">
        <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-positive" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="truncate">
          Connected: <span className="font-medium text-ink">{sourceLabel(source)}</span>
        </span>
      </div>

      <h2 id="loan-title" className="mt-8 text-lg font-semibold tracking-[-0.01em]">
        What would you like to borrow?
      </h2>
      <p className="mt-1 text-sm text-zinc-600">We’ll check this against what your cash flow can comfortably support.</p>

      <div className="mt-8 space-y-8">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={amountId} className="text-sm font-medium">
              Loan amount
            </label>
            <output htmlFor={amountId} className="text-2xl font-semibold tracking-[-0.02em] tnum">
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
            className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-line-strong [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.15)] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-line-strong [&::-moz-range-thumb]:bg-white"
            style={{ background: `linear-gradient(to right, var(--color-accent-600) ${pctFill}%, #e4e4e7 ${pctFill}%)` }}
          />
          <div className="mt-2 flex justify-between text-xs text-zinc-500 tnum">
            <span>{inr(MIN)}</span>
            <span>{inr(MAX)}</span>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Repay over</legend>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {TENURES.map((t) => {
              const sel = loan.tenure_months === t;
              return (
                <label
                  key={t}
                  className={`flex cursor-pointer flex-col items-center rounded-md border py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-600 ${
                    sel ? "border-accent-600 bg-accent-50/50 font-medium text-accent-700 ring-1 ring-accent-600" : "border-line text-zinc-700 hover:border-line-strong"
                  }`}
                >
                  <input type="radio" name="tenure" value={t} checked={sel} onChange={() => onLoan({ ...loan, tenure_months: t })} className="sr-only" />
                  <span className="tnum">{t}</span>
                  <span className="text-xs text-zinc-500">months</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={purposeId} className="text-sm font-medium">
            Purpose
          </label>
          <div className="relative mt-3">
            <select
              id={purposeId}
              value={loan.purpose}
              onChange={(e) => onLoan({ ...loan, purpose: e.target.value })}
              className="h-11 w-full appearance-none rounded-md border border-line-strong bg-white px-3.5 pr-10 text-[15px] hover:border-zinc-300"
            >
              {purposes.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true">
              <path d="M4.5 6.5L8 10l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3.5">
          <div>
            <p className="text-sm font-medium">Estimated EMI</p>
            <p className="text-[13px] text-zinc-500">Indicative, at {INDICATIVE_RATE}% a year</p>
          </div>
          <p className="text-lg font-semibold tnum">
            {inr(monthly)}
            <span className="text-sm font-normal text-zinc-500">/mo</span>
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
        <Button variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onContinue}>
          Check eligibility
        </Button>
      </div>
    </section>
  );
}

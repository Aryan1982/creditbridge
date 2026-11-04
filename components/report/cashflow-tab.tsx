import { CashflowChart } from "@/components/charts";
import { inr, pct } from "@/lib/format";
import type { Report } from "@/lib/types";
import { Card } from "@/components/ui";

export function CashflowTab({ report }: { report: Report }) {
  const m = report.income.monthly;
  const avgIn = m.reduce((s, r) => s + r.income, 0) / Math.max(m.length, 1);
  const avgOut = m.reduce((s, r) => s + r.expense, 0) / Math.max(m.length, 1);
  const balances = m.map((r) => r.closing_balance).filter((b): b is number => b != null);
  const lowBal = balances.length ? Math.min(...balances) : null;
  const surplusMonths = m.filter((r) => r.income >= r.expense).length;
  const ob = report.obligations;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        {[
          ["Average money in", `${inr(avgIn)}/mo`],
          ["Average money out", `${inr(avgOut)}/mo`],
          ["Months with a surplus", `${surplusMonths} of ${m.length}`],
          ["Lowest month-end balance", lowBal != null ? inr(lowBal) : "Not available"],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-5 py-4">
            <dt className="text-[13px] text-zinc-500">{k}</dt>
            <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] tnum">{v}</dd>
          </div>
        ))}
      </dl>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Monthly cash flow</h3>
          <ul className="flex flex-wrap gap-4 text-[13px] text-zinc-600" aria-hidden="true">
            <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-accent-600" />Money in</li>
            <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#c9d1f6]" />Money out</li>
            {balances.length > 0 && <li className="flex items-center gap-2"><span className="h-0.5 w-3 bg-ink" />Closing balance (right axis)</li>}
          </ul>
        </div>
        <div className="mt-5">
          <CashflowChart data={m} />
        </div>
        <table className="sr-only">
          <caption>Monthly money in, money out and closing balance</caption>
          <thead>
            <tr><th>Month</th><th>Money in</th><th>Money out</th><th>Closing balance</th></tr>
          </thead>
          <tbody>
            {m.map((r) => (
              <tr key={r.month}><td>{r.month}</td><td>{inr(r.income)}</td><td>{inr(r.expense)}</td><td>{inr(r.closing_balance)}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold">Existing obligations</h3>
        <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <div>
            <dt className="text-[13px] text-zinc-500">EMIs already paying</dt>
            <dd className="mt-1 font-semibold tnum">{ob.existing_emi_monthly > 0 ? `${inr(ob.existing_emi_monthly)}/mo` : "None"}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-zinc-500">Lenders</dt>
            <dd className="mt-1 font-semibold">{ob.lenders.length ? ob.lenders.join(", ") : "None found"}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-zinc-500">Share of income on EMIs</dt>
            <dd className="mt-1 font-semibold tnum">{pct(ob.foir)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-zinc-500">Bounced payments</dt>
            <dd className={`mt-1 font-semibold tnum ${ob.bounces > 0 ? "text-negative" : ""}`}>{ob.bounces}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

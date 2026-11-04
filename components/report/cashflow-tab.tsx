import { CashflowChart } from "@/components/charts";
import { inr, pct } from "@/lib/format";
import type { Report } from "@/lib/types";
import { StatStrip } from "@/components/ui";

export function CashflowTab({ report }: { report: Report }) {
  const m = report.income.monthly;
  const avgIn = m.reduce((s, r) => s + r.income, 0) / Math.max(m.length, 1);
  const avgOut = m.reduce((s, r) => s + r.expense, 0) / Math.max(m.length, 1);
  const balances = m.map((r) => r.closing_balance).filter((b): b is number => b != null);
  const lowBal = balances.length ? Math.min(...balances) : null;
  const surplusMonths = m.filter((r) => r.income >= r.expense).length;
  const ob = report.obligations;

  return (
    <div className="space-y-[18px]">
      <StatStrip
        items={[
          { label: "Average money in", value: inr(avgIn), hint: "per month" },
          { label: "Average money out", value: inr(avgOut), hint: "per month" },
          { label: "Months with a surplus", value: `${surplusMonths} of ${m.length}`, hint: "Money in ≥ money out" },
          { label: "Lowest month-end balance", value: lowBal != null ? inr(lowBal) : "—", hint: lowBal != null ? "Across the statement" : "Not in this statement" },
        ]}
      />

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Monthly cash flow</h3>
          <div className="legend" aria-hidden="true">
            <span>
              <i className="bg-accent" />
              Money in
            </span>
            <span>
              <i className="bg-series-3" />
              Money out
            </span>
            {balances.length > 0 && (
              <span>
                <i className="bg-positive" />
                Closing balance (right axis)
              </span>
            )}
          </div>
        </div>
        <div className="mt-5">
          <CashflowChart data={m} />
        </div>
        <table className="sr-only">
          <caption>Monthly money in, money out and closing balance</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Money in</th>
              <th>Money out</th>
              <th>Closing balance</th>
            </tr>
          </thead>
          <tbody>
            {m.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td>{inr(r.income)}</td>
                <td>{inr(r.expense)}</td>
                <td>{inr(r.closing_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h3 className="group-title px-1">Existing obligations</h3>
        <dl className="kv bg-panel! shadow-card">
          <dt>EMIs already paying</dt>
          <dd className="text-fg tnum">{ob.existing_emi_monthly > 0 ? `${inr(ob.existing_emi_monthly)} a month` : "None"}</dd>
          <dt>Lenders</dt>
          <dd className="text-fg">{ob.lenders.length ? ob.lenders.join(", ") : "None found"}</dd>
          <dt>Share of income on EMIs</dt>
          <dd className="text-fg tnum">{pct(ob.foir)}</dd>
          <dt>Bounced payments</dt>
          <dd className={`tnum ${ob.bounces > 0 ? "font-semibold text-negative" : "text-fg"}`}>{ob.bounces}</dd>
        </dl>
      </section>
    </div>
  );
}

import { inr, pct, titleCase } from "@/lib/format";
import type { Report } from "@/lib/types";
import { Badge, StatStrip } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = {
  salary: "Salary",
  gig: "Gig payouts",
  business: "Business sales",
  agri: "Farm income",
  transfer: "Transfers",
  mixed: "Mixed",
  interest: "Interest",
  refund: "Refunds",
};

export const incomeTypeLabel = (t: string) => TYPE_LABEL[t] ?? titleCase(t);

export function IncomeTab({ report }: { report: Report }) {
  const inc = report.income;
  const total = inc.sources.reduce((s, x) => s + x.monthly_avg, 0) || 1;
  const monthsWithIncome = inc.monthly.filter((m) => m.income > 0).length;

  return (
    <div className="space-y-[18px]">
      <StatStrip
        items={[
          { label: "Main income type", value: incomeTypeLabel(inc.primary_type), hint: `${inc.sources.length} recurring source${inc.sources.length === 1 ? "" : "s"}`, text: true },
          { label: "Average per month", value: inr(inc.monthly_avg) },
          { label: "Typical month", value: inr(inc.monthly_median), hint: "Median" },
          { label: "Consistency", value: pct(inc.stability), hint: `Income in ${monthsWithIncome} of ${inc.monthly.length} months` },
        ]}
      />

      <div className="card overflow-hidden">
        <div className="px-[22px] pb-1 pt-5">
          <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Where your income comes from</h3>
          <p className="mt-0.5 text-[13px] text-muted">Recurring credits grouped by payer.</p>
        </div>
        {inc.sources.length === 0 ? (
          <p className="empty">No recurring income source was found in this statement.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="data-table min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col" className="num">Payments</th>
                  <th scope="col" className="num">Per month</th>
                  <th scope="col" className="w-[30%]">Share</th>
                </tr>
              </thead>
              <tbody>
                {inc.sources.map((s) => {
                  const share = s.monthly_avg / total;
                  return (
                    <tr key={`${s.name}-${s.type}`}>
                      <td>
                        <div className="row-name">{s.name}</div>
                        <div className="mt-1">
                          <Badge>{incomeTypeLabel(s.type)}</Badge>
                        </div>
                      </td>
                      <td className="num text-muted">{s.count}</td>
                      <td className="num">
                        <span className="big-num">{inr(s.monthly_avg)}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-fill">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
                          </div>
                          <span className="w-10 text-right text-[13px] text-muted">{pct(share)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

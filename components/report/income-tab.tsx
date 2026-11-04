import { inr, pct, titleCase } from "@/lib/format";
import type { Report } from "@/lib/types";
import { Badge, Card } from "@/components/ui";

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
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        {[
          ["Main income type", incomeTypeLabel(inc.primary_type)],
          ["Average per month", inr(inc.monthly_avg)],
          ["Typical month", inr(inc.monthly_median)],
          ["Consistency", `${pct(inc.stability)} · ${monthsWithIncome} of ${inc.monthly.length} months`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-5 py-4">
            <dt className="text-[13px] text-zinc-500">{k}</dt>
            <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] tnum">{v}</dd>
          </div>
        ))}
      </dl>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-[15px] font-semibold">Where your income comes from</h3>
          <p className="mt-1 text-[13px] text-zinc-500">Recurring credits grouped by payer.</p>
        </div>
        {inc.sources.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-600">No recurring income source was found in this statement.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas text-left text-[12px] font-medium text-zinc-500">
                  <th scope="col" className="px-5 py-2.5 font-medium sm:px-6">Source</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Payments</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Per month</th>
                  <th scope="col" className="w-[28%] px-5 py-2.5 font-medium sm:px-6">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inc.sources.map((s) => {
                  const share = s.monthly_avg / total;
                  return (
                    <tr key={`${s.name}-${s.type}`}>
                      <td className="px-5 py-3 font-medium sm:px-6">{s.name}</td>
                      <td className="px-3 py-3">
                        <Badge>{incomeTypeLabel(s.type)}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right tnum text-zinc-600">{s.count}</td>
                      <td className="px-3 py-3 text-right font-medium tnum">{inr(s.monthly_avg)}</td>
                      <td className="px-5 py-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-accent-600" style={{ width: `${share * 100}%` }} />
                          </div>
                          <span className="w-10 text-right text-[13px] text-zinc-600 tnum">{pct(share)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

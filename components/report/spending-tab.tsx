import { Donut, SERIES } from "@/components/charts";
import { inr, pct } from "@/lib/format";
import type { Report } from "@/lib/types";
import { Card } from "@/components/ui";

const TOP = 7;

export function SpendingTab({ report }: { report: Report }) {
  const sp = report.spending;
  const sorted = [...sp.categories].sort((a, b) => b.monthly_avg - a.monthly_avg);
  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const rows = rest.length
    ? [...top, { category: "_rest", label: `${rest.length} more categories`, monthly_avg: rest.reduce((s, r) => s + r.monthly_avg, 0), share: rest.reduce((s, r) => s + r.share, 0) }]
    : top;
  const total = sorted.reduce((s, r) => s + r.monthly_avg, 0);
  const otherShare = Math.max(0, 1 - sp.essentials_share - sp.discretionary_share);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold">Spending by category</h3>
        <p className="mt-1 text-[13px] text-zinc-500">Average per month, {inr(total)} in total.</p>
        <div className="mt-6 flex flex-col items-center gap-8 md:flex-row md:items-start">
          <div className="relative flex-none">
            <Donut data={rows.map((r) => ({ name: r.label, value: Math.round(r.monthly_avg) }))} label="Spending by category" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[12px] text-zinc-500">Per month</span>
              <span className="text-lg font-semibold tnum">{inr(total)}</span>
            </div>
          </div>
          <ul className="w-full flex-1 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={r.category} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
                <span className="flex-1 truncate text-zinc-700">{r.label}</span>
                <span className="w-12 text-right text-[13px] text-zinc-500 tnum">{pct(r.share)}</span>
                <span className="w-24 text-right font-medium tnum">{inr(r.monthly_avg)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold">Needs and wants</h3>
        <p className="mt-1 text-[13px] text-zinc-500">How your spending splits between essentials and the rest.</p>
        <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
          <div className="h-full bg-accent-600" style={{ width: `${sp.essentials_share * 100}%` }} />
          <div className="h-full bg-[#c9d1f6]" style={{ width: `${sp.discretionary_share * 100}%` }} />
        </div>
        <dl className="mt-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-sm text-zinc-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent-600" aria-hidden="true" />
              Essentials
            </dt>
            <dd className="text-sm font-semibold tnum">{pct(sp.essentials_share)}</dd>
          </div>
          <p className="-mt-2 pl-[18px] text-[13px] text-zinc-500">Rent, groceries, bills, transport, health, education, EMIs</p>
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-sm text-zinc-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#c9d1f6]" aria-hidden="true" />
              Discretionary
            </dt>
            <dd className="text-sm font-semibold tnum">{pct(sp.discretionary_share)}</dd>
          </div>
          <p className="-mt-2 pl-[18px] text-[13px] text-zinc-500">Shopping, food delivery, entertainment and other</p>
          {otherShare > 0.005 && (
            <>
              <div className="flex items-start justify-between gap-4">
                <dt className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="h-2.5 w-2.5 rounded-sm bg-zinc-200" aria-hidden="true" />
                  Transfers, cash and savings
                </dt>
                <dd className="text-sm font-semibold tnum">{pct(otherShare)}</dd>
              </div>
              <p className="-mt-2 pl-[18px] text-[13px] text-zinc-500">Money sent to people, cash withdrawals, investments</p>
            </>
          )}
        </dl>
      </Card>
    </div>
  );
}

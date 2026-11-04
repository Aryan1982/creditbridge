import { Donut, SERIES } from "@/components/charts";
import { inr, pct } from "@/lib/format";
import type { Report } from "@/lib/types";

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
  const split = [
    { label: "Essentials", share: sp.essentials_share, color: "var(--accent)", hint: "Rent, groceries, bills, transport, health, education, EMIs" },
    { label: "Discretionary", share: sp.discretionary_share, color: "#ff9500", hint: "Shopping, food delivery, entertainment" },
    ...(otherShare > 0.005 ? [{ label: "Transfers, cash and savings", share: otherShare, color: "var(--faint)", hint: "Money sent to people, cash withdrawals, investments" }] : []),
  ];

  return (
    <div className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
      <div className="card p-5 sm:p-6">
        <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Spending by category</h3>
        <p className="mt-0.5 text-[13px] text-muted">Average per month.</p>
        <div className="mt-6 flex flex-col items-center gap-8 md:flex-row md:items-center">
          <div className="relative flex-none">
            <Donut data={rows.map((r) => ({ name: r.label, value: Math.round(r.monthly_avg) }))} label="Spending by category" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[12px] text-muted">Per month</span>
              <span className="text-[21px] font-bold tracking-[-0.025em] text-fg tnum">{inr(total)}</span>
            </div>
          </div>
          <ul className="w-full flex-1 divide-y divide-sep">
            {rows.map((r, i) => (
              <li key={r.category} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
                <span className="flex-1 truncate text-fg-2">{r.label}</span>
                <span className="w-12 text-right text-[13px] text-faint tnum">{pct(r.share)}</span>
                <span className="w-24 text-right font-semibold text-fg tnum">{inr(r.monthly_avg)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Needs and wants</h3>
        <p className="mt-0.5 text-[13px] text-muted">How your spending splits.</p>
        <div className="mt-6 flex h-3 w-full gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
          {split.map((s) => (
            <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.share * 100}%`, background: s.color }} />
          ))}
        </div>
        <dl className="mt-5 space-y-4">
          {split.map((s) => (
            <div key={s.label}>
              <div className="flex items-start justify-between gap-4">
                <dt className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </dt>
                <dd className="text-sm font-semibold text-fg tnum">{pct(s.share)}</dd>
              </div>
              <dd className="mt-0.5 pl-[18px] text-[12.5px] text-muted">{s.hint}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

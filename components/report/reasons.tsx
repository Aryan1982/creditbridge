import { T } from "@/lib/i18n";
import type { Lang, Reason } from "@/lib/types";
import { SectionTitle } from "@/components/ui";

export function Reasons({ reasons, lang }: { reasons: Reason[]; lang: Lang }) {
  const t = T[lang];
  const max = Math.max(...reasons.map((r) => Math.abs(r.impact)), 0.0001);
  return (
    <section aria-labelledby="why-title" className="flex flex-col">
      <SectionTitle id="why-title" title={<span lang={lang}>{t.why}</span>} sub={<span lang={lang}>{t.whySub}</span>} />
      <ul className="card mt-4 divide-y divide-sep overflow-hidden">
        {reasons.map((r) => {
          const helps = r.direction === "helps";
          return (
            <li key={r.key} className="flex gap-3.5 px-5 py-4">
              <span
                className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full ${helps ? "bg-positive/12 text-positive" : "bg-negative/12 text-negative"}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 12 12" className="h-3.5 w-3.5">
                  {helps ? (
                    <path d="M6 9.5v-7m0 0L3 5.5m3-3l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M6 2.5v7m0 0L3 6.5m3 3l3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{r.label}</p>
                  <p className="text-sm font-medium text-fg-2 tnum">{r.value_display}</p>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{r.detail}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-fill-2">
                    <div className={`h-full rounded-full ${helps ? "bg-positive" : "bg-negative"}`} style={{ width: `${(Math.abs(r.impact) / max) * 100}%` }} />
                  </div>
                  <span className={`min-w-16 text-right text-xs font-semibold ${helps ? "text-positive" : "text-negative"}`} lang={lang}>
                    {helps ? t.helps : t.hurts}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

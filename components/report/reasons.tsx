import { T } from "@/lib/i18n";
import type { Lang, Reason } from "@/lib/types";
import { SectionTitle } from "@/components/ui";

export function Reasons({ reasons, lang }: { reasons: Reason[]; lang: Lang }) {
  const t = T[lang];
  const max = Math.max(...reasons.map((r) => Math.abs(r.impact)), 0.0001);
  return (
    <section aria-labelledby="why-title">
      <SectionTitle id="why-title" title={<span lang={lang}>{t.why}</span>} sub={<span lang={lang}>{t.whySub}</span>} />
      <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
        {reasons.map((r) => {
          const helps = r.direction === "helps";
          return (
            <li key={r.key} className="flex gap-4 px-5 py-4">
              <span
                className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full ${helps ? "bg-positive-bg text-positive" : "bg-negative-bg text-negative"}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3">
                  {helps ? (
                    <path d="M6 9.5v-7m0 0L3 5.5m3-3l3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M6 2.5v7m0 0L3 6.5m3 3l3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium text-ink">{r.label}</p>
                  <p className="text-sm text-zinc-600 tnum">{r.value_display}</p>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{r.detail}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1 flex-1 rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full ${helps ? "bg-positive" : "bg-negative"}`}
                      style={{ width: `${(Math.abs(r.impact) / max) * 100}%`, opacity: 0.75 }}
                    />
                  </div>
                  <span className={`w-28 text-right text-xs font-medium ${helps ? "text-positive" : "text-negative"}`} lang={lang}>
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

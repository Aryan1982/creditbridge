import { T } from "@/lib/i18n";
import type { Improvement, Lang } from "@/lib/types";
import { SectionTitle } from "@/components/ui";

export function Improvements({ improvements, current, lang }: { improvements: Improvement[]; current: number; lang: Lang }) {
  const t = T[lang];
  const best = improvements.reduce((m, i) => Math.max(m, i.score_after), current);
  return (
    <section aria-labelledby="improve-title">
      <SectionTitle
        id="improve-title"
        title={<span lang={lang}>{t.improve}</span>}
        sub={<span lang={lang}>{t.improveSub}</span>}
      />
      {improvements.length === 0 ? (
        <p className="mt-5 rounded-xl border border-line px-5 py-6 text-sm text-zinc-600">
          Your cash flow already scores well on every factor we measure. Keep your current habits to maintain this result.
        </p>
      ) : (
        <ol className="mt-5 divide-y divide-line rounded-xl border border-line">
          {improvements.map((imp, i) => {
            const delta = imp.score_after - current;
            return (
              <li key={imp.key} className="flex gap-4 px-5 py-4">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-line-strong text-xs font-medium text-zinc-600 tnum">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{imp.label}</p>
                  <p className="mt-1 text-[13px] text-zinc-600">
                    <span lang={lang}>{t.now}</span> <span className="tnum">{imp.current}</span>
                    <span className="mx-1.5 text-zinc-400" aria-hidden="true">→</span>
                    <span className="sr-only">,</span> <span lang={lang}>{t.target}</span> <span className="font-medium text-ink tnum">{imp.target}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tnum">{imp.score_after}</p>
                  <p className={`text-xs tnum ${delta > 0 ? "text-positive" : "text-zinc-500"}`}>{delta > 0 ? `+${delta}` : delta}</p>
                </div>
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-4 bg-canvas px-5 py-3.5 text-sm">
            <span className="text-zinc-600" lang={lang}>
              {t.projected}
            </span>
            <span className="tnum">
              <span className="text-zinc-500">{current}</span>
              <span className="mx-1.5 text-zinc-400" aria-hidden="true">→</span>
              <span className="font-semibold text-ink">{best}</span>
            </span>
          </li>
        </ol>
      )}
    </section>
  );
}

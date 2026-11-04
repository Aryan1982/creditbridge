import { T } from "@/lib/i18n";
import type { Improvement, Lang } from "@/lib/types";
import { SectionTitle } from "@/components/ui";

export function Improvements({ improvements, current, lang }: { improvements: Improvement[]; current: number; lang: Lang }) {
  const t = T[lang];
  const best = improvements.reduce((m, i) => Math.max(m, i.score_after), current);
  return (
    <section aria-labelledby="improve-title" className="flex flex-col">
      <SectionTitle id="improve-title" title={<span lang={lang}>{t.improve}</span>} sub={<span lang={lang}>{t.improveSub}</span>} />
      {improvements.length === 0 ? (
        <p className="card mt-4 px-5 py-6 text-sm text-muted">
          Your cash flow already scores well on every factor we measure. Keep your current habits to maintain this result.
        </p>
      ) : (
        <div className="card mt-4 flex flex-col overflow-hidden">
          <div className="p-3 pb-0">
            <div className="headline flex items-end justify-between gap-4">
              <div>
                <p className="k" lang={lang}>
                  {t.projected}
                </p>
                <p className="big mt-1">
                  {best}
                  <small className="text-positive!">+{best - current}</small>
                </p>
              </div>
              <p className="range-line pb-1">
                <span lang={lang}>{t.now}</span> <span className="tnum">{current}</span>
              </p>
            </div>
          </div>
          <ol className="divide-y divide-sep">
            {improvements.map((imp, i) => {
              const delta = imp.score_after - current;
              return (
                <li key={imp.key} className="flex gap-3.5 px-5 py-4">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent tnum">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{imp.label}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      <span lang={lang}>{t.now}</span> <span className="tnum">{imp.current}</span>
                      <span className="mx-1.5 text-faint" aria-hidden="true">
                        →
                      </span>
                      <span className="sr-only">,</span> <span lang={lang}>{t.target}</span> <span className="font-medium text-fg tnum">{imp.target}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="big-num tnum">{imp.score_after}</p>
                    <p className={`text-xs font-semibold tnum ${delta > 0 ? "text-positive" : "text-faint"}`}>{delta > 0 ? `+${delta}` : delta}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

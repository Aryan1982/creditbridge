import { bandTone, decisionTone, inr, pct, statusTone, TONE_COLOR } from "@/lib/format";
import { T } from "@/lib/i18n";
import type { Lang, LoanRequest, Report } from "@/lib/types";
import { Badge, StatusDot, StatusIcon } from "@/components/ui";
import { ScoreGauge } from "./score-gauge";

export function DecisionHero({ report, loan, lang }: { report: Report; loan: LoanRequest; lang: Lang }) {
  const t = T[lang];
  const { risk, affordability: aff, income, obligations, integrity } = report;
  const tone = decisionTone(risk.decision);
  const scale = Math.max(aff.max_emi, aff.requested_emi, 1);
  const within = aff.within_limit;

  return (
    <section className="card overflow-hidden">
      <h2 className="sr-only">Decision</h2>
      {risk.decision_note && (
        <div role="note" className="flex items-start gap-2.5 bg-caution/10 px-6 py-3 text-[13.5px] text-fg-2">
          <StatusIcon status="warn" className="mt-0.5" />
          <span>{risk.decision_note}</span>
        </div>
      )}
      <div className="grid lg:grid-cols-[300px_1fr_360px]">
        <div className="flex flex-col items-center px-6 pb-7 pt-8 text-center">
          <p className="kicker" lang={lang}>
            {t.creditScore}
          </p>
          <div className="mt-3 w-full">
            <ScoreGauge score={risk.score} tone={bandTone(risk.band)} label={t.creditScore} />
          </div>
          <p className="mt-1 text-[13px] text-faint" lang={lang}>
            {t.outOf}
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="text-[21px] font-bold tracking-[-0.02em]" style={{ color: TONE_COLOR[tone] }} lang={lang}>
              {t.decision[risk.decision]}
            </span>
            <Badge tone={bandTone(risk.band)}>
              <span lang={lang}>{t.band}</span>&nbsp;{risk.band}
            </Badge>
          </div>
        </div>

        <div className="relative flex flex-col px-6 py-7 before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-sep sm:px-8 lg:before:inset-x-auto lg:before:inset-y-8 lg:before:left-0 lg:before:h-auto lg:before:w-px">
          <p className="kicker" lang={lang}>
            {t.summary}
          </p>
          <p className="mt-2 max-w-[60ch] text-[17px] leading-[1.55] tracking-[-0.015em] text-fg" lang={lang}>
            {report.summary[lang] || report.summary.en}
          </p>
          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-5 pt-8">
            <div>
              <dt className="stat-label" lang={lang}>{t.monthlyIncome}</dt>
              <dd className="mt-0.5 text-[17px] font-semibold text-fg tnum">{inr(income.monthly_median)}</dd>
            </div>
            <div>
              <dt className="stat-label" lang={lang}>{t.incomeStability}</dt>
              <dd className="mt-0.5 text-[17px] font-semibold text-fg tnum">{pct(income.stability)}</dd>
            </div>
            <div>
              <dt className="stat-label" lang={lang}>{t.existingEmis}</dt>
              <dd className="mt-0.5 text-[17px] font-semibold text-fg tnum">
                {obligations.existing_emi_monthly > 0 ? `${inr(obligations.existing_emi_monthly)}${t.perMonth}` : t.none}
              </dd>
            </div>
            <div>
              <dt className="stat-label" lang={lang}>{t.statement}</dt>
              <dd className="mt-1">
                <StatusDot tone={statusTone(integrity.status)}>
                  <span lang={lang} className="text-[15px] font-semibold text-fg">
                    {t.status[integrity.status]}
                  </span>
                </StatusDot>
              </dd>
            </div>
          </dl>
        </div>

        <div className="p-3 lg:pl-0">
          <div className="headline h-full">
            <p className="k" lang={lang}>
              {t.loanRequest(inr(loan.amount), loan.tenure_months)}
            </p>
            <div className="mt-5 space-y-4">
              <EmiBar label={t.requestedEmi} value={aff.requested_emi} scale={scale} color={within ? "var(--accent)" : "var(--red)"} lang={lang} per={t.perMonth} />
              <EmiBar label={t.affordableEmi} value={aff.max_emi} scale={scale} color="var(--green)" lang={lang} per={t.perMonth} />
            </div>
            <p className={`mt-4 text-[13px] font-medium ${within ? "text-positive" : "text-negative"}`} lang={lang}>
              {within ? t.withinLimit : t.overLimit}
            </p>
            <div className="mt-5 border-t border-sep pt-5">
              <p className="k" lang={lang}>
                {t.recommendedAmount}
              </p>
              <p className="big mt-1">{inr(aff.recommended_amount)}</p>
              <p className="range-line" lang={lang}>
                {t.tenureAt(aff.tenure_months, aff.rate_pct)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmiBar({ label, value, scale, color, lang, per }: { label: string; value: number; scale: number; color: string; lang: Lang; per: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted" lang={lang}>
          {label}
        </span>
        <span className="font-semibold text-fg tnum">
          {inr(value)}
          <span className="font-normal text-muted" lang={lang}>
            {per}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-fill">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / scale) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

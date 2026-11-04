import { bandTone, decisionTone, inr, pct, statusTone, TONE_HEX } from "@/lib/format";
import { T } from "@/lib/i18n";
import type { Lang, LoanRequest, Report } from "@/lib/types";
import { Badge, Card, StatusIcon } from "@/components/ui";
import { ScoreGauge } from "./score-gauge";

export function DecisionHero({ report, loan, lang }: { report: Report; loan: LoanRequest; lang: Lang }) {
  const t = T[lang];
  const { risk, affordability: aff, income, obligations, integrity } = report;
  const tone = decisionTone(risk.decision);
  const scale = Math.max(aff.max_emi, aff.requested_emi, 1);
  const within = aff.within_limit;

  return (
    <Card as="section" className="overflow-hidden">
      <h2 className="sr-only">Decision</h2>
      {risk.decision_note && (
        <div role="note" className="flex items-start gap-2.5 border-b border-amber-200 bg-caution-bg px-6 py-3 text-sm text-zinc-800">
          <StatusIcon status="warn" className="mt-0.5 flex-none" />
          <span>{risk.decision_note}</span>
        </div>
      )}
      <div className="grid divide-y divide-line lg:grid-cols-[300px_1fr_340px] lg:divide-x lg:divide-y-0">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <p className="text-[13px] text-zinc-500" lang={lang}>
            {t.creditScore}
          </p>
          <div className="mt-3 w-full">
            <ScoreGauge score={risk.score} tone={bandTone(risk.band)} label={t.creditScore} />
          </div>
          <p className="mt-1 text-[13px] text-zinc-500" lang={lang}>
            {t.outOf}
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="text-lg font-semibold" style={{ color: TONE_HEX[tone] }} lang={lang}>
              {t.decision[risk.decision]}
            </span>
            <Badge tone={bandTone(risk.band)}>
              <span lang={lang}>{t.band}</span>&nbsp;{risk.band}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col px-6 py-6 sm:px-8 sm:py-8">
          <p className="text-[13px] font-medium text-zinc-500" lang={lang}>
            {t.summary}
          </p>
          <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink" lang={lang}>
            {report.summary[lang] || report.summary.en}
          </p>
          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-5 pt-8 sm:grid-cols-4 lg:grid-cols-2 lg:gap-x-10">
            <div>
              <dt className="text-[13px] text-zinc-500" lang={lang}>{t.monthlyIncome}</dt>
              <dd className="mt-1 font-semibold tnum">{inr(income.monthly_median)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-zinc-500" lang={lang}>{t.incomeStability}</dt>
              <dd className="mt-1 font-semibold tnum">{pct(income.stability)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-zinc-500" lang={lang}>{t.existingEmis}</dt>
              <dd className="mt-1 font-semibold tnum">{obligations.existing_emi_monthly > 0 ? `${inr(obligations.existing_emi_monthly)}${t.perMonth}` : t.none}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-zinc-500" lang={lang}>{t.statement}</dt>
              <dd className="mt-1 font-semibold" style={{ color: TONE_HEX[statusTone(integrity.status)] }}>
                <span lang={lang}>{t.status[integrity.status]}</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-canvas px-6 py-6 sm:px-8 sm:py-8">
          <p className="text-[13px] font-medium text-zinc-500" lang={lang}>
            {t.loanRequest(inr(loan.amount), loan.tenure_months)}
          </p>
          <div className="mt-5 space-y-4">
            <EmiBar label={t.requestedEmi} value={aff.requested_emi} scale={scale} color={within ? "#3350d6" : TONE_HEX.negative} lang={lang} per={t.perMonth} />
            <EmiBar label={t.affordableEmi} value={aff.max_emi} scale={scale} color="#a1a1aa" lang={lang} per={t.perMonth} />
          </div>
          <p className={`mt-4 flex items-center gap-2 text-[13px] ${within ? "text-positive" : "text-negative"}`} lang={lang}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {within ? t.withinLimit : t.overLimit}
          </p>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[13px] text-zinc-500" lang={lang}>
              {t.recommendedAmount}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] tnum">{inr(aff.recommended_amount)}</p>
            <p className="mt-1 text-[13px] text-zinc-500" lang={lang}>
              {t.tenureAt(aff.tenure_months, aff.rate_pct)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmiBar({ label, value, scale, color, lang, per }: { label: string; value: number; scale: number; color: string; lang: Lang; per: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-zinc-600" lang={lang}>
          {label}
        </span>
        <span className="font-semibold tnum">
          {inr(value)}
          <span className="font-normal text-zinc-500" lang={lang}>
            {per}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-zinc-200/70">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / scale) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

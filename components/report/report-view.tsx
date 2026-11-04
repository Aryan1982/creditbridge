"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { analyze, getSamples } from "@/lib/api";
import { fmtDate, personaLabel } from "@/lib/format";
import { LANGS, T } from "@/lib/i18n";
import { loadReport, saveReport, type StoredReport } from "@/lib/store";
import type { Lang, LoanRequest } from "@/lib/types";
import { Button, ButtonLink, ErrorState, Skeleton } from "@/components/ui";
import { DecisionHero } from "./decision-hero";
import { Reasons } from "./reasons";
import { Improvements } from "./improvements";
import { ReportTabs } from "./report-tabs";
import { DecisionLetter } from "./decision-letter";

const DEFAULT_LOAN: LoanRequest = { amount: 50000, tenure_months: 12, purpose: "business" };

async function loadSample(id: string): Promise<StoredReport> {
  const samples = await getSamples();
  const sample = samples.find((s) => s.id === id);
  if (!sample) throw new Error("This applicant could not be found.");
  const loan = sample.loan ?? DEFAULT_LOAN;
  const report = await analyze({ sampleId: sample.id, loan });
  return { report, loan, source: { kind: "sample", label: sample.name, sampleId: sample.id }, createdAt: new Date().toISOString() };
}

type State = { status: "loading" } | { status: "empty" } | { status: "error"; message: string } | { status: "ready"; data: StoredReport };

export function ReportView() {
  const params = useSearchParams();
  const sampleParam = params.get("sample");
  const fromLender = params.get("from") === "lender";
  const [state, setState] = useState<State>({ status: "loading" });
  const [lang, setLang] = useState<Lang>("en");
  const [attempt, setAttempt] = useState(0);
  // One request per (sample, attempt), even if the effect re-runs (React StrictMode in development).
  const inflight = useRef<{ key: string; promise: Promise<StoredReport> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = loadReport();
    if (!sampleParam) {
      setState(stored ? { status: "ready", data: stored } : { status: "empty" });
      return;
    }
    if (stored?.source.sampleId === sampleParam && stored.source.kind === "sample") {
      setState({ status: "ready", data: stored });
      return;
    }
    setState({ status: "loading" });
    const key = `${sampleParam}:${attempt}`;
    if (inflight.current?.key !== key) inflight.current = { key, promise: loadSample(sampleParam) };
    inflight.current.promise.then(
      (data) => {
        saveReport(data);
        if (!cancelled) setState({ status: "ready", data });
      },
      (e: Error) => {
        if (!cancelled) setState({ status: "error", message: e.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sampleParam, attempt]);

  if (state.status === "loading") return <ReportSkeleton />;

  if (state.status === "empty")
    return (
      <div className="container-page max-w-xl! py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">No report yet</h1>
        <p className="mt-2 text-[15px] text-zinc-600">Run an eligibility check to see your decision, the reasons behind it and how to improve.</p>
        <ButtonLink href="/check" size="lg" className="mt-8">
          Check eligibility
        </ButtonLink>
      </div>
    );

  if (state.status === "error")
    return (
      <div className="container-page max-w-xl! py-20">
        <ErrorState
          title="We couldn’t load this report"
          message={state.message}
          action={
            <div className="flex gap-3">
              <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
              <ButtonLink href={fromLender ? "/lender" : "/check"} variant="secondary">
                {fromLender ? "Back to portfolio" : "Start a new check"}
              </ButtonLink>
            </div>
          }
        />
      </div>
    );

  const { report, loan } = state.data;
  const t = T[lang];
  const a = report.applicant;

  return (
    <>
      <div className="print:hidden">
        <div className="border-b border-line bg-canvas">
          <div className="container-page py-6 md:py-8">
            {fromLender && (
              <Link href="/lender" className="mb-4 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-ink">
                <span aria-hidden="true">←</span> Portfolio
              </Link>
            )}
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="text-[26px] font-semibold tracking-[-0.025em] sm:text-[28px]">{a.name}</h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {[personaLabel(a.persona), a.bank, `${fmtDate(a.start_date)} – ${fmtDate(a.end_date)}`, `${a.transaction_count.toLocaleString("en-IN")} transactions`]
                    .filter((x) => x && x !== "—")
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <LangToggle lang={lang} onChange={setLang} />
                <Button variant="secondary" onClick={() => window.print()}>
                  <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                    <path d="M8 2.5v7.5m0 0L5 7m3 3l3-3M3 12.5h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span lang={lang}>{t.download}</span>
                </Button>
                <ButtonLink href="/check" variant="ghost">
                  <span lang={lang}>{t.newCheck}</span>
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>

        <div className="container-page space-y-12 py-8 md:py-10">
          <DecisionHero report={report} loan={loan} lang={lang} />
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
            <Reasons reasons={report.risk.reasons} lang={lang} />
            <Improvements improvements={report.improvements} current={report.risk.score} lang={lang} />
          </div>
          <ReportTabs report={report} lang={lang} />
        </div>
      </div>
      <DecisionLetter data={state.data} />
    </>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex rounded-md border border-line-strong bg-white p-0.5">
      {LANGS.map((l, i) => {
        const sel = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={l.name}
            tabIndex={sel ? 0 : -1}
            lang={l.code}
            onClick={() => onChange(l.code)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = LANGS[(i + d + LANGS.length) % LANGS.length];
              onChange(next.code);
              (e.currentTarget.parentElement?.children[(i + d + LANGS.length) % LANGS.length] as HTMLElement | undefined)?.focus();
            }}
            className={`h-8 rounded-[5px] px-3 text-[13px] transition-colors ${sel ? "bg-ink font-medium text-white" : "text-zinc-600 hover:text-ink"}`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading report">
      <div className="border-b border-line bg-canvas">
        <div className="container-page py-8">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="container-page space-y-8 py-10">
        <Skeleton className="h-[280px]" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
        </div>
      </div>
    </div>
  );
}

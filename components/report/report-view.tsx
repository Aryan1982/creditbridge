"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { analyze, getSamples } from "@/lib/api";
import { fmtDate, personaLabel } from "@/lib/format";
import { LANGS, T } from "@/lib/i18n";
import { loadReport, saveReport, type StoredReport } from "@/lib/store";
import type { Lang, LoanRequest } from "@/lib/types";
import { Button, ButtonLink, ErrorState, PageHeader, Segmented, Skeleton } from "@/components/ui";
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
        <h1 className="large-title">No report yet</h1>
        <p className="mt-3 text-[17px] text-muted">Run an eligibility check to see your decision, the reasons behind it and how to improve.</p>
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
              <ButtonLink href={fromLender ? "/lender" : "/check"} variant="tinted">
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
      <div className="container-page print:hidden">
        <PageHeader
          kicker={
            fromLender ? (
              <Link href="/lender" className="inline-flex items-center gap-0.5 text-accent hover:underline">
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                  <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Portfolio
              </Link>
            ) : (
              personaLabel(a.persona)
            )
          }
          title={a.name}
          sub={[fromLender ? personaLabel(a.persona) : null, a.bank, `${fmtDate(a.start_date)} – ${fmtDate(a.end_date)}`, `${a.transaction_count.toLocaleString("en-IN")} transactions`]
            .filter((x) => x && x !== "—")
            .join(" · ")}
          actions={
            <>
              <Segmented
                label="Language"
                value={lang}
                onChange={setLang}
                options={LANGS.map((l) => ({ value: l.code, label: l.label, ariaLabel: l.name, lang: l.code }))}
              />
              <Button variant="secondary" onClick={() => window.print()}>
                <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
                </svg>
                <span lang={lang}>{t.download}</span>
              </Button>
              <ButtonLink href="/check" variant="secondary">
                <span lang={lang}>{t.newCheck}</span>
              </ButtonLink>
            </>
          }
        />

        <div className="space-y-12">
          <DecisionHero report={report} loan={loan} lang={lang} />
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-[18px]">
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

function ReportSkeleton() {
  return (
    <div className="container-page" aria-busy="true" aria-label="Loading report">
      <div className="pb-7 pt-12">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-[300px]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
      </div>
    </div>
  );
}

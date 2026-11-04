"use client";

import { useEffect, useRef, useState } from "react";
import { analyze } from "@/lib/api";
import type { LoanRequest, Report } from "@/lib/types";
import { Button } from "@/components/ui";
import type { Source } from "./connect-step";

const STAGE_COUNT = 5;
const TICK_MS = 420;

function stageLabels(n: number | null) {
  return [
    "Reading statement",
    "Verifying authenticity",
    n != null ? `Categorising ${n.toLocaleString("en-IN")} transactions` : "Categorising transactions",
    "Analysing cash flow",
    "Scoring",
  ];
}

export function AnalysisStep({
  source,
  loan,
  onDone,
  onBack,
}: {
  source: Source;
  loan: LoanRequest;
  onDone: (r: Report) => void;
  onBack: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<Report | null>(null);
  // One request per attempt, even if the effect re-runs (React StrictMode in development).
  const inflight = useRef<{ attempt: number; promise: Promise<Report> } | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // The real request.
  useEffect(() => {
    let cancelled = false;
    setActive(0);
    setResult(null);
    setError(null);
    resultRef.current = null;
    if (inflight.current?.attempt !== attempt) {
      inflight.current = {
        attempt,
        promise: analyze({
          file: source.kind === "upload" ? source.file : undefined,
          sampleId: source.kind === "upload" ? undefined : source.sampleId,
          loan,
        }),
      };
    }
    inflight.current.promise
      .then((r) => {
        if (cancelled) return;
        resultRef.current = r;
        setResult(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "We couldn’t analyse this statement.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, source, loan]);

  // Stage progression: advances while waiting but never past the last stage until the response is in.
  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setActive((a) => {
        if (resultRef.current) return Math.min(a + 1, STAGE_COUNT);
        return Math.min(a + 1, STAGE_COUNT - 1);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [attempt, error]);

  useEffect(() => {
    if (active >= STAGE_COUNT && result) {
      const t = setTimeout(() => doneRef.current(result), 300);
      return () => clearTimeout(t);
    }
  }, [active, result]);

  const labels = stageLabels(result?.applicant.transaction_count ?? null);
  const complete = active >= STAGE_COUNT && !!result;

  return (
    <section aria-labelledby="analysis-title" className="mx-auto max-w-md py-4">
      <h2 id="analysis-title" className="text-lg font-semibold tracking-[-0.01em]">
        {error ? "We couldn’t finish the analysis" : complete ? "Your report is ready" : "Analysing your statement"}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        {error ? "Nothing was saved. You can try again or use a different statement." : "This usually takes a few seconds."}
      </p>

      <ol className="mt-8 space-y-0" aria-live="polite">
        {labels.map((label, i) => {
          const state = error && i === Math.min(active, STAGE_COUNT - 1) ? "error" : i < active ? "done" : i === active && !error ? "active" : "pending";
          return (
            <li key={i} className="relative flex items-center gap-4 pb-6 last:pb-0">
              {i < labels.length - 1 && (
                <span className={`absolute left-[11px] top-7 h-[calc(100%-28px)] w-px ${i < active ? "bg-accent-600" : "bg-line"}`} aria-hidden="true" />
              )}
              <span className="relative flex h-6 w-6 flex-none items-center justify-center">
                {state === "done" && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white">
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path d="M2.5 6.2l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {state === "active" && (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent-100 border-t-accent-600" aria-hidden="true" />
                )}
                {state === "pending" && <span className="h-6 w-6 rounded-full border border-line-strong bg-white" aria-hidden="true" />}
                {state === "error" && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-negative text-white">
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
              </span>
              <span
                className={`text-[15px] ${
                  state === "pending" ? "text-zinc-400" : state === "error" ? "font-medium text-negative" : state === "active" ? "font-medium text-ink" : "text-zinc-700"
                }`}
              >
                {label}
                <span className="sr-only">
                  {state === "done" ? " — done" : state === "active" ? " — in progress" : state === "error" ? " — failed" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-8">
          <div role="alert" className="rounded-lg border border-red-200 bg-negative-bg/60 px-4 py-3 text-sm text-zinc-800">
            {error}
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
            <Button variant="secondary" onClick={onBack}>
              Use a different statement
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

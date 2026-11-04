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
  const progress = Math.min(active, STAGE_COUNT) / STAGE_COUNT;

  return (
    <section aria-labelledby="analysis-title" className="card mx-auto max-w-[520px] p-6 sm:p-8">
      <div className="text-center">
        <ProgressRing value={error ? 1 : progress} error={!!error} />
        <h2 id="analysis-title" className="section-title mt-5">
          {error ? "We couldn’t finish the analysis" : complete ? "Your report is ready" : "Analysing your statement"}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {error ? "Nothing was saved. You can try again or use a different statement." : "This usually takes a few seconds."}
        </p>
      </div>

      <ol className="group-list mt-7" aria-live="polite">
        {labels.map((label, i) => {
          const state = error && i === Math.min(active, STAGE_COUNT - 1) ? "error" : i < active ? "done" : i === active && !error ? "active" : "pending";
          return (
            <li key={i} className="flex items-center gap-3.5 px-4 py-3">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center">
                {state === "done" && (
                  <svg viewBox="0 0 16 16" className="h-[22px] w-[22px] text-positive" aria-hidden="true">
                    <circle cx="8" cy="8" r="8" fill="currentColor" />
                    <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {state === "active" && <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-fill border-t-accent" aria-hidden="true" />}
                {state === "pending" && <span className="h-[18px] w-[18px] rounded-full border-[1.5px] border-fill" aria-hidden="true" />}
                {state === "error" && (
                  <svg viewBox="0 0 16 16" className="h-[22px] w-[22px] text-negative" aria-hidden="true">
                    <circle cx="8" cy="8" r="8" fill="currentColor" />
                    <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span
                className={`text-[15px] ${
                  state === "pending" ? "text-faint" : state === "error" ? "font-medium text-negative" : state === "active" ? "font-semibold text-fg" : "text-fg-2"
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
        <div className="mt-6">
          <p role="alert" className="rounded-[14px] bg-negative/10 px-4 py-3 text-sm text-fg-2">
            {error}
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Button className="flex-1" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </Button>
            <Button variant="tinted" className="flex-1" onClick={onBack}>
              Use a different statement
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProgressRing({ value, error }: { value: number; error: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-16 w-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--fill)" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={error ? "var(--red)" : "var(--accent)"}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0.04, value))}
        style={{ transition: "stroke-dashoffset .45s var(--ease)" }}
      />
    </svg>
  );
}

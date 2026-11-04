"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSamples } from "@/lib/api";
import { saveReport } from "@/lib/store";
import type { LoanRequest, Report, Sample } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { Stepper } from "./stepper";
import { ConnectStep, type Source } from "./connect-step";
import { LoanStep } from "./loan-step";
import { AnalysisStep } from "./analysis-step";

export function CheckFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source | null>(null);
  const [loan, setLoan] = useState<LoanRequest>({ amount: 50000, tenure_months: 12, purpose: "business" });
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [samplesError, setSamplesError] = useState<string | null>(null);

  useEffect(() => {
    getSamples()
      .then(setSamples)
      .catch((e: Error) => setSamplesError(e.message));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  function chooseSource(next: Source | null) {
    setSource(next);
    if (next && next.kind !== "upload") {
      const sample = samples?.find((x) => x.id === next.sampleId);
      if (sample?.loan) setLoan({ ...sample.loan });
    }
  }

  function onDone(report: Report) {
    if (!source) return;
    saveReport({
      report,
      loan,
      source: {
        kind: source.kind,
        label: source.kind === "upload" ? source.file.name : source.label,
        sampleId: source.kind === "upload" ? undefined : source.sampleId,
      },
      createdAt: new Date().toISOString(),
    });
    router.push("/report");
  }

  return (
    <div className="container-page max-w-[880px]!">
      <PageHeader kicker="Eligibility check" title="Check your eligibility" sub="No credit history needed. Takes about a minute." actions={<Stepper current={step} />} />

      <div key={step} className="animate-rise">
        {step === 0 && (
          <ConnectStep
            samples={samples}
            samplesError={samplesError}
            source={source}
            onSource={chooseSource}
            onContinue={() => setStep(1)}
          />
        )}
        {step === 1 && source && (
          <LoanStep loan={loan} onLoan={setLoan} source={source} onBack={() => setStep(0)} onContinue={() => setStep(2)} />
        )}
        {step === 2 && source && <AnalysisStep source={source} loan={loan} onDone={onDone} onBack={() => setStep(0)} />}
      </div>
    </div>
  );
}

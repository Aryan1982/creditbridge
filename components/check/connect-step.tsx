"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { personaLabel } from "@/lib/format";
import type { Sample } from "@/lib/types";
import { Badge, Button, ErrorState, Skeleton } from "@/components/ui";
import { ConsentScreen } from "./consent-screen";

export type Source =
  | { kind: "upload"; file: File }
  | { kind: "aa"; sampleId: string; label: string }
  | { kind: "sample"; sampleId: string; label: string };

type Method = "upload" | "aa" | "sample";

const METHODS: { id: Method; title: string; body: string }[] = [
  { id: "upload", title: "Upload statement", body: "PDF or CSV from your bank" },
  { id: "aa", title: "Account Aggregator", body: "Share securely with consent" },
  { id: "sample", title: "Try a sample profile", body: "See how it works first" },
];

export const FORMAT_LABEL: Record<Sample["format"], string> = {
  csv: "CSV statement",
  pdf: "PDF statement",
  aa_json: "Account Aggregator",
};

const MAX_BYTES = 10 * 1024 * 1024;

function MethodIcon({ id }: { id: Method }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      {id === "upload" && (
        <>
          <path d="M5 2.75h6.5L15 6.25v11H5z" {...common} />
          <path d="M11.5 2.75v3.5H15M10 14.5v-5M7.75 11.5L10 9.25l2.25 2.25" {...common} />
        </>
      )}
      {id === "aa" && (
        <>
          <path d="M10 2.5l6 2.5v4.5c0 3.6-2.5 6.6-6 8-3.5-1.4-6-4.4-6-8V5z" {...common} />
          <path d="M7.25 10l2 2 3.5-3.75" {...common} />
        </>
      )}
      {id === "sample" && (
        <>
          <circle cx="10" cy="7" r="3" {...common} />
          <path d="M4 17c.7-3 3.1-4.75 6-4.75S15.3 14 16 17" {...common} />
        </>
      )}
    </svg>
  );
}

function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ConnectStep({
  samples,
  samplesError,
  source,
  onSource,
  onContinue,
}: {
  samples: Sample[] | null;
  samplesError: string | null;
  source: Source | null;
  onSource: (s: Source | null) => void;
  onContinue: () => void;
}) {
  const [method, setMethod] = useState<Method>(source?.kind ?? "upload");
  const groupId = useId();

  function onKey(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = METHODS[(idx + dir + METHODS.length) % METHODS.length].id;
    setMethod(next);
    document.getElementById(`${groupId}-${next}`)?.focus();
  }

  const ready = source !== null && source.kind === method;

  return (
    <section aria-labelledby="connect-title">
      <h2 id="connect-title" className="text-lg font-semibold tracking-[-0.01em]">
        How would you like to share your transactions?
      </h2>
      <p className="mt-1 text-sm text-zinc-600">We need 6–12 months of history from the account where you receive income.</p>

      <div role="radiogroup" aria-label="Connection method" className="mt-6 grid gap-3 sm:grid-cols-3">
        {METHODS.map((m, i) => {
          const selected = m.id === method;
          return (
            <button
              key={m.id}
              id={`${groupId}-${m.id}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => setMethod(m.id)}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors sm:flex-col sm:gap-4 ${
                selected ? "border-accent-600 bg-accent-50/50 ring-1 ring-accent-600" : "border-line hover:border-line-strong"
              }`}
            >
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-md border ${selected ? "border-accent-200 bg-white text-accent-600" : "border-line text-zinc-600"}`}>
                <MethodIcon id={m.id} />
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{m.title}</span>
                <span className="mt-0.5 block text-[13px] text-zinc-500">{m.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {method === "upload" && <UploadPanel source={source} onSource={onSource} example={samples?.find((s) => s.format === "pdf" && !s.tampered) ?? null} />}
        {method === "aa" && (
          <ConsentScreen
            samples={samples}
            samplesError={samplesError}
            approved={source?.kind === "aa" ? source : null}
            onApprove={(s) => {
              onSource({ kind: "aa", sampleId: s.id, label: s.name });
              onContinue();
            }}
            onRevoke={() => onSource(null)}
          />
        )}
        {method === "sample" && <SamplePanel samples={samples} samplesError={samplesError} source={source} onSource={onSource} />}
      </div>

      {method !== "aa" && (
        <div className="sticky bottom-0 z-10 mt-8 flex items-center justify-end gap-3 border-t border-line bg-white/95 py-4 backdrop-blur-sm">
          <Button size="lg" disabled={!ready} onClick={onContinue}>
            Continue
          </Button>
        </div>
      )}
    </section>
  );
}

function UploadPanel({ source, onSource, example }: { source: Source | null; onSource: (s: Source | null) => void; example: Sample | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = source?.kind === "upload" ? source.file : null;

  function accept(f: File | undefined) {
    if (!f) return;
    const ok = /\.(pdf|csv|json)$/i.test(f.name);
    if (!ok) {
      setError("Please choose a PDF or CSV bank statement.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 10 MB. Please export a shorter period.");
      return;
    }
    setError(null);
    onSource({ kind: "upload", file: f });
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${
          dragging ? "border-accent-600 bg-accent-50" : "border-line-strong bg-canvas"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-zinc-400" aria-hidden="true">
          <path d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-4 text-sm font-medium text-ink">Drag your statement here</p>
        <p className="mt-1 text-[13px] text-zinc-500">PDF or CSV, up to 10 MB</p>
        <Button variant="secondary" className="mt-5" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.json,application/pdf,text/csv,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Bank statement file"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}
        </p>
      )}
      {file && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-accent-50 text-[11px] font-semibold uppercase text-accent-700">
              {file.name.split(".").pop()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-[13px] text-zinc-500 tnum">{prettyBytes(file.size)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSource(null)}>
            Remove
          </Button>
        </div>
      )}
      <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
        Your file is read in memory to produce this result and is not stored. Password-protected PDFs need to be unlocked first.
        {example && (
          <>
            {" "}
            No statement to hand?{" "}
            <a href={`/api/samples/${encodeURIComponent(example.id)}/file`} download className="font-medium text-accent-600 underline-offset-2 hover:underline">
              Download an example PDF
            </a>{" "}
            and upload it here.
          </>
        )}
      </p>
    </div>
  );
}

function SamplePanel({
  samples,
  samplesError,
  source,
  onSource,
}: {
  samples: Sample[] | null;
  samplesError: string | null;
  source: Source | null;
  onSource: (s: Source | null) => void;
}) {
  if (samplesError) return <ErrorState title="Couldn’t load sample profiles" message={samplesError} />;
  if (!samples)
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );

  const selectedId = source?.kind === "sample" ? source.sampleId : null;
  const groups = [
    { title: "Applicant profiles", sub: "Bank statements exported as CSV.", items: samples.filter((s) => !s.variant_of && !s.tampered) },
    { title: "Other formats", sub: "The same people, as a bank PDF or Account Aggregator data.", items: samples.filter((s) => s.variant_of && !s.tampered) },
    { title: "Edited statements", sub: "Altered documents, to see the authenticity checks catch them.", items: samples.filter((s) => s.tampered) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend className="text-sm font-medium text-ink">{g.title}</legend>
          <p className="mt-0.5 text-[13px] text-zinc-500">{g.sub}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {g.items.map((s) => (
              <SampleCard key={s.id} sample={s} selected={s.id === selectedId} onSelect={() => onSource({ kind: "sample", sampleId: s.id, label: s.name })} />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function SampleCard({ sample: s, selected, onSelect }: { sample: Sample; selected: boolean; onSelect: () => void }) {
  return (
    <label
      className={`relative flex cursor-pointer flex-col rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-600 ${
        selected ? "border-accent-600 bg-accent-50/50 ring-1 ring-accent-600" : "border-line hover:border-line-strong"
      }`}
    >
      <input type="radio" name="sample" value={s.id} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-ink">{s.name}</span>
          <span className="block text-[13px] text-zinc-500">{personaLabel(s.persona)}</span>
        </span>
        <span
          className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border ${selected ? "border-accent-600 bg-accent-600" : "border-line-strong bg-white"}`}
          aria-hidden="true"
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
      </span>
      <span className="mt-3 block text-[13px] leading-relaxed text-zinc-600">{s.description}</span>
      <span className="mt-4 flex flex-wrap gap-2">
        <Badge>{FORMAT_LABEL[s.format] ?? s.format}</Badge>
        {s.tampered && <Badge tone="caution">Edited statement</Badge>}
      </span>
    </label>
  );
}

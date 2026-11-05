"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/api";
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
  { id: "upload", title: "Upload statement", body: "CSV, PDF or AA JSON from your bank" },
  { id: "aa", title: "Account Aggregator", body: "Share securely with consent" },
  { id: "sample", title: "Try a sample profile", body: "See how it works first" },
];

export const FORMAT_LABEL: Record<Sample["format"], string> = {
  csv: "CSV statement",
  pdf: "PDF statement",
  aa_json: "Account Aggregator",
};


function MethodIcon({ id }: { id: Method }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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

/** Blue check badge shown on a selected tile. */
export function SelectedCheck({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full transition-colors ${on ? "bg-accent" : "bg-transparent ring-[1.5px] ring-inset ring-[var(--faint)]/50"}`}
      aria-hidden="true"
    >
      {on && (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
          <path d="M2.5 6.2l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

const TILE = "card relative text-left transition-[box-shadow,transform] duration-300 ease-apple hover:-translate-y-0.5";
const TILE_ON = "ring-2 ring-accent";

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
      <h2 id="connect-title" className="section-title px-1">
        How would you like to share your transactions?
      </h2>
      <p className="mt-1 px-1 text-[13px] text-muted">We need 6–12 months of history from the account where you receive income.</p>

      <div role="radiogroup" aria-label="Connection method" className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-[18px]">
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
              className={`${TILE} flex items-center gap-4 p-4 sm:flex-col sm:items-start sm:p-5 ${selected ? TILE_ON : ""}`}
            >
              <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${selected ? "bg-accent text-white" : "bg-fill-2 text-fg-2"}`}>
                <MethodIcon id={m.id} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold tracking-[-0.01em] text-fg">{m.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{m.body}</span>
              </span>
              <span className="sm:absolute sm:right-4 sm:top-4">
                <SelectedCheck on={selected} />
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
        <div className="sticky bottom-3 z-10 mt-8 flex items-center justify-between gap-3 rounded-[18px] bg-[var(--nav)] px-4 py-3 shadow-card backdrop-blur-[20px] backdrop-saturate-[1.8]">
          <p className="truncate text-[13px] text-muted">
            {ready ? (
              <>
                Selected: <span className="font-medium text-fg">{source?.kind === "upload" ? source.file.name : source?.label}</span>
              </>
            ) : method === "upload" ? (
              "Choose a statement to continue"
            ) : (
              "Pick a profile to continue"
            )}
          </p>
          <Button disabled={!ready} onClick={onContinue}>
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
    if (!/\.(pdf|csv|json)$/i.test(f.name)) {
      setError("Please choose a CSV, PDF or Account Aggregator JSON bank statement.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError(`That file is larger than ${MAX_UPLOAD_LABEL}. Please export a shorter period.`);
      return;
    }
    setError(null);
    onSource({ kind: "upload", file: f });
  }

  return (
    <div className="card p-3 sm:p-4">
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
        className={`flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-transparent bg-fill-2"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel text-accent shadow-card">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-fg">Drop your statement here</p>
        <p className="mt-1 text-[13px] text-muted">CSV, PDF or Account Aggregator JSON, up to {MAX_UPLOAD_LABEL}</p>
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
        <p role="alert" className="mt-3 px-2 text-sm text-negative">
          {error}
        </p>
      )}
      {file && (
        <div className="group-list mt-3">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-accent text-[10px] font-bold uppercase text-white">
                {file.name.split(".").pop()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{file.name}</p>
                <p className="text-[12.5px] text-muted tnum">{prettyBytes(file.size)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onSource(null)}>
              Remove
            </Button>
          </div>
        </div>
      )}
      <p className="px-2 pb-1 pt-3 text-[12.5px] leading-relaxed text-faint">
        Your file is read in memory to produce this result and is not stored. Password-protected PDFs need to be unlocked first.
        {example && (
          <>
            {" "}
            No statement to hand?{" "}
            <a href={`/api/samples/${encodeURIComponent(example.id)}/file`} download className="font-medium text-accent hover:underline">
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
          <Skeleton key={i} className="h-36" />
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
    <div className="space-y-9">
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend className="px-1 text-[17px] font-semibold tracking-[-0.015em] text-fg">{g.title}</legend>
          <p className="mt-0.5 px-1 text-[13px] text-muted">{g.sub}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-[18px]">
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
    <label className={`${TILE} flex cursor-pointer flex-col p-5 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-accent/45 ${selected ? TILE_ON : ""}`}>
      <input type="radio" name="sample" value={s.id} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="row-name">{s.name}</span>
          <span className="row-sub block">{personaLabel(s.persona)}</span>
        </span>
        <SelectedCheck on={selected} />
      </span>
      <span className="mt-3 block flex-1 text-[13px] leading-relaxed text-fg-2">{s.description}</span>
      <span className="mt-4 flex flex-wrap gap-2">
        <Badge tone="accent">{FORMAT_LABEL[s.format] ?? s.format}</Badge>
        {s.tampered && <Badge tone="caution">Edited statement</Badge>}
      </span>
    </label>
  );
}

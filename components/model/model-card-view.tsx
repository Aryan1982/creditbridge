"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalibrationChart, HBarChart } from "@/components/charts";
import { getModelCard } from "@/lib/api";
import { categoryLabel, num, personaLabel, titleCase } from "@/lib/format";
import type { ModelCard } from "@/lib/types";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "risk", label: "Risk model" },
  { id: "categorizer", label: "Transaction categorizer" },
  { id: "fairness", label: "Fairness" },
  { id: "external", label: "External validation" },
  { id: "limitations", label: "Limitations" },
];

function fmtCell(key: string, v: unknown): ReactNode {
  if (v == null) return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("en-IN");
    if (/rate|share|pct/.test(key) && v <= 1) return `${(v * 100).toFixed(1)}%`;
    return v.toFixed(3);
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "persona" && typeof v === "string") return personaLabel(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function headerLabel(k: string) {
  const map: Record<string, string> = { n_applicants: "Applicants", n_transactions: "Transactions", auc: "AUC", n: "n", ks: "KS", f1: "F1", pd: "PD", foir: "FOIR", brier: "Brier", tpr: "TPR", fpr: "FPR" };
  return map[k] ?? titleCase(k).replace(/\bAuc\b/g, "AUC").replace(/\bPd\b/g, "PD");
}

function DataTable({ rows, caption }: { rows: Record<string, unknown>[]; caption: string }) {
  if (!rows?.length) return <p className="text-sm text-zinc-500">No data reported.</p>;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas text-[12px] text-zinc-500">
            {cols.map((c, i) => (
              <th key={c} scope="col" className={`px-4 py-2.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                {headerLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {cols.map((c, i) => (
                <td key={c} className={`px-4 py-2.5 tnum ${i === 0 ? "text-left font-medium" : "text-right text-zinc-700"}`}>
                  {fmtCell(c, r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KV({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v != null && typeof v !== "object");
  const nested = Object.entries(data ?? {}).filter(([, v]) => v != null && typeof v === "object");
  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(140px,40%)_1fr] gap-4 px-4 py-2.5">
              <dt className="text-zinc-500">{headerLabel(k)}</dt>
              <dd className="tnum text-ink">{fmtCell(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {nested.map(([k, v]) =>
        Array.isArray(v) ? (
          v.length && typeof v[0] === "object" ? (
            <div key={k}>
              <p className="mb-2 text-[13px] font-medium text-zinc-700">{headerLabel(k)}</p>
              <DataTable rows={v as Record<string, unknown>[]} caption={headerLabel(k)} />
            </div>
          ) : (
            <div key={k}>
              <p className="mb-2 text-[13px] font-medium text-zinc-700">{headerLabel(k)}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {(v as unknown[]).map((x, i) => (
                  <li key={i}>{String(x)}</li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div key={k}>
            <p className="mb-2 text-[13px] font-medium text-zinc-700">{headerLabel(k)}</p>
            <KV data={v as Record<string, unknown>} />
          </div>
        ),
      )}
    </div>
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Benchmark is usually { modelName: { auc, ks, ... } }; show it as one comparison table. */
function Benchmark({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {});
  if (entries.length > 0 && entries.every(([, v]) => isPlainObject(v))) {
    const rows = entries.map(([name, v]) => ({ model: titleCase(name).replace(/\bWoe\b/, "WoE"), ...(v as Record<string, unknown>) }));
    return <DataTable rows={rows} caption="Benchmark models" />;
  }
  return <KV data={data} />;
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line pt-10">
      <h2 id={`${id}-title`} className="text-[20px] font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {sub && <div className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed text-zinc-600">{sub}</div>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white px-5 py-5">
      <dt className="text-[13px] text-zinc-500">{label}</dt>
      <dd className="mt-1 text-[26px] font-semibold tracking-[-0.025em] tnum">{value}</dd>
      <dd className="mt-0.5 text-[12px] leading-snug text-zinc-500">{hint}</dd>
    </div>
  );
}

export function ModelCardView() {
  const [card, setCard] = useState<ModelCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    getModelCard()
      .then(setCard)
      .catch((e: Error) => setError(e.message));
  }, [attempt]);

  return (
    <div className="container-page py-10 md:py-12">
      <div className="max-w-3xl">
        <p className="text-[13px] font-medium text-accent-600">Model transparency</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] sm:text-[32px]">Model card</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
          How the CreditBridge transaction categorizer and risk model were built and evaluated, for credit risk teams, auditors and regulators.
        </p>
      </div>

      {error ? (
        <div className="mt-8 max-w-2xl">
          <ErrorState title="Couldn’t load the model card" message={error} action={<Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>} />
        </div>
      ) : !card ? (
        <div className="mt-10 space-y-6" aria-busy="true" aria-label="Loading model card">
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[360px]" />
        </div>
      ) : (
        <ModelCardBody card={card} />
      )}
    </div>
  );
}

function ModelCardBody({ card }: { card: ModelCard }) {
  const { risk, categorizer: cat, fairness, external_validation: ext, data } = card;
  const { description, n_applicants, n_transactions, synthetic, ...dataRest } = data;
  const perClass = [...cat.per_class].sort((a, b) => b.f1 - a.f1);
  const fi = [...risk.feature_importance].sort((a, b) => b.importance - a.importance).slice(0, 15);
  const ablations = [...risk.ablations].sort((a, b) => b.auc - a.auc);
  const { by_gender, by_persona, notes, ...fairRest } = fairness;
  const { dataset, alt_only_auc, bureau_only_auc, thin_file, ...extRest } = ext;

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Model card sections" className="hidden lg:block">
        <ul className="sticky top-24 space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-md px-2 py-1.5 text-zinc-600 hover:bg-zinc-50 hover:text-ink">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-12">
        <section id="overview" aria-labelledby="overview-title" className="scroll-mt-24">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="overview-title" className="text-[20px] font-semibold tracking-[-0.02em]">
              Overview
            </h2>
            <Badge tone="accent">Version {card.version}</Badge>
            {synthetic && <Badge tone="caution">Synthetic training data</Badge>}
          </div>
          {description && <p className="mt-2 max-w-[75ch] text-[15px] leading-relaxed text-zinc-600">{String(description)}</p>}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
            <Metric label="Risk AUC" value={num(risk.auc)} hint="Ranking of defaulters vs. non-defaulters" />
            <Metric label="KS" value={num(risk.ks)} hint="Max separation of score distributions" />
            <Metric label="Gini" value={num(risk.gini)} hint="2 × AUC − 1" />
            <Metric label="Brier score" value={num(risk.brier)} hint="Probability calibration error (lower is better)" />
            <Metric label="Categorizer accuracy" value={`${(cat.accuracy * 100).toFixed(1)}%`} hint={cat.eval} />
            <Metric label="Categorizer macro F1" value={num(cat.macro_f1)} hint={`${cat.per_class.length} categories`} />
          </dl>
          {(n_applicants != null || n_transactions != null || Object.keys(dataRest).length > 0) && (
            <Card className="mt-6 p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold">Training data</h3>
              <div className="mt-4">
                <KV data={{ n_applicants, n_transactions, ...dataRest }} />
              </div>
            </Card>
          )}
        </section>

        <Section id="risk" title="Risk model" sub={<><span className="font-medium text-ink">{risk.model}</span>. Probability of default is mapped to a 300–900 score and A–E bands.</>}>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold">Calibration</h3>
              <p className="mt-1 text-[13px] text-zinc-500">Predicted vs. observed default rate by score bin. Dashed line is perfect calibration.</p>
              <div className="mt-4">
                <CalibrationChart data={risk.calibration} />
              </div>
            </Card>
            <Card className="p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold">Ablations</h3>
              <p className="mt-1 text-[13px] text-zinc-500">Holdout AUC when feature groups are removed. Axis starts at 0.5 (random).</p>
              <div className="mt-4">
                <HBarChart data={ablations.map((a) => ({ label: a.name, value: a.auc }))} format={(v) => v.toFixed(2)} domain={[0.5, 1]} height={ablations.length * 52 + 40} />
              </div>
            </Card>
          </div>
          <Card className="p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold">Feature importance</h3>
            <p className="mt-1 text-[13px] text-zinc-500">Top {fi.length} features by contribution to the risk model.</p>
            <div className="mt-4">
              <HBarChart data={fi.map((f) => ({ label: f.label, value: f.importance }))} format={(v) => v.toFixed(3)} height={fi.length * 40 + 40} />
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">Performance by persona</h3>
              <DataTable rows={risk.by_persona as unknown as Record<string, unknown>[]} caption="AUC by persona" />
            </div>
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">Benchmark models</h3>
              <Benchmark data={risk.benchmark} />
            </div>
          </div>
        </Section>

        <Section id="categorizer" title="Transaction categorizer" sub={<><span className="font-medium text-ink">{cat.model}</span>. Evaluated on {cat.eval}.</>}>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">F1 score per category</caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-[12px] text-zinc-500">
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Category</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Support</th>
                  <th scope="col" className="w-[45%] px-4 py-2.5 text-left font-medium">F1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perClass.map((c) => (
                  <tr key={c.category}>
                    <td className="px-4 py-2 font-medium">{c.label ?? categoryLabel(c.category)}</td>
                    <td className="px-4 py-2 text-right text-zinc-600 tnum">{c.support.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
                          <div className={`h-full rounded-full ${c.f1 < 0.8 ? "bg-caution" : "bg-accent-600"}`} style={{ width: `${c.f1 * 100}%` }} />
                        </div>
                        <span className="w-12 text-right tnum">{c.f1.toFixed(3)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="fairness" title="Fairness" sub={notes ? String(notes) : undefined}>
          {by_gender && by_gender.length > 0 && (
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">By gender</h3>
              <DataTable rows={by_gender} caption="Fairness by gender" />
            </div>
          )}
          {by_persona && by_persona.length > 0 && (
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">By persona</h3>
              <DataTable rows={by_persona} caption="Fairness by persona" />
            </div>
          )}
          {Object.keys(fairRest).length > 0 && <KV data={fairRest} />}
        </Section>

        <Section
          id="external"
          title="External validation"
          sub={<>Does cash-flow-style alternative data carry signal on real credit outcomes? Tested on the public {dataset} dataset.</>}
        >
          <Card className="p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold">{dataset}: AUC by feature set</h3>
            <div className="mt-5 space-y-4">
              {[
                { label: "Alternative data only", v: alt_only_auc, accent: true },
                { label: "Bureau-style history only", v: bureau_only_auc, accent: false },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-700">{r.label}</span>
                    <span className="font-semibold tnum">{num(r.v)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${r.accent ? "bg-accent-600" : "bg-zinc-400"}`} style={{ width: `${Math.max(0, (r.v - 0.5) / 0.5) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[12px] text-zinc-500">Bars start at AUC 0.5 (random).</p>
            </div>
          </Card>
          {thin_file && (
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">Thin-file applicants</h3>
              <KV data={thin_file} />
            </div>
          )}
          {Object.keys(extRest).length > 0 && (
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">Additional results</h3>
              <KV data={extRest} />
            </div>
          )}
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="space-y-3">
            {card.limitations.map((l, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-zinc-700">
                <span className="mt-2.5 h-1 w-1 flex-none rounded-full bg-zinc-400" aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

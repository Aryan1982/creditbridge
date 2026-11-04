"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalibrationChart, HBarChart } from "@/components/charts";
import { getModelCard } from "@/lib/api";
import { categoryLabel, num, personaLabel, titleCase } from "@/lib/format";
import type { ModelCard } from "@/lib/types";
import { Badge, Button, ErrorState, PageHeader, Skeleton, StatStrip } from "@/components/ui";

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
  if (!rows?.length) return <p className="card empty">No data reported.</p>;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <div className="card overflow-x-auto">
      <table className="mini">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col">
                {headerLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {cols.map((c, i) => (
                <td key={c} className={i === 0 ? "font-medium text-fg" : "text-fg-2"}>
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
    <div className="space-y-5">
      {entries.length > 0 && (
        <dl className="kv bg-panel! shadow-card">
          {entries.flatMap(([k, v]) => [
            <dt key={`${k}-k`}>{headerLabel(k)}</dt>,
            <dd key={`${k}-v`} className="text-fg tnum">
              {fmtCell(k, v)}
            </dd>,
          ])}
        </dl>
      )}
      {nested.map(([k, v]) =>
        Array.isArray(v) ? (
          <div key={k}>
            <p className="group-title px-1">{headerLabel(k)}</p>
            {v.length && typeof v[0] === "object" ? (
              <DataTable rows={v as Record<string, unknown>[]} caption={headerLabel(k)} />
            ) : (
              <ul className="card divide-y divide-sep overflow-hidden text-sm text-fg-2">
                {(v as unknown[]).map((x, i) => (
                  <li key={i} className="px-4 py-2.5 leading-relaxed">
                    {String(x)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div key={k}>
            <p className="group-title px-1">{headerLabel(k)}</p>
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
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <h2 id={`${id}-title`} className="text-[28px] font-bold tracking-[-0.03em] text-fg">
        {title}
      </h2>
      {sub && <div className="mt-1.5 max-w-[72ch] text-[15px] leading-relaxed text-muted">{sub}</div>}
      <div className="mt-6 space-y-[18px]">{children}</div>
    </section>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted">{sub}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="group-title px-1">{children}</h3>;
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
    <div className="container-page">
      <PageHeader
        kicker="Model transparency"
        title="Model card"
        sub="How the CreditBridge transaction categorizer and risk model were built and evaluated, for credit risk teams, auditors and regulators."
      />
      {error ? (
        <ErrorState title="Couldn’t load the model card" message={error} action={<Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>} />
      ) : !card ? (
        <div className="grid gap-[18px] lg:grid-cols-[240px_1fr]" aria-busy="true" aria-label="Loading model card">
          <Skeleton className="hidden h-[280px] lg:block" />
          <div className="space-y-[18px]">
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[360px]" />
          </div>
        </div>
      ) : (
        <ModelCardBody card={card} />
      )}
    </div>
  );
}

/** Highlights the section nearest the top of the viewport (reference: docs list selection). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const SECTION_IDS = SECTIONS.map((s) => s.id);

function ModelCardBody({ card }: { card: ModelCard }) {
  const { risk, categorizer: cat, fairness, external_validation: ext, data } = card;
  const { description, n_applicants, n_transactions, synthetic, ...dataRest } = data;
  const perClass = [...cat.per_class].sort((a, b) => b.f1 - a.f1);
  const fi = [...risk.feature_importance].sort((a, b) => b.importance - a.importance).slice(0, 15);
  const ablations = [...risk.ablations].sort((a, b) => b.auc - a.auc);
  const { by_gender, by_persona, notes, ...fairRest } = fairness;
  const { dataset, alt_only_auc, bureau_only_auc, thin_file, ...extRest } = ext;
  const active = useActiveSection(SECTION_IDS);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Model card sections" className="card sticky top-[68px] z-10 p-2 max-lg:-mx-[14px] max-lg:rounded-none max-lg:bg-[var(--nav)] max-lg:shadow-none max-lg:backdrop-blur-[20px] lg:top-[76px] lg:p-3">
        <ul className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id} className="flex-none">
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(s.id);
                  history.replaceState(null, "", `#${s.id}`);
                }}
                data-on={active === s.id}
                aria-current={active === s.id ? "location" : undefined}
                className="side-item whitespace-nowrap max-lg:rounded-full! max-lg:px-3! max-lg:py-1.5! max-lg:text-[13px]! max-lg:data-[on=false]:bg-fill-2"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-16">
        <section id="overview" aria-labelledby="overview-title" className="scroll-mt-20">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="overview-title" className="text-[28px] font-bold tracking-[-0.03em] text-fg">
              Overview
            </h2>
            <Badge tone="accent">Version {card.version}</Badge>
            {synthetic && <Badge tone="caution">Synthetic training data</Badge>}
          </div>
          {description && <p className="mt-1.5 max-w-[75ch] text-[15px] leading-relaxed text-muted">{String(description)}</p>}
          <StatStrip
            className="mt-6"
            items={[
              { label: "Risk AUC", value: num(risk.auc), hint: "Ranks defaulters vs. non-defaulters" },
              { label: "KS", value: num(risk.ks), hint: "Max separation of score distributions" },
              { label: "Gini", value: num(risk.gini), hint: "2 × AUC − 1" },
              { label: "Brier score", value: num(risk.brier), hint: "Calibration error, lower is better" },
            ]}
          />
          <StatStrip
            className="mt-[18px]"
            items={[
              { label: "Categorizer accuracy", value: `${(cat.accuracy * 100).toFixed(1)}%`, hint: cat.eval },
              { label: "Categorizer macro F1", value: num(cat.macro_f1), hint: `${cat.per_class.length} categories` },
            ]}
          />
          {(n_applicants != null || n_transactions != null || Object.keys(dataRest).length > 0) && (
            <div className="mt-8">
              <SubTitle>Training data</SubTitle>
              <KV data={{ n_applicants, n_transactions, ...dataRest }} />
            </div>
          )}
        </section>

        <Section
          id="risk"
          title="Risk model"
          sub={
            <>
              <span className="font-medium text-fg">{risk.model}</span>. Probability of default is mapped to a 300–900 score and A–E bands.
            </>
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-[18px] xl:grid-cols-2">
            <ChartCard title="Calibration" sub="Predicted vs. observed default rate by score bin. Dashed line is perfect calibration.">
              <CalibrationChart data={risk.calibration} />
            </ChartCard>
            <ChartCard title="Ablations" sub="Holdout AUC when feature groups are removed. Axis starts at 0.5 (random).">
              <HBarChart data={ablations.map((a) => ({ label: a.name, value: a.auc }))} format={(v) => v.toFixed(2)} domain={[0.5, 1]} height={ablations.length * 52 + 40} />
            </ChartCard>
          </div>
          <ChartCard title="Feature importance" sub={`Top ${fi.length} features by contribution to the risk model.`}>
            <HBarChart data={fi.map((f) => ({ label: f.label, value: f.importance }))} format={(v) => v.toFixed(3)} height={fi.length * 40 + 40} />
          </ChartCard>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-[18px] xl:grid-cols-2">
            <div>
              <SubTitle>Performance by persona</SubTitle>
              <DataTable rows={risk.by_persona as unknown as Record<string, unknown>[]} caption="AUC by persona" />
            </div>
            <div>
              <SubTitle>Benchmark models</SubTitle>
              <Benchmark data={risk.benchmark} />
            </div>
          </div>
        </Section>

        <Section
          id="categorizer"
          title="Transaction categorizer"
          sub={
            <>
              <span className="font-medium text-fg">{cat.model}</span>. Evaluated on {cat.eval}.
            </>
          }
        >
          <div className="card overflow-x-auto">
            <table className="mini min-w-[520px]">
              <caption className="sr-only">F1 score per category</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Support</th>
                  <th scope="col" className="w-[45%] text-left!">
                    F1
                  </th>
                </tr>
              </thead>
              <tbody>
                {perClass.map((c) => (
                  <tr key={c.category}>
                    <td className="font-medium text-fg">{c.label ?? categoryLabel(c.category)}</td>
                    <td className="text-muted">{c.support.toLocaleString("en-IN")}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-fill">
                          <div className={`h-full rounded-full ${c.f1 < 0.8 ? "bg-caution" : "bg-accent"}`} style={{ width: `${c.f1 * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-semibold text-fg">{c.f1.toFixed(3)}</span>
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
              <SubTitle>By gender</SubTitle>
              <DataTable rows={by_gender} caption="Fairness by gender" />
            </div>
          )}
          {by_persona && by_persona.length > 0 && (
            <div>
              <SubTitle>By persona</SubTitle>
              <DataTable rows={by_persona} caption="Fairness by persona" />
            </div>
          )}
          {Object.keys(fairRest).length > 0 && <KV data={fairRest} />}
        </Section>

        <Section id="external" title="External validation" sub={<>Does cash-flow-style alternative data carry signal on real credit outcomes? Tested on the public {dataset} dataset.</>}>
          <div className="card p-5 sm:p-6">
            <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">AUC by feature set</h3>
            <p className="mt-0.5 text-[13px] text-muted">{dataset} · bars start at AUC 0.5 (random)</p>
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-[18px] sm:grid-cols-2">
              {[
                { label: "Alternative data only", v: alt_only_auc, color: "var(--accent)" },
                { label: "Bureau-style history only", v: bureau_only_auc, color: "var(--faint)" },
              ].map((r) => (
                <div key={r.label} className="headline">
                  <p className="k">{r.label}</p>
                  <p className="big mt-1">{num(r.v)}</p>
                  <div className="mt-3 h-2 rounded-full bg-fill">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, (r.v - 0.5) / 0.5) * 100}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {thin_file && (
            <div>
              <SubTitle>Thin-file applicants</SubTitle>
              <KV data={thin_file} />
            </div>
          )}
          {Object.keys(extRest).length > 0 && (
            <div>
              <SubTitle>Additional results</SubTitle>
              <KV data={extRest} />
            </div>
          )}
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="card divide-y divide-sep overflow-hidden">
            {card.limitations.map((l, i) => (
              <li key={i} className="flex gap-3.5 px-5 py-3.5 text-[15px] leading-relaxed text-fg-2">
                <StatusIconInfo />
                {l}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function StatusIconInfo() {
  return (
    <svg viewBox="0 0 16 16" className="mt-[4px] h-4 w-4 flex-none text-faint" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r=".95" fill="currentColor" />
    </svg>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { HistogramChart } from "@/components/charts";
import { getPortfolio } from "@/lib/api";
import { bandTone, DECISION_LABEL, decisionTone, inr, pct, personaLabel, STATUS_LABEL, statusTone, TONE_COLOR } from "@/lib/format";
import type { Decision, Portfolio, PortfolioApplicant, Status } from "@/lib/types";
import { Badge, Button, ButtonLink, ErrorState, PageHeader, SearchField, Sheet, Skeleton, StatStrip, StatusDot } from "@/components/ui";

const FORMAT_SHORT: Record<string, string> = { csv: "CSV", pdf: "PDF", aa_json: "Account Aggregator" };
const BUCKETS = [300, 400, 500, 600, 700, 800];

type SortKey = "score" | "pd" | "name" | "headroom";
const COLS: { key: SortKey | null; label: string; num?: boolean; cls?: string }[] = [
  { key: "name", label: "Applicant" },
  { key: "score", label: "Score", num: true },
  { key: null, label: "Decision", cls: "max-sm:hidden" },
  { key: "pd", label: "Default prob.", num: true, cls: "max-md:hidden" },
  { key: null, label: "Statement", cls: "max-md:hidden" },
  { key: "headroom", label: "EMI requested / affordable", num: true, cls: "max-lg:hidden" },
];

const reportHref = (id: string) => `/report?sample=${encodeURIComponent(id)}&from=lender`;

export function LenderConsole() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState("");
  const [decision, setDecision] = useState<"all" | Decision>("all");
  const [integrity, setIntegrity] = useState<"all" | Status>("all");
  const [persona, setPersona] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getPortfolio()
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const apps = useMemo(() => data?.applicants ?? [], [data]);

  const kpis = useMemo(() => {
    const n = apps.length || 1;
    return {
      total: apps.length,
      approval: apps.filter((a) => a.decision === "approve").length / n,
      review: apps.filter((a) => a.decision === "review").length,
      flagged: apps.filter((a) => a.integrity_status !== "pass").length,
      failed: apps.filter((a) => a.integrity_status === "fail").length,
      avgScore: apps.reduce((s, a) => s + a.score, 0) / n,
      avgPd: apps.reduce((s, a) => s + a.pd, 0) / n,
    };
  }, [apps]);

  const histogram = useMemo(
    () =>
      BUCKETS.map((b) => ({
        range: `${b}–${b + 99}`,
        applicants: apps.filter((a) => a.score >= b && (b === 800 ? a.score <= 900 : a.score < b + 100)).length,
      })),
    [apps],
  );

  const personas = useMemo(() => [...new Set(apps.map((a) => a.persona))].sort(), [apps]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = apps.filter(
      (a) =>
        (decision === "all" || a.decision === decision) &&
        (integrity === "all" || a.integrity_status === integrity) &&
        (persona === "all" || a.persona === persona) &&
        (!needle || a.name.toLowerCase().includes(needle) || a.id.toLowerCase().includes(needle)),
    );
    const val = (a: PortfolioApplicant): number | string => (sort.key === "name" ? a.name : sort.key === "headroom" ? a.max_emi - a.requested_emi : a[sort.key]);
    return list.sort((x, y) => {
      const a = val(x);
      const b = val(y);
      const c = typeof a === "string" ? a.localeCompare(b as string) : (a as number) - (b as number);
      return sort.desc ? -c : c;
    });
  }, [apps, q, decision, integrity, persona, sort]);

  const filtersOn = q || decision !== "all" || integrity !== "all" || persona !== "all";
  const selected = apps.find((a) => a.id === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);

  return (
    <div className="container-page">
      <PageHeader
        kicker="Lender console"
        title="Applicant portfolio"
        sub="Every applicant scored from bank statement cash flow, with statement authenticity checks."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setData(null);
                setAttempt((a) => a + 1);
              }}
            >
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
              </svg>
              Refresh
            </Button>
            <ButtonLink href="/model" variant="secondary">
              Model card
            </ButtonLink>
          </>
        }
      />

      {error ? (
        <ErrorState title="Couldn’t load the portfolio" message={error} action={<Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>} />
      ) : !data ? (
        <div className="space-y-[18px]" aria-busy="true" aria-label="Loading portfolio">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <>
          <StatStrip
            items={[
              { label: "Applicants", value: String(kpis.total), hint: `${kpis.review} need manual review` },
              { label: "Approval rate", value: pct(kpis.approval), hint: "Approved without review" },
              { label: "Flagged statements", value: String(kpis.flagged), hint: `${kpis.failed} failed authenticity checks` },
              { label: "Average score", value: Math.round(kpis.avgScore).toString(), hint: `Mean default probability ${pct(kpis.avgPd, 1)}` },
            ]}
          />

          <div className="mt-[18px] grid gap-[18px] lg:grid-cols-[1fr_360px]">
            <div className="card p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Score distribution</h2>
              <p className="mt-0.5 text-[13px] text-muted">Applicants per 100-point score range.</p>
              <div className="mt-5">
                <HistogramChart data={histogram} xKey="range" yKey="applicants" yLabel="Applicants" tickFormat={(v) => v.split("–")[0]} />
              </div>
            </div>
            <div className="card p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Decision mix</h2>
              <p className="mt-0.5 text-[13px] text-muted">Share of applicants by outcome.</p>
              <div className="mt-6 flex h-3 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
                {(["approve", "review", "decline"] as Decision[]).map((d) => {
                  const n = apps.filter((a) => a.decision === d).length;
                  return n ? <div key={d} className="first:rounded-l-full last:rounded-r-full" style={{ width: `${(n / Math.max(apps.length, 1)) * 100}%`, background: TONE_COLOR[decisionTone(d)] }} /> : null;
                })}
              </div>
              <div className="group-list mt-5">
                {(["approve", "review", "decline"] as Decision[]).map((d) => {
                  const n = apps.filter((a) => a.decision === d).length;
                  return (
                    <div key={d} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <StatusDot tone={decisionTone(d)}>{DECISION_LABEL[d]}</StatusDot>
                      <span className="tnum">
                        <span className="font-semibold text-fg">{n}</span>
                        <span className="ml-2 text-faint">{pct(n / Math.max(apps.length, 1))}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="group-title mt-5">Statement authenticity</p>
              <div className="flex flex-wrap gap-2">
                {(["pass", "warn", "fail"] as Status[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    data-on={integrity === s}
                    aria-pressed={integrity === s}
                    onClick={() => setIntegrity(integrity === s ? "all" : s)}
                  >
                    {STATUS_LABEL[s]}
                    <span className="n">{apps.filter((a) => a.integrity_status === s).length}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section aria-labelledby="applicants-title" className="mt-10">
            <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
              <h2 id="applicants-title" className="section-title mr-auto px-1">
                Applicants <span className="text-[15px] font-medium text-faint tnum">{rows.length}</span>
              </h2>
            </div>
            <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
              <SearchField value={q} onChange={setQ} placeholder="Search applicants" label="Search applicants" className="flex-[1_1_240px]" />
              <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} aria-label="Filter by decision" className="pill-select flex-[1_1_140px] sm:flex-none">
                <option value="all">All decisions</option>
                <option value="approve">Approved</option>
                <option value="review">Manual review</option>
                <option value="decline">Declined</option>
              </select>
              <select value={integrity} onChange={(e) => setIntegrity(e.target.value as typeof integrity)} aria-label="Filter by statement status" className="pill-select flex-[1_1_140px] sm:flex-none">
                <option value="all">All statements</option>
                <option value="pass">Verified</option>
                <option value="warn">Needs attention</option>
                <option value="fail">Failed</option>
              </select>
              <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Filter by profile" className="pill-select flex-[1_1_140px] sm:flex-none">
                <option value="all">All profiles</option>
                {personas.map((p) => (
                  <option key={p} value={p}>
                    {personaLabel(p)}
                  </option>
                ))}
              </select>
              {filtersOn && (
                <button
                  type="button"
                  className="link-btn px-1"
                  onClick={() => {
                    setQ("");
                    setDecision("all");
                    setIntegrity("all");
                    setPersona("all");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="max-h-[calc(100vh-140px)] overflow-auto">
                <table className="data-table hoverable text-sm">
                  <caption className="sr-only">Applicants. Select a row for a summary, or a name to open the full report.</caption>
                  <thead>
                    <tr>
                      {COLS.map((c) => {
                        const on = c.key != null && sort.key === c.key;
                        const arrow = <span className="sort-arrow">{on ? (sort.desc ? "↓" : "↑") : ""}</span>;
                        return (
                          <th
                            key={c.label}
                            scope="col"
                            aria-sort={on ? (sort.desc ? "descending" : "ascending") : undefined}
                            className={`${c.num ? "num" : ""} ${on ? "sorted" : ""} ${c.cls ?? ""}`}
                          >
                            {c.key ? (
                              <button
                                type="button"
                                className="inline-flex items-center font-semibold"
                                onClick={() => setSort({ key: c.key as SortKey, desc: on ? !sort.desc : c.key !== "name" })}
                              >
                                {c.num && arrow}
                                {c.label}
                                {!c.num && arrow}
                              </button>
                            ) : (
                              c.label
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const over = a.requested_emi > a.max_emi;
                      return (
                        <tr key={a.id} onClick={() => setOpenId(a.id)}>
                          <td>
                            <div className="row-name">
                              <Link href={reportHref(a.id)} onClick={(e) => e.stopPropagation()} className="hover:text-accent hover:underline">
                                {a.name}
                              </Link>
                              {a.tampered && <Badge tone="caution">Edited</Badge>}
                            </div>
                            <div className="row-sub">
                              {personaLabel(a.persona)}
                              {a.format && <> · {FORMAT_SHORT[a.format]}</>}
                              {a.loan_amount != null && <> · {inr(a.loan_amount)} loan</>}
                            </div>
                            <div className="mt-1 sm:hidden">
                              <StatusDot tone={decisionTone(a.decision)}>{DECISION_LABEL[a.decision]}</StatusDot>
                            </div>
                          </td>
                          <td className="num">
                            <span className="dot-after big-num" style={{ "--dot": TONE_COLOR[bandTone(a.band)] } as CSSProperties}>
                              {a.score}
                            </span>
                            <span className="sub-num">Band {a.band}</span>
                          </td>
                          <td className="max-sm:hidden">
                            <StatusDot tone={decisionTone(a.decision)}>{DECISION_LABEL[a.decision]}</StatusDot>
                          </td>
                          <td className="num text-fg-2 max-md:hidden">{pct(a.pd, 1)}</td>
                          <td className="max-md:hidden">
                            <StatusDot tone={statusTone(a.integrity_status)}>{STATUS_LABEL[a.integrity_status]}</StatusDot>
                          </td>
                          <td className="num whitespace-nowrap max-lg:hidden">
                            <span className={`big-num ${over ? "text-negative!" : ""}`}>{inr(a.requested_emi)}</span>
                            <span className="sub-num">of {inr(a.max_emi)} affordable</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="empty">No applicants match these filters.</p>}
              </div>
            </div>
            <p className="foot mt-4">
              {apps.length} applicants · Select a row for a summary, or a name to open the full report · Press / to search
            </p>
          </section>
        </>
      )}

      <Sheet open={!!selected} onClose={close} label={selected ? `${selected.name} summary` : "Applicant summary"}>
        {selected && <ApplicantSheet a={selected} />}
      </Sheet>
    </div>
  );
}

function ApplicantSheet({ a }: { a: PortfolioApplicant }) {
  const over = a.requested_emi > a.max_emi;
  const f = Math.max(0, Math.min(1, (a.score - 300) / 600));
  return (
    <>
      <p className="kicker">
        {personaLabel(a.persona)}
        {a.format && <> · {FORMAT_SHORT[a.format]}</>}
      </p>
      <h2 className="mt-0.5 pr-8 text-[28px] font-bold leading-tight tracking-[-0.03em] text-fg">{a.name}</h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-muted">
        <StatusDot tone={decisionTone(a.decision)}>{DECISION_LABEL[a.decision]}</StatusDot>
        <StatusDot tone={statusTone(a.integrity_status)}>Statement {STATUS_LABEL[a.integrity_status].toLowerCase()}</StatusDot>
        {a.tampered && <Badge tone="caution">Edited statement</Badge>}
      </div>

      <div className="headline mt-6">
        <p className="k">Credit score · Band {a.band}</p>
        <p className="big mt-1">
          {a.score}
          <small>out of 900</small>
        </p>
        <p className="range-line">Default probability {pct(a.pd, 1)}</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-fill">
          <div className="h-full rounded-full" style={{ width: `${f * 100}%`, background: TONE_COLOR[bandTone(a.band)] }} />
        </div>
      </div>

      <section className="mt-6">
        <h4 className="group-title">Affordability</h4>
        <dl className="kv">
          <dt>Loan requested</dt>
          <dd className="text-fg tnum">{a.loan_amount != null ? inr(a.loan_amount) : "—"}</dd>
          <dt>Requested EMI</dt>
          <dd className={`tnum ${over ? "font-semibold text-negative" : "text-fg"}`}>{inr(a.requested_emi)} a month</dd>
          <dt>Affordable EMI</dt>
          <dd className="text-fg tnum">{inr(a.max_emi)} a month</dd>
          <dt>Recommended amount</dt>
          <dd className="text-fg tnum">{a.recommended_amount != null ? inr(a.recommended_amount) : "—"}</dd>
        </dl>
        {over && <p className="note mt-3">The requested EMI is above what this applicant’s cash flow can comfortably support.</p>}
      </section>

      <section className="mt-6">
        <h4 className="group-title">Statement</h4>
        <dl className="kv">
          <dt>Authenticity</dt>
          <dd className="text-fg">{STATUS_LABEL[a.integrity_status]}</dd>
          <dt>Integrity score</dt>
          <dd className="text-fg tnum">{a.integrity_score != null ? `${a.integrity_score}/100` : "—"}</dd>
          <dt>Source</dt>
          <dd className="text-fg">{a.format ? FORMAT_SHORT[a.format] : "—"}</dd>
        </dl>
      </section>

      <div className="mt-8 flex flex-col gap-2.5">
        <ButtonLink href={reportHref(a.id)} size="lg" className="w-full rounded-xl!">
          Open full report
        </ButtonLink>
        <a href={`/api/samples/${encodeURIComponent(a.id)}/file`} download className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-fill-2 text-[15px] font-medium text-fg hover:bg-fill">
          Download statement
        </a>
      </div>
    </>
  );
}

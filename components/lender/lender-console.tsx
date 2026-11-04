"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HistogramChart } from "@/components/charts";
import { getPortfolio } from "@/lib/api";
import { bandTone, DECISION_LABEL, decisionTone, inr, pct, personaLabel, STATUS_LABEL, statusTone, TONE_HEX } from "@/lib/format";
import type { Decision, Portfolio, PortfolioApplicant, Status } from "@/lib/types";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";

const FORMAT_SHORT: Record<string, string> = { csv: "CSV", pdf: "PDF", aa_json: "Account Aggregator" };

type SortKey = "score" | "pd" | "name" | "headroom";

const BUCKETS = [300, 400, 500, 600, 700, 800];

export function LenderConsole() {
  const router = useRouter();
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState("");
  const [decision, setDecision] = useState<"all" | Decision>("all");
  const [integrity, setIntegrity] = useState<"all" | Status>("all");
  const [persona, setPersona] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });

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
    const val = (a: PortfolioApplicant): number | string =>
      sort.key === "name" ? a.name : sort.key === "headroom" ? a.max_emi - a.requested_emi : a[sort.key];
    return list.sort((x, y) => {
      const a = val(x);
      const b = val(y);
      const c = typeof a === "string" ? a.localeCompare(b as string) : (a as number) - (b as number);
      return sort.desc ? -c : c;
    });
  }, [apps, q, decision, integrity, persona, sort]);

  const open = (id: string) => router.push(`/report?sample=${encodeURIComponent(id)}&from=lender`);

  const control = "h-9 rounded-md border border-line-strong bg-white px-3 text-sm hover:border-zinc-300";

  return (
    <div className="container-page py-10 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-accent-600">Lender console</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em]">Applicant portfolio</h1>
          <p className="mt-1 text-[15px] text-zinc-600">Every applicant scored from bank statement cash flow, with statement authenticity checks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setData(null); setAttempt((a) => a + 1); }}>
            Refresh
          </Button>
          <Link href="/model" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-ink">
            Model card
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-8">
          <ErrorState title="Couldn’t load the portfolio" message={error} action={<Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>} />
        </div>
      ) : !data ? (
        <div className="mt-8 space-y-6" aria-busy="true" aria-label="Loading portfolio">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
            {[
              { k: "Applicants", v: String(kpis.total), h: `${kpis.review} need manual review` },
              { k: "Approval rate", v: pct(kpis.approval), h: "Approved without review" },
              { k: "Flagged statements", v: String(kpis.flagged), h: `${kpis.failed} failed authenticity checks` },
              { k: "Average score", v: Math.round(kpis.avgScore).toString(), h: `Mean default probability ${pct(kpis.avgPd, 1)}` },
            ].map((s) => (
              <div key={s.k} className="bg-white px-5 py-5">
                <dt className="text-[13px] text-zinc-500">{s.k}</dt>
                <dd className="mt-1 text-[26px] font-semibold tracking-[-0.025em] tnum">{s.v}</dd>
                <dd className="mt-0.5 text-[13px] text-zinc-500">{s.h}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold">Score distribution</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Applicants per 100-point score range.</p>
              <div className="mt-5">
                <HistogramChart data={histogram} xKey="range" yKey="applicants" yLabel="Applicants" tickFormat={(v) => v.split("–")[0]} />
              </div>
            </Card>
            <Card className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold">Decision mix</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Share of applicants by outcome.</p>
              <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                {(["approve", "review", "decline"] as Decision[]).map((d) => {
                  const n = apps.filter((a) => a.decision === d).length;
                  return <div key={d} style={{ width: `${(n / Math.max(apps.length, 1)) * 100}%`, background: TONE_HEX[decisionTone(d)] }} />;
                })}
              </div>
              <ul className="mt-5 divide-y divide-line">
                {(["approve", "review", "decline"] as Decision[]).map((d) => {
                  const n = apps.filter((a) => a.decision === d).length;
                  return (
                    <li key={d} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-2 text-zinc-700">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE_HEX[decisionTone(d)] }} aria-hidden="true" />
                        {DECISION_LABEL[d]}
                      </span>
                      <span className="tnum">
                        <span className="font-medium">{n}</span>
                        <span className="ml-2 text-zinc-500">{pct(n / Math.max(apps.length, 1))}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[13px] text-zinc-500">Statement authenticity</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["pass", "warn", "fail"] as Status[]).map((s) => (
                    <Badge key={s} tone={statusTone(s)} dot>
                      {STATUS_LABEL[s]} · {apps.filter((a) => a.integrity_status === s).length}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <section aria-labelledby="applicants-title" className="mt-10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 id="applicants-title" className="text-[17px] font-semibold tracking-[-0.01em]">
                Applicants <span className="ml-1 text-sm font-normal text-zinc-500 tnum">{rows.length}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name" aria-label="Search applicants" className={`${control} w-full sm:w-52`} />
                <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} aria-label="Filter by decision" className={control}>
                  <option value="all">All decisions</option>
                  <option value="approve">Approved</option>
                  <option value="review">Manual review</option>
                  <option value="decline">Declined</option>
                </select>
                <select value={integrity} onChange={(e) => setIntegrity(e.target.value as typeof integrity)} aria-label="Filter by statement status" className={control}>
                  <option value="all">All statements</option>
                  <option value="pass">Verified</option>
                  <option value="warn">Needs attention</option>
                  <option value="fail">Failed</option>
                </select>
                <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Filter by profile" className={control}>
                  <option value="all">All profiles</option>
                  {personas.map((p) => (
                    <option key={p} value={p}>
                      {personaLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <caption className="sr-only">Applicants. Select a name to open the full report.</caption>
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-[12px] text-zinc-500">
                      <SortTh label="Applicant" k="name" sort={sort} onSort={setSort} className="pl-5" />
                      <SortTh label="Score" k="score" sort={sort} onSort={setSort} />
                      <th scope="col" className="px-3 py-2.5 font-medium">Band</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Decision</th>
                      <SortTh label="Default prob." k="pd" sort={sort} onSort={setSort} align="right" />
                      <th scope="col" className="px-3 py-2.5 font-medium">Statement</th>
                      <SortTh label="EMI requested / affordable" k="headroom" sort={sort} onSort={setSort} align="right" className="pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((a) => {
                      const over = a.requested_emi > a.max_emi;
                      return (
                        <tr key={a.id} onClick={() => open(a.id)} className="cursor-pointer hover:bg-zinc-50">
                          <td className="py-3 pl-5 pr-3">
                            <Link
                              href={`/report?sample=${encodeURIComponent(a.id)}&from=lender`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-ink hover:text-accent-700"
                            >
                              {a.name}
                            </Link>
                            <p className="text-[13px] text-zinc-500">
                              {personaLabel(a.persona)}
                              {a.format && <> · {FORMAT_SHORT[a.format]}</>}
                              {a.loan_amount != null && <> · {inr(a.loan_amount)} loan</>}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 font-semibold tnum">{a.score}</span>
                              <div className="h-1 w-16 rounded-full bg-zinc-100" aria-hidden="true">
                                <div className="h-full rounded-full" style={{ width: `${((a.score - 300) / 600) * 100}%`, background: TONE_HEX[bandTone(a.band)] }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={bandTone(a.band)}>{a.band}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={decisionTone(a.decision)} dot>
                              {DECISION_LABEL[a.decision]}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-right tnum text-zinc-700">{pct(a.pd, 1)}</td>
                          <td className="px-3 py-3">
                            <Badge tone={statusTone(a.integrity_status)}>{STATUS_LABEL[a.integrity_status]}</Badge>
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right tnum">
                            <span className={over ? "font-medium text-negative" : "text-ink"}>{inr(a.requested_emi)}</span>
                            <span className="text-zinc-400"> / </span>
                            <span className="text-zinc-600">{inr(a.max_emi)}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                          No applicants match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (s: { key: SortKey; desc: boolean }) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => onSort({ key: k, desc: active ? !sort.desc : k !== "name" })}
        className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 ${active ? "opacity-100" : "opacity-30"}`} aria-hidden="true">
          <path d={active && !sort.desc ? "M2 6.5L5 3.5l3 3" : "M2 3.5L5 6.5l3-3"} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </th>
  );
}

"use client";

import { useMemo, useState } from "react";
import { flagLabel, fmtDate, inr, type Tone } from "@/lib/format";
import type { Txn } from "@/lib/types";
import { Badge, Button } from "@/components/ui";

const PAGE = 25;
const INCOME = new Set(["salary", "gig_income", "business_income", "agri_income", "family_transfer_in", "interest_in", "refund_cashback", "transfer_in_other"]);
const RISK = new Set(["loan_app", "betting_gaming", "bounce_charge"]);

function categoryTone(c: string): Tone {
  if (RISK.has(c)) return "negative";
  if (INCOME.has(c)) return "accent";
  return "neutral";
}

export function TransactionsTab({ transactions, flaggedCount }: { transactions: Txn[]; flaggedCount: number }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(0);

  const categories = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const t of transactions) {
      const e = m.get(t.category);
      if (e) e.n++;
      else m.set(t.category, { label: t.category_label, n: 1 });
    }
    return [...m.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [transactions]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (dir === "in" && !(t.credit > 0)) return false;
      if (dir === "out" && !(t.debit > 0)) return false;
      if (flaggedOnly && t.flags.length === 0) return false;
      if (needle && !t.narration.toLowerCase().includes(needle) && !t.category_label.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [transactions, q, cat, dir, flaggedOnly]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const p = Math.min(page, pages - 1);
  const rows = filtered.slice(p * PAGE, p * PAGE + PAGE);
  const reset = () => setPage(0);

  const control = "h-9 rounded-md border border-line-strong bg-white px-3 text-sm hover:border-zinc-300";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              reset();
            }}
            placeholder="Search description or category"
            aria-label="Search transactions"
            className={`${control} w-full pl-9`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              reset();
            }}
            aria-label="Filter by category"
            className={`${control} min-w-0 flex-1 sm:flex-none`}
          >
            <option value="all">All categories</option>
            {categories.map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} ({v.n})
              </option>
            ))}
          </select>
          <div role="group" aria-label="Direction" className="inline-flex rounded-md border border-line-strong p-0.5">
            {(
              [
                ["all", "All"],
                ["in", "Money in"],
                ["out", "Money out"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={dir === k}
                onClick={() => {
                  setDir(k);
                  reset();
                }}
                className={`h-8 rounded-[5px] px-3 text-[13px] ${dir === k ? "bg-zinc-100 font-medium text-ink" : "text-zinc-600 hover:text-ink"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong px-3 text-[13px] text-zinc-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-600">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => {
                setFlaggedOnly(e.target.checked);
                reset();
              }}
              className="h-3.5 w-3.5 accent-[#3350d6]"
            />
            Flagged only <span className="text-zinc-400 tnum">({flaggedCount})</span>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <caption className="sr-only">Transactions</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-[12px] text-zinc-500">
                <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Description</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Confidence</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((t, i) => {
                const flagged = t.flags.length > 0;
                const amount = t.credit > 0 ? t.credit : -t.debit;
                return (
                  <tr key={`${p}-${i}-${t.date}`} className={flagged ? "bg-caution-bg/60" : "hover:bg-zinc-50/70"}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600 tnum">{fmtDate(t.date)}</td>
                    <td className="max-w-[340px] px-3 py-2.5">
                      <p className="truncate font-mono text-[12.5px] text-zinc-800" title={t.narration}>
                        {t.narration}
                      </p>
                      {flagged && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.flags.map((f) => (
                            <Badge key={f} tone="caution" className="text-[11px]!">
                              {flagLabel(f)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={categoryTone(t.category)}>{t.category_label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2" title={t.confidence < 0.6 ? "Low confidence" : undefined}>
                        <div className="h-1 w-12 rounded-full bg-zinc-100" aria-hidden="true">
                          <div className={`h-full rounded-full ${t.confidence < 0.6 ? "bg-caution" : "bg-zinc-400"}`} style={{ width: `${t.confidence * 100}%` }} />
                        </div>
                        <span className={`text-[12px] tnum ${t.confidence < 0.6 ? "text-caution" : "text-zinc-500"}`}>{Math.round(t.confidence * 100)}%</span>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-medium tnum ${amount > 0 ? "text-positive" : "text-ink"}`}>
                      {amount > 0 ? "+" : "−"}
                      {inr(Math.abs(amount)).replace("-", "")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-zinc-600 tnum">{t.balance != null ? inr(t.balance) : "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No transactions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line bg-canvas px-4 py-2.5 text-[13px] text-zinc-600">
          <span className="tnum" aria-live="polite">
            {filtered.length === 0 ? "0 results" : `${p * PAGE + 1}–${Math.min(filtered.length, (p + 1) * PAGE)} of ${filtered.length.toLocaleString("en-IN")}`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={p === 0} onClick={() => setPage(p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

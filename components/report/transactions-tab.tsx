"use client";

import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import { flagLabel, fmtDate, inr, type Tone } from "@/lib/format";
import type { Txn } from "@/lib/types";
import { Badge, SearchField, Segmented, Switch } from "@/components/ui";

const INCOME = new Set(["salary", "gig_income", "business_income", "agri_income", "family_transfer_in", "interest_in", "refund_cashback", "transfer_in_other"]);
const RISK = new Set(["loan_app", "betting_gaming", "bounce_charge"]);

function categoryTone(c: string): Tone {
  if (RISK.has(c)) return "negative";
  if (INCOME.has(c)) return "accent";
  return "neutral";
}

type Dir = "all" | "in" | "out";

export function TransactionsTab({ transactions, flaggedCount }: { transactions: Txn[]; flaggedCount: number }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [dir, setDir] = useState<Dir>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const query = useDeferredValue(q);

  const categories = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const t of transactions) {
      const e = m.get(t.category);
      if (e) e.n++;
      else m.set(t.category, { label: t.category_label, n: 1 });
    }
    return [...m.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [transactions]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (dir === "in" && !(t.credit > 0)) return false;
      if (dir === "out" && !(t.debit > 0)) return false;
      if (flaggedOnly && t.flags.length === 0) return false;
      if (needle && !t.narration.toLowerCase().includes(needle) && !t.category_label.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [transactions, query, cat, dir, flaggedOnly]);

  const filtersOn = q || cat !== "all" || dir !== "all" || flaggedOnly;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={q} onChange={setQ} placeholder="Search description or category" label="Search transactions" className="min-w-0 flex-[1_1_280px]" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category" className="pill-select flex-[1_1_160px] sm:flex-none">
          <option value="all">All categories</option>
          {categories.map(([k, v]) => (
            <option key={k} value={k}>
              {v.label} ({v.n})
            </option>
          ))}
        </select>
        <Segmented<Dir>
          label="Direction"
          value={dir}
          onChange={setDir}
          options={[
            { value: "all", label: "All" },
            { value: "in", label: "In" },
            { value: "out", label: "Out" },
          ]}
        />
        <Switch checked={flaggedOnly} onChange={setFlaggedOnly}>
          Flagged only <span className="font-normal text-faint tnum">{flaggedCount}</span>
        </Switch>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[calc(100vh-180px)] overflow-auto">
          <table className="data-table min-w-[860px] text-sm">
            <caption className="sr-only">Transactions</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Category</th>
                <th scope="col" className="num">Confidence</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col" className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const flagged = t.flags.length > 0;
                const amount = t.credit > 0 ? t.credit : -t.debit;
                const low = t.confidence < 0.6;
                return (
                  <tr key={`${i}-${t.date}-${t.narration}`} className={flagged ? "[&>td]:bg-caution/8" : ""}>
                    <td className="whitespace-nowrap text-muted">{fmtDate(t.date)}</td>
                    <td className="max-w-[340px]">
                      <p className="truncate font-mono text-[12.5px] text-fg" title={t.narration}>
                        {t.narration}
                      </p>
                      {flagged && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.flags.map((f) => (
                            <Badge key={f} tone="caution">
                              {flagLabel(f)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone={categoryTone(t.category)}>{t.category_label}</Badge>
                    </td>
                    <td className="num">
                      <span
                        className="dot-after text-[13px] text-muted"
                        style={{ "--dot": low ? "var(--yellow)" : t.confidence < 0.85 ? "var(--accent)" : "var(--green)" } as CSSProperties}
                        title={low ? "Low confidence" : undefined}
                      >
                        {Math.round(t.confidence * 100)}%
                      </span>
                    </td>
                    <td className={`num whitespace-nowrap font-semibold ${amount > 0 ? "text-positive" : "text-fg"}`}>
                      {amount > 0 ? "+" : "−"}
                      {inr(Math.abs(amount))}
                    </td>
                    <td className="num whitespace-nowrap text-muted">{t.balance != null ? inr(t.balance) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="empty">No transactions match these filters.</p>}
        </div>
      </div>
      <p className="foot flex items-center justify-center gap-3" aria-live="polite">
        <span className="tnum">
          {rows.length.toLocaleString("en-IN")} of {transactions.length.toLocaleString("en-IN")} transactions
        </span>
        {filtersOn && (
          <button
            type="button"
            className="link-btn text-[12px]!"
            onClick={() => {
              setQ("");
              setCat("all");
              setDir("all");
              setFlaggedOnly(false);
            }}
          >
            Reset filters
          </button>
        )}
      </p>
    </div>
  );
}

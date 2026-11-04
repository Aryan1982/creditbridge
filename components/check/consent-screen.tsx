"use client";

import { useMemo, useState } from "react";
import type { Sample } from "@/lib/types";
import { Button, ErrorState, Skeleton } from "@/components/ui";

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function maskedNumber(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(1000 + (h % 9000));
}

export function ConsentScreen({
  samples,
  samplesError,
  approved,
  onApprove,
  onRevoke,
}: {
  samples: Sample[] | null;
  samplesError: string | null;
  approved: { sampleId: string } | null;
  onApprove: (s: Sample) => void;
  onRevoke: () => void;
}) {
  const accounts = useMemo(() => (samples ?? []).filter((s) => s.format === "aa_json"), [samples]);
  const [selected, setSelected] = useState<string | null>(approved?.sampleId ?? null);
  const [rejected, setRejected] = useState(false);
  const chosen = accounts.find((a) => a.id === (selected ?? accounts[0]?.id)) ?? null;

  const { from, to, expiry } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
    const exp = new Date(now.getTime() + 24 * 3600 * 1000);
    return { from: fmt.format(start), to: fmt.format(now), expiry: fmt.format(exp) };
  }, []);

  if (samplesError) return <ErrorState title="Couldn’t reach the Account Aggregator" message={samplesError} />;
  if (!samples) return <Skeleton className="h-[520px]" />;
  if (accounts.length === 0)
    return <ErrorState title="No linked accounts found" message="No accounts are available to share through the Account Aggregator right now. Upload a statement instead." />;

  if (rejected)
    return (
      <div className="rounded-xl border border-line p-6 text-center">
        <p className="text-sm font-medium">Consent declined</p>
        <p className="mt-1 text-sm text-zinc-600">Nothing was shared. You can review the request again or choose another method.</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setRejected(false);
            onRevoke();
          }}
        >
          Review request again
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-line shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-white">AA</span>
          <div>
            <p className="text-[13px] font-medium leading-tight">Account Aggregator</p>
            <p className="text-xs leading-tight text-zinc-500">RBI-regulated consent manager</p>
          </div>
        </div>
        <span className="hidden text-xs text-zinc-500 sm:inline">Consent request</span>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <p className="text-[15px] leading-snug">
          <span className="font-semibold">CreditBridge Lending Services</span> is requesting access to your bank account information.
        </p>
        <p className="mt-1 text-[13px] text-zinc-500">Financial Information User (FIU)</p>

        <dl className="mt-5 divide-y divide-line rounded-lg border border-line text-sm">
          {[
            ["Purpose", "Assess your loan application"],
            ["Information", "Account profile, balances and transactions"],
            ["Data range", `${from} – ${to}`],
            ["Frequency", "One-time fetch"],
            ["Consent expires", expiry],
            ["Data use", "Deleted after your decision is made"],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[140px_1fr]">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <fieldset className="mt-5">
          <legend className="text-[13px] font-medium text-zinc-700">Select account to share</legend>
          <div className="mt-2 space-y-2">
            {accounts.map((a) => {
              const isSel = chosen?.id === a.id;
              return (
                <label
                  key={a.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-600 ${
                    isSel ? "border-accent-600 bg-accent-50/40" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input type="radio" name="aa-account" className="sr-only" checked={isSel} onChange={() => setSelected(a.id)} />
                  <span
                    className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${isSel ? "border-accent-600 bg-accent-600" : "border-line-strong"}`}
                    aria-hidden="true"
                  >
                    {isSel && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Savings account <span className="tnum text-zinc-500">•••• {maskedNumber(a.id)}</span>
                    </span>
                    <span className="block truncate text-[13px] text-zinc-500">{a.name}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-5 text-xs leading-relaxed text-zinc-500">
          Demo environment: there is no live Account Aggregator connection, so approving shares a sample account in the
          standard AA data format.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="secondary" size="lg" onClick={() => setRejected(true)}>
          Reject
        </Button>
        <Button size="lg" disabled={!chosen} onClick={() => chosen && onApprove(chosen)}>
          Approve and share
        </Button>
      </div>
    </div>
  );
}

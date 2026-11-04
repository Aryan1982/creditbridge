"use client";

import { useMemo, useState } from "react";
import type { Sample } from "@/lib/types";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { SelectedCheck } from "./connect-step";

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
  if (!samples) return <Skeleton className="mx-auto h-[560px] max-w-[560px]" />;
  if (accounts.length === 0)
    return <ErrorState title="No linked accounts found" message="No accounts are available to share through the Account Aggregator right now. Upload a statement instead." />;

  if (rejected)
    return (
      <div className="card mx-auto max-w-[560px] p-8 text-center">
        <p className="text-[17px] font-semibold text-fg">Consent declined</p>
        <p className="mt-1 text-sm text-muted">Nothing was shared. You can review the request again or choose another method.</p>
        <Button
          variant="tinted"
          className="mt-5"
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
    <div className="card mx-auto max-w-[560px] overflow-hidden shadow-sheet!">
      <div className="px-5 pb-6 pt-7 text-center sm:px-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px] bg-fg text-[15px] font-bold tracking-[-0.02em] text-panel">AA</span>
        <p className="kicker mt-4">Account Aggregator · RBI-regulated consent manager</p>
        <h3 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.025em] text-fg">
          CreditBridge Lending Services wants to view your bank account
        </h3>
        <p className="mt-1.5 text-[13px] text-muted">Financial Information User (FIU)</p>
      </div>

      <div className="space-y-6 px-4 pb-6 sm:px-6">
        <section>
          <h4 className="group-title px-1">Request details</h4>
          <dl className="kv">
            {[
              ["Purpose", "Assess your loan application"],
              ["Information", "Account profile, balances and transactions"],
              ["Data range", `${from} – ${to}`],
              ["Frequency", "One-time fetch"],
              ["Consent expires", expiry],
              ["Data use", "Deleted after your decision is made"],
            ].map(([k, v]) => [<dt key={`${k}-k`}>{k}</dt>, <dd key={`${k}-v`} className="text-fg">{v}</dd>])}
          </dl>
        </section>

        <fieldset>
          <legend className="group-title px-1">Account to share</legend>
          <div className="group-list">
            {accounts.map((a) => {
              const isSel = chosen?.id === a.id;
              return (
                <label key={a.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-fill-2 has-[:focus-visible]:bg-accent-soft">
                  <input type="radio" name="aa-account" className="sr-only" checked={isSel} onChange={() => setSelected(a.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-fg">
                      Savings account <span className="text-muted tnum">•••• {maskedNumber(a.id)}</span>
                    </span>
                    <span className="block truncate text-[13px] text-muted">{a.name}</span>
                  </span>
                  <SelectedCheck on={isSel} />
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="note">
          Demo environment: there is no live Account Aggregator connection, so approving shares a sample account in the standard AA data format.
        </p>

        <div className="flex flex-col gap-2.5 pt-1">
          <Button size="lg" className="w-full rounded-xl!" disabled={!chosen} onClick={() => chosen && onApprove(chosen)}>
            Approve and share
          </Button>
          <Button variant="tinted" size="lg" className="w-full rounded-xl!" onClick={() => setRejected(true)}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

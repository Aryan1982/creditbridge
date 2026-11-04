import { fmtDate, inr, STATUS_LABEL, statusTone } from "@/lib/format";
import type { Integrity } from "@/lib/types";
import { Badge, StatusIcon } from "@/components/ui";

const SUMMARY: Record<Integrity["status"], string> = {
  pass: "This statement passed every authenticity check. Balances reconcile and nothing suggests it was edited.",
  warn: "Most checks passed, but a few items need a closer look. They are listed below with the exact transactions involved.",
  fail: "This statement failed one or more authenticity checks. A lender will ask for an original statement or an Account Aggregator share.",
};

export function IntegrityTab({ integrity }: { integrity: Integrity }) {
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  const checks = [...integrity.checks].sort((a, b) => order[a.status] - order[b.status]);
  const passed = integrity.checks.filter((c) => c.status === "pass").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-xl border border-line p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <StatusIcon status={integrity.status} className="h-10! w-10!" />
          <div>
            <p className="text-[15px] font-semibold">{STATUS_LABEL[integrity.status]}</p>
            <p className="text-[13px] text-zinc-500 tnum">
              {passed} of {integrity.checks.length} checks passed · score {integrity.score}/100
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-zinc-600 sm:ml-auto sm:max-w-[56ch]">{SUMMARY[integrity.status]}</p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {checks.map((c) => (
          <li key={c.id} className="px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <StatusIcon status={c.status} className="mt-0.5 flex-none" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{c.label}</p>
                  <Badge tone={statusTone(c.status)}>{c.status === "pass" ? "Passed" : c.status === "warn" ? "Warning" : "Failed"}</Badge>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{c.detail}</p>
                {c.evidence.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                    <table className="w-full min-w-[520px] text-[13px]">
                      <caption className="sr-only">Evidence for {c.label}</caption>
                      <thead>
                        <tr className="border-b border-line bg-canvas text-left text-[12px] text-zinc-500">
                          <th scope="col" className="px-3 py-2 font-medium">Date</th>
                          <th scope="col" className="px-3 py-2 font-medium">Transaction</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {c.evidence.map((e, i) => (
                          <tr key={i} className={c.status === "fail" ? "bg-negative-bg/70" : c.status === "warn" ? "bg-caution-bg" : ""}>
                            <td className="whitespace-nowrap px-3 py-2 text-zinc-600 tnum">{fmtDate(e.date)}</td>
                            <td className="px-3 py-2">
                              <p className="font-mono text-[12px] text-zinc-800">{e.narration}</p>
                              {e.note && <p className="mt-0.5 text-[12px] text-zinc-600">{e.note}</p>}
                            </td>
                            <td className={`whitespace-nowrap px-3 py-2 text-right font-medium tnum ${e.amount > 0 ? "text-positive" : ""}`}>
                              {e.amount === 0 ? "—" : `${e.amount > 0 ? "+" : "−"}${inr(Math.abs(e.amount))}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { fmtDate, inr, statusTone } from "@/lib/format";
import type { Integrity } from "@/lib/types";
import { Badge, StatusIcon } from "@/components/ui";

const TITLE: Record<Integrity["status"], string> = {
  pass: "Statement verified",
  warn: "Needs a closer look",
  fail: "Authenticity checks failed",
};

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
    <div className="space-y-[18px]">
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <StatusIcon status={integrity.status} className="h-12! w-12!" />
          <div>
            <p className="text-[21px] font-bold tracking-[-0.02em] text-fg">{TITLE[integrity.status]}</p>
            <p className="text-[13px] text-muted tnum">
              {passed} of {integrity.checks.length} checks passed · score {integrity.score}/100
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted sm:ml-auto sm:max-w-[52ch]">{SUMMARY[integrity.status]}</p>
      </div>

      <ul className="card divide-y divide-sep overflow-hidden">
        {checks.map((c) => (
          <li key={c.id} className="px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <StatusIcon status={c.status} className="mt-0.5 h-[18px]! w-[18px]!" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{c.label}</p>
                  <Badge tone={statusTone(c.status)}>{c.status === "pass" ? "Passed" : c.status === "warn" ? "Warning" : "Failed"}</Badge>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{c.detail}</p>
                {c.evidence.length > 0 && (
                  <div className={`mt-3 overflow-x-auto rounded-[14px] ${c.status === "fail" ? "bg-negative/8" : c.status === "warn" ? "bg-caution/8" : "bg-fill-2"}`}>
                    <table className="mini min-w-[520px]">
                      <caption className="sr-only">Evidence for {c.label}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col" className="text-left!">
                            Transaction
                          </th>
                          <th scope="col">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.evidence.map((e, i) => (
                          <tr key={i}>
                            <td className="whitespace-nowrap text-muted">{fmtDate(e.date)}</td>
                            <td className="text-left!">
                              <p className="font-mono text-[12px] text-fg">{e.narration}</p>
                              {e.note && <p className="mt-0.5 text-[12px] text-muted">{e.note}</p>}
                            </td>
                            <td className={`whitespace-nowrap font-semibold ${e.amount > 0 ? "text-positive" : "text-fg"}`}>
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

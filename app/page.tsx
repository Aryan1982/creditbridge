import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";

const STEPS = [
  {
    title: "Connect a statement",
    body: "Upload a bank statement as PDF or CSV, or share it in one tap through the RBI Account Aggregator network.",
  },
  {
    title: "Verify it is genuine",
    body: "Running balances, transaction references and document metadata are checked for edits, and circular transfers that inflate income are flagged.",
  },
  {
    title: "Read the cash flow",
    body: "Every transaction is categorised. Income regularity, spending, existing EMIs, bounces and balance buffers are measured month by month.",
  },
  {
    title: "Decide and explain",
    body: "A 300–900 score, an affordable EMI and the reasons behind the decision, with concrete steps to qualify for more.",
  },
];

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 flex-none text-accent-600" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviewCard() {
  const bars = [62, 70, 58, 74, 66, 79, 71, 83, 77];
  return (
    <figure className="relative rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.12)] sm:p-6">
      <figcaption className="sr-only">Example of a CreditBridge report</figcaption>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-zinc-500">Ravi K. · Delivery partner</p>
          <p className="mt-0.5 text-[13px] text-zinc-500">9 months · 412 transactions</p>
        </div>
        <Badge tone="positive" dot>
          Approved
        </Badge>
      </div>
      <div className="mt-6 flex items-end gap-3">
        <span className="text-5xl font-semibold tracking-[-0.03em] tnum">712</span>
        <span className="mb-1.5 text-sm text-zinc-500">Band B · out of 900</span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-accent-600" style={{ width: "68%" }} />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
        <div>
          <p className="text-zinc-500">Affordable EMI</p>
          <p className="mt-0.5 font-semibold tnum">₹6,800/mo</p>
        </div>
        <div>
          <p className="text-zinc-500">Statement</p>
          <p className="mt-0.5 font-semibold">Verified</p>
        </div>
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <p className="text-[13px] text-zinc-500">Monthly income</p>
        <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden="true">
          {bars.map((h, i) => (
            <div key={i} className={`flex-1 rounded-[3px] ${i === bars.length - 1 ? "bg-accent-600" : "bg-accent-200"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
        <li className="flex justify-between gap-4">
          <span className="text-zinc-700">Income arrived in 9 of 9 months</span>
          <span className="text-positive">Helps</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-zinc-700">Existing EMI paid on time</span>
          <span className="text-positive">Helps</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-zinc-700">Balance under ₹1,500 in 4 months</span>
          <span className="text-negative">Hurts</span>
        </li>
      </ul>
    </figure>
  );
}

export default function Home() {
  return (
    <>
      <section className="border-b border-line">
        <div className="container-page grid gap-12 py-16 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-[13px] font-medium text-accent-600">Cash-flow underwriting for India</p>
            <h1 className="mt-4 max-w-[17ch] text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[56px]">
              Credit for people the bureau can’t see.
            </h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-zinc-600">
              About 190 million Indian adults have no credit score, yet most of them have a bank account that already shows
              steady income, rent paid on time and money set aside. CreditBridge turns that history into a verified,
              explainable lending decision.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/check" size="lg">
                Check your eligibility
              </ButtonLink>
              <ButtonLink href="/lender" size="lg" variant="secondary">
                Open lender console
              </ButtonLink>
            </div>
            <p className="mt-5 text-[13px] text-zinc-500">No credit history needed. Your statement is analysed in memory and never stored.</p>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <PreviewCard />
          </div>
        </div>
      </section>

      <section aria-labelledby="problem" className="border-b border-line bg-canvas">
        <div className="container-page py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 id="problem" className="text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]">
                No score is not the same as no record.
              </h2>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-zinc-600">
                Gig workers, farmers, shopkeepers and first-time earners are turned away or pushed to instant-loan apps because
                lenders rely on bureau history they don’t have. Their bank statements tell a fuller story.
              </p>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
              {[
                { k: "190M", v: "Indian adults without a usable credit history" },
                { k: "6–12 mo", v: "of transactions is enough to read income, obligations and buffers" },
                { k: "0", v: "bureau records needed to reach a decision" },
              ].map((s) => (
                <div key={s.k} className="bg-white p-6">
                  <dt className="text-[28px] font-semibold tracking-[-0.03em] tnum">{s.k}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-zinc-600">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="border-b border-line">
        <div className="container-page py-16 md:py-24">
          <p className="text-[13px] font-medium text-accent-600">How it works</p>
          <h2 id="how" className="mt-3 max-w-[24ch] text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]">
            From statement to decision in four steps.
          </h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="bg-white p-6">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-[13px] font-medium text-zinc-700 tnum">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="who" className="border-b border-line bg-canvas">
        <div className="container-page py-16 md:py-24">
          <p className="text-[13px] font-medium text-accent-600">Who it’s for</p>
          <h2 id="who" className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]">
            Built for both sides of the loan.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <article className="flex flex-col rounded-xl border border-line bg-white p-6 sm:p-8">
              <h3 className="text-lg font-semibold">Borrowers</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
                See whether you qualify before you apply, how much you can comfortably repay, and exactly what would raise your score.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-700">
                <li className="flex gap-3"><Check />A clear decision with the reasons behind it</li>
                <li className="flex gap-3"><Check />An EMI sized to your real income</li>
                <li className="flex gap-3"><Check />Results in English, हिंदी and తెలుగు</li>
              </ul>
              <div className="mt-8 pt-2">
                <Link href="/check" className="text-sm font-medium text-accent-600 hover:text-accent-700">
                  Check your eligibility →
                </Link>
              </div>
            </article>
            <article className="flex flex-col rounded-xl border border-line bg-white p-6 sm:p-8">
              <h3 className="text-lg font-semibold">NBFCs and microfinance lenders</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
                Underwrite thin-file applicants with verified cash-flow evidence, catch edited statements, and document every decision.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-700">
                <li className="flex gap-3"><Check />Portfolio view with integrity status per applicant</li>
                <li className="flex gap-3"><Check />Reason codes for every approve, review or decline</li>
                <li className="flex gap-3"><Check />Published model performance and fairness checks</li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 pt-2">
                <Link href="/lender" className="text-sm font-medium text-accent-600 hover:text-accent-700">
                  Open lender console →
                </Link>
                <Link href="/model" className="text-sm font-medium text-zinc-600 hover:text-ink">
                  Read the model card →
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section>
        <div className="container-page flex flex-col items-start justify-between gap-6 py-16 md:flex-row md:items-center md:py-20">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.02em]">See what your statement says about you.</h2>
            <p className="mt-2 text-[15px] text-zinc-600">Use your own statement, or try a sample profile.</p>
          </div>
          <ButtonLink href="/check" size="lg">
            Start a check
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

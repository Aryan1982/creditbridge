import { AppIcon } from "@/components/logo";
import { ButtonLink, ChevronLink, StatStrip } from "@/components/ui";

const STEPS = [
  {
    title: "Connect a statement",
    body: "Upload a bank statement as PDF or CSV, or share it in one tap through the RBI Account Aggregator network.",
    icon: "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20zM14 3.5v4h4M12 17v-6m-2.5 2.5L12 11l2.5 2.5",
  },
  {
    title: "Verify it’s genuine",
    body: "Running balances, references and document metadata are checked for edits. Circular transfers that inflate income are flagged.",
    icon: "M12 3l7 3v5.5c0 4.2-3 7.8-7 9-4-1.2-7-4.8-7-9V6zM9 12l2 2 4-4.5",
  },
  {
    title: "Read the cash flow",
    body: "Every transaction is categorised. Income regularity, spending, existing EMIs, bounces and buffers are measured month by month.",
    icon: "M4 20V10m5.3 10V4m5.4 16v-7M20 20V7",
  },
  {
    title: "Decide and explain",
    body: "A 300–900 score, an affordable EMI and the reasons behind it, with concrete steps to qualify for more.",
    icon: "M5 12.5l4 4L19 6.5",
  },
];

function Tick() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-[3px] h-4 w-4 flex-none text-accent"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="8" fill="currentColor" opacity=".14" />
      <path
        d="M4.8 8.3l2.1 2.1 4.3-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DEMO_VIDEO_ID = "gH8jdtwzNqw";

export default function Home() {
  return (
    <>
      <section className="container-page pb-16 pt-16 text-center md:pb-24 md:pt-24">
        <div className="mx-auto flex w-fit items-center gap-2.5">
          <AppIcon size={28} />
          <span className="text-[19px] font-semibold tracking-[-0.02em] text-fg">
            CreditBridge
          </span>
        </div>
        <h1 className="mx-auto mt-5 text-balance max-w-[15ch] text-[44px] font-bold leading-[1.05] tracking-[-0.04em] text-fg sm:text-[64px] lg:text-[72px]">
          Credit for people the bureau can’t see.
        </h1>
        <p className="mx-auto mt-6 max-w-[40ch] text-[19px] leading-snug text-muted sm:text-[21px]">
          Your bank statement already proves you pay on time. CreditBridge turns
          it into a verified, explainable credit decision.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-7">
          <ButtonLink href="/check" size="lg">
            Check your eligibility
          </ButtonLink>
          <ChevronLink href="/lender" className="text-[17px]">
            Open the lender console
          </ChevronLink>
        </div>
        <p className="mt-6 text-[13px] text-faint">
          No credit history needed · Statements are analysed in memory and never
          stored
        </p>
        <div className="mt-14 md:mt-20">
          <figure className="card mx-auto w-full max-w-[960px] overflow-hidden text-left shadow-sheet!">
            <div className="flex items-center gap-2 border-b border-sep px-4 py-3">
              <span
                className="h-3 w-3 rounded-full bg-[#ff5f57]"
                aria-hidden="true"
              />
              <span
                className="h-3 w-3 rounded-full bg-[#febc2e]"
                aria-hidden="true"
              />
              <span
                className="h-3 w-3 rounded-full bg-[#28c840]"
                aria-hidden="true"
              />
              <figcaption className="ml-3 truncate text-[12px] text-faint">
                Product demo · 2 min
              </figcaption>
              <a
                href={`https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex-none text-[12px] font-medium text-accent hover:underline"
              >
                Watch on YouTube
              </a>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0&modestbranding=1`}
                title="CreditBridge product demo"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </figure>
        </div>
      </section>

      <section
        aria-labelledby="problem"
        className="container-page py-16 md:py-24"
      >
        <div className="mx-auto max-w-[720px] text-center">
          <h2
            id="problem"
            className="text-balance text-[34px] font-bold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[48px]"
          >
            No score isn’t the same as no record.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted sm:text-[19px]">
            Gig workers, farmers, shopkeepers and first-time earners are turned
            away or pushed to instant-loan apps because lenders rely on bureau
            history they don’t have. Their bank statements tell a fuller story.
          </p>
        </div>
        <StatStrip
          className="mx-auto mt-12 max-w-[960px]"
          items={[
            {
              label: "Credit-invisible adults in India",
              value: "190M",
              hint: "No usable bureau history",
            },
            {
              label: "History needed",
              value: "6–12 months",
              hint: "Of bank or UPI transactions",
            },
            {
              label: "Bureau records required",
              value: "None",
              hint: "Decisions come from cash flow",
            },
          ]}
        />
      </section>

      <section aria-labelledby="how" className="container-page py-16 md:py-24">
        <div className="text-center">
          <p className="text-[17px] font-semibold text-accent">How it works</p>
          <h2
            id="how"
            className="text-balance mx-auto mt-2 max-w-[20ch] text-[34px] font-bold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[48px]"
          >
            From statement to decision in four steps.
          </h2>
        </div>
        <ol className="mt-12 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex flex-col p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={s.icon} />
                </svg>
              </span>
              <p className="mt-6 text-[13px] font-medium text-faint tnum">
                Step {i + 1}
              </p>
              <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-fg">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="who" className="container-page py-16 md:py-24">
        <div className="text-center">
          <p className="text-[17px] font-semibold text-accent">Who it’s for</p>
          <h2
            id="who"
            className="mt-2 text-[34px] font-bold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[48px]"
          >
            Built for both sides of the loan.
          </h2>
        </div>
        <div className="mt-12 grid gap-[18px] md:grid-cols-2">
          <article className="card flex flex-col p-8 sm:p-10">
            <p className="kicker">Borrowers</p>
            <h3 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-fg">
              Know before you apply.
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              See whether you qualify, how much you can comfortably repay, and
              exactly what would raise your score.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-fg-2">
              <li className="flex gap-3">
                <Tick />A clear decision with the reasons behind it
              </li>
              <li className="flex gap-3">
                <Tick />
                An EMI sized to your real income
              </li>
              <li className="flex gap-3">
                <Tick />
                Results in English, हिंदी and తెలుగు
              </li>
            </ul>
            <div className="mt-auto pt-9">
              <ChevronLink href="/check" className="text-[17px]">
                Check your eligibility
              </ChevronLink>
            </div>
          </article>
          <article className="card flex flex-col p-8 sm:p-10">
            <p className="kicker">NBFCs and microfinance lenders</p>
            <h3 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-fg">
              Underwrite thin files with evidence.
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Score applicants from verified cash flow, catch edited statements,
              and document every decision.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-fg-2">
              <li className="flex gap-3">
                <Tick />
                Portfolio view with statement checks per applicant
              </li>
              <li className="flex gap-3">
                <Tick />
                Reason codes for every approve, review or decline
              </li>
              <li className="flex gap-3">
                <Tick />
                Published model performance and fairness checks
              </li>
            </ul>
            <div className="mt-auto flex flex-wrap gap-x-7 gap-y-2 pt-9">
              <ChevronLink href="/lender" className="text-[17px]">
                Open lender console
              </ChevronLink>
              <ChevronLink href="/model" className="text-[17px]">
                Read the model card
              </ChevronLink>
            </div>
          </article>
        </div>
      </section>

      <section className="container-page py-16 text-center md:py-24">
        <h2 className="text-[34px] font-bold tracking-[-0.035em] text-fg sm:text-[40px]">
          See what your statement says about you.
        </h2>
        <p className="mt-3 text-[17px] text-muted">
          Use your own statement, or try a sample profile.
        </p>
        <ButtonLink href="/check" size="lg" className="mt-8">
          Start a check
        </ButtonLink>
      </section>
    </>
  );
}

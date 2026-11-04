const STEPS = ["Connect data", "Loan details", "Analysis"];

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-medium tnum ${
                  state === "done"
                    ? "bg-accent-600 text-white"
                    : state === "current"
                      ? "border border-accent-600 text-accent-700"
                      : "border border-line-strong text-zinc-500"
                }`}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                    <path d="M2.5 6.2l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
                <span className="sr-only">{state === "done" ? " (completed)" : ""}</span>
              </span>
              <span className={`text-sm ${state === "current" ? "font-medium text-ink" : "hidden text-zinc-500 sm:inline"}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-line-strong sm:w-10" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

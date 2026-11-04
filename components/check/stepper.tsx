const STEPS = ["Connect", "Loan", "Analysis"];

/** Read-only progress indicator styled as a segmented control. */
export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progress">
      <ol className="seg">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li
              key={label}
              data-on={state === "current"}
              aria-current={state === "current" ? "step" : undefined}
              className={`seg-item inline-flex items-center gap-1.5 ${state === "upcoming" ? "text-faint!" : ""}`}
            >
              {state === "done" ? (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-positive" aria-hidden="true">
                  <circle cx="8" cy="8" r="8" fill="currentColor" />
                  <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="tnum text-[12px] opacity-70">{i + 1}</span>
              )}
              {label}
              <span className="sr-only">{state === "done" ? " (completed)" : ""}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

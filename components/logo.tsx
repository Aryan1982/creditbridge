export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect width="22" height="22" rx="6" fill="#3350d6" />
        <path d="M5 15.5C5 11.36 7.69 8 11 8s6 3.36 6 7.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 15.5h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">CreditBridge</span>
    </span>
  );
}

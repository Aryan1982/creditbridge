export function AppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
      <defs>
        <linearGradient id="cb-icon-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4aa3ff" />
          <stop offset="1" stopColor="#0064e0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#cb-icon-bg)" />
      <path d="M15 44c0-9.4 7.6-17 17-17s17 7.6 17 17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M12 44h40" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 44v-6M32 44v-9M40 44v-6" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "", hideTextOnMobile = false }: { className?: string; hideTextOnMobile?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[9px] ${className}`}>
      <AppIcon />
      <span className={`text-[15px] font-semibold tracking-[-0.015em] text-fg ${hideTextOnMobile ? "max-[720px]:hidden" : ""}`}>CreditBridge</span>
    </span>
  );
}

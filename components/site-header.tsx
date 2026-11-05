"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { currentTheme, setTheme, type Theme } from "@/lib/theme";
import { Logo } from "./logo";

const LINKS = [
  { href: "/check", label: "Check eligibility", short: "Check" },
  { href: "/lender", label: "For lenders", short: "Lenders" },
  { href: "/model", label: "Model", short: "Model" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-[var(--nav)] backdrop-blur-[20px] backdrop-saturate-[1.8] print:hidden">
      <div className="mx-auto grid h-14 max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-4 px-[14px] md:grid-cols-[1fr_auto_1fr] md:px-6">
        <Link href="/" className="justify-self-start rounded-lg" aria-label="CreditBridge home">
          <Logo hideTextOnMobile />
        </Link>

        <nav aria-label="Primary" className="seg max-w-full justify-self-center overflow-x-auto">
          {LINKS.map((l) => {
            const on = isActive(l.href);
            return (
              <Link key={l.href} href={l.href} data-on={on} aria-current={on ? "page" : undefined} className="seg-item px-2.5! md:px-4!">
                <span className="hidden sm:inline">{l.label}</span>
                <span className="sm:hidden">{l.short}</span>
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  return () => window.removeEventListener("themechange", onChange);
}

function ThemeToggle() {
  // null on the server: the theme is only known once the inline theme script has run.
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, currentTheme, () => null);

  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="icon-btn justify-self-end"
      aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      title="Toggle appearance"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
        </svg>
      )}
    </button>
  );
}

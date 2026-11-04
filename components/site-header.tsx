"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";

const LINKS = [
  { href: "/check", label: "Check eligibility" },
  { href: "/lender", label: "For lenders" },
  { href: "/model", label: "Model" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85 print:hidden">
      <div className="container-page flex h-14 items-center justify-between">
        <Link href="/" className="-m-1 rounded-md p-1" aria-label="CreditBridge home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive(l.href) ? "text-ink font-medium" : "text-zinc-600 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/check"
            className="ml-3 rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Get started
          </Link>
        </nav>

        <button
          type="button"
          className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            {open ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Primary" className="border-t border-line bg-white md:hidden">
          <ul className="container-page flex flex-col py-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`block rounded-md py-2.5 text-[15px] ${isActive(l.href) ? "font-medium text-ink" : "text-zinc-600"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700 disabled:bg-accent-200 disabled:text-white",
  secondary: "bg-white text-ink border border-line-strong hover:bg-zinc-50 hover:border-zinc-300 disabled:text-zinc-400",
  ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-ink disabled:text-zinc-400",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const BADGE: Record<Tone, string> = {
  positive: "bg-positive-bg text-positive ring-green-600/15",
  caution: "bg-caution-bg text-caution ring-amber-600/20",
  negative: "bg-negative-bg text-negative ring-red-600/15",
  neutral: "bg-zinc-50 text-zinc-700 ring-zinc-900/10",
  accent: "bg-accent-50 text-accent-700 ring-accent-600/15",
};

export function Badge({ tone = "neutral", children, className = "", dot = false }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${BADGE[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Card({ children, className = "", as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <As className={`rounded-xl border border-line bg-white ${className}`}>{children}</As>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] font-medium text-accent-600 ${className}`}>{children}</p>;
}

export function SectionTitle({ title, sub, action, id }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, className = "" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[13px] text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink tnum">{value}</dd>
      {hint && <dd className="mt-1 text-[13px] text-zinc-500">{hint}</dd>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-100 ${className}`} aria-hidden="true" />;
}

export function ErrorState({ title = "Something went wrong", message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-negative-bg/60 p-5">
      <p className="text-sm font-semibold text-negative">{title}</p>
      <p className="mt-1 text-sm text-zinc-700">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusIcon({ status, className = "" }: { status: "pass" | "warn" | "fail"; className?: string }) {
  if (status === "pass")
    return (
      <svg viewBox="0 0 16 16" className={`h-4 w-4 text-positive ${className}`} aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="currentColor" opacity="0.12" />
        <path d="M5 8.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "warn")
    return (
      <svg viewBox="0 0 16 16" className={`h-4 w-4 text-caution ${className}`} aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="currentColor" opacity="0.14" />
        <path d="M8 4.5v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.95" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 text-negative ${className}`} aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" fill="currentColor" opacity="0.12" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

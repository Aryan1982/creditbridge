"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { TONE_COLOR, type Tone } from "@/lib/format";

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "tinted" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:opacity-40",
  secondary: "bg-panel text-fg shadow-card hover:bg-[color-mix(in_srgb,var(--panel)_92%,var(--fg))] disabled:text-faint",
  tinted: "bg-fill-2 text-fg hover:bg-fill disabled:text-faint",
  ghost: "text-accent hover:underline disabled:text-faint disabled:no-underline",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[10px]",
  md: "h-[38px] px-4 text-sm rounded-xl",
  lg: "h-11 px-6 text-[15px] rounded-full",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  const pad = variant === "ghost" ? "px-1!" : "";
  return `inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${pad} ${extra}`;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Apple-style text link with a trailing chevron. */
export function ChevronLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-0.5 text-accent hover:underline ${className}`}>
      {children}
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

/* ---------- Labels ---------- */

/** Small tinted tag (reference .star). */
export function Badge({ tone = "neutral", children, className = "", dot = false }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  if (dot) return <StatusDot tone={tone} className={className}>{children}</StatusDot>;
  return (
    <span className={`tag ${className}`} style={{ "--tag": tone === "neutral" ? "var(--muted)" : TONE_COLOR[tone] } as CSSProperties}>
      {children}
    </span>
  );
}

/** Coloured dot followed by text (reference .status). */
export function StatusDot({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`status-dot ${className}`} style={{ color: TONE_COLOR[tone] }}>
      <span className="text-fg-2">{children}</span>
    </span>
  );
}

/* ---------- Surfaces ---------- */

export function PageHeader({ kicker, title, sub, actions }: { kicker?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 pb-7 pt-8 md:flex-row md:items-end md:justify-between md:pt-12">
      <div className="min-w-0">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="large-title mt-1">{title}</h1>
        {sub && <p className="mt-2 max-w-[62ch] text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, sub, action, id }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatStrip({ items, className = "" }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode; text?: boolean }[]; className?: string }) {
  const cols = items.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : items.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2";
  return (
    <dl className={`stats ${cols} ${items.length >= 4 ? "stats-4" : ""} ${className}`}>
      {items.map((s, i) => (
        <div key={i}>
          <dt className="stat-label">{s.label}</dt>
          <dd className={`stat-value ${s.text ? "text" : ""}`}>{s.value}</dd>
          {s.hint && <dd className="stat-hint">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[18px] bg-fill-2 ${className}`} aria-hidden="true" />;
}

export function ErrorState({ title = "Something went wrong", message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="card p-6 text-center">
      <StatusIcon status="fail" className="mx-auto h-8! w-8!" />
      <p className="mt-3 text-[15px] font-semibold text-fg">{title}</p>
      <p className="mx-auto mt-1 max-w-[52ch] text-sm text-muted">{message}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusIcon({ status, className = "" }: { status: "pass" | "warn" | "fail"; className?: string }) {
  const color = status === "pass" ? "text-positive" : status === "warn" ? "text-caution" : "text-negative";
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 flex-none ${color} ${className}`} aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      {status === "pass" && <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
      {status === "warn" && (
        <>
          <path d="M8 4.3v4.4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="1" fill="#fff" />
        </>
      )}
      {status === "fail" && <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

/* ---------- Controls ---------- */

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
  lang?: string;
  count?: number;
}

/** Segmented control (radiogroup) with arrow-key navigation. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
  itemClassName = "",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  itemClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className={`seg ${className}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            lang={o.lang}
            tabIndex={on ? 0 : -1}
            data-on={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`seg-item ${itemClassName}`}
          >
            {o.label}
            {o.count != null && <span className="count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** iOS switch. */
export function Switch({ checked, onChange, children, className = "" }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-[9px] whitespace-nowrap px-1 text-sm font-medium text-fg ${className}`}>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute opacity-0" />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      {children}
    </label>
  );
}

/** Search pill; "/" focuses it from anywhere (reference keyboard shortcut). */
export function SearchField({ value, onChange, placeholder, label, className = "", shortcut = true }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string; shortcut?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = document.activeElement?.tagName;
      if (e.key === "/" && t !== "INPUT" && t !== "SELECT" && t !== "TEXTAREA") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);
  return (
    <label className={`pill-search ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
      <input ref={ref} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off" />
      {shortcut && <kbd className="max-sm:hidden">/</kbd>}
    </label>
  );
}

/* ---------- Sheet ---------- */

/** Right-side drawer (bottom sheet on phones) with scrim, Escape to close and focus restore. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    ref.current?.scrollTo({ top: 0 });
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <>
      <div className="scrim" data-open={open} onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="sheet" data-open={open} role="dialog" aria-modal="true" aria-label={label} aria-hidden={!open} inert={!open} aria-describedby={titleId}>
        <div className="px-[18px] pb-9 pt-[22px] sm:px-[30px] sm:pt-[26px]" id={titleId}>
          <button ref={closeRef} type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 12 12" className="h-3 w-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
          {children}
        </div>
      </aside>
    </>
  );
}

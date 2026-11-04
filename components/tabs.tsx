"use client";

import { useId, useRef, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: ReactNode;
  count?: number;
}

export function Tabs({ tabs, value, onChange, label }: { tabs: TabDef[]; value: string; onChange: (id: string) => void; label: string }) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(i: number) {
    const n = (i + tabs.length) % tabs.length;
    onChange(tabs[n].id);
    refs.current[n]?.focus();
    refs.current[n]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-6 border-b border-line">
        {tabs.map((t, i) => {
          const sel = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${base}-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls={`panel-${t.id}`}
              tabIndex={sel ? 0 : -1}
              onClick={(e) => {
                onChange(t.id);
                e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") move(i + 1);
                else if (e.key === "ArrowLeft") move(i - 1);
                else if (e.key === "Home") move(0);
                else if (e.key === "End") move(tabs.length - 1);
                else return;
                e.preventDefault();
              }}
              className={`relative -mb-px flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm transition-colors ${
                sel ? "border-ink font-medium text-ink" : "border-transparent text-zinc-500 hover:text-ink"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1.5 py-px text-[11px] tnum ${sel ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} tabIndex={0} className="pt-6 focus-visible:outline-offset-4">
      {children}
    </div>
  );
}

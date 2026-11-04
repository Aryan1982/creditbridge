"use client";

import { useId, useRef, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: ReactNode;
  count?: number;
}

/** Tabs rendered as an Apple segmented control (scrolls horizontally on narrow screens). */
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
    <div className="-mx-[14px] overflow-x-auto px-[14px] py-1 md:mx-0 md:px-0">
      <div role="tablist" aria-label={label} className="seg min-w-max">
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
              data-on={sel}
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
              className="seg-item inline-flex items-center"
            >
              {t.label}
              {t.count != null && <span className="count">{t.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} tabIndex={-1} className="animate-rise pt-5 outline-none">
      {children}
    </div>
  );
}

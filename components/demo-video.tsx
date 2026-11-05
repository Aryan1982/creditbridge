"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const DEMO_VIDEO_ID = "gH8jdtwzNqw";
export const DEMO_VIDEO_URL = `https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`;

/** Header pill that opens the product demo in a centred player. */
export function DemoVideoButton() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex h-[34px] items-center gap-2 rounded-full border border-hairline bg-panel pl-1 pr-1 text-[13px] font-medium text-fg transition-colors hover:bg-fill-2 sm:pr-3.5"
        aria-label="Watch the product demo"
      >
        <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-accent text-white transition-transform group-hover:scale-105">
          <svg
            viewBox="0 0 16 16"
            className="ml-[1px] h-3 w-3"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M5 3.4v9.2c0 .5.55.8.97.53l7.1-4.6a.63.63 0 0 0 0-1.06l-7.1-4.6A.63.63 0 0 0 5 3.4Z" />
          </svg>
        </span>
        <span className="hidden sm:inline">Watch demo</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="CreditBridge product demo"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-[1040px]">
              <div className="mb-3 flex items-center justify-between gap-4 text-white">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    CreditBridge product demo
                  </p>
                  <p className="text-[13px] text-white/60">
                    Statement upload, forgery detection, decision and lender
                    console
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <a
                    href={DEMO_VIDEO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden rounded-full px-3 py-1.5 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:inline"
                  >
                    Open on YouTube
                  </a>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label="Close demo"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[var(--shadow-lg)] ring-1 ring-white/10">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                  title="CreditBridge product demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Kalp Topla pencereleri (Nasil calisir, misafir, ilk kalp) icin ortak, kucuk
// ortalanmis pencere. Esc ve arka plana tiklama kapatir.
export function KalpDialog({
  open,
  onClose,
  title,
  wide = false,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[800] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" className="absolute inset-0 bg-black/50 animate-consent-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${wide ? "max-w-[760px]" : "max-w-[420px]"} rounded-t-2xl bg-cream px-6 pb-7 pt-6 shadow-soft outline-none animate-consent-in sm:rounded-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
        >
          <X size={18} />
        </button>
        <h2 className="pr-8 font-display text-[22px] leading-tight tracking-[-0.5px]">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
